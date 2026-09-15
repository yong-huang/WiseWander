import { OllamaClient } from '../ai/ollama-client'
import { ToolRegistry } from './tool-registry'
import type { AgentStep } from '../../../shared/types'

/**
 * Planner uses an Ollama LLM to decompose a natural-language task description
 * into an ordered list of AgentStep objects that reference registered tools.
 */
export class Planner {
  private client: OllamaClient
  private registry: ToolRegistry
  private getModel: () => string

  constructor(client: OllamaClient, registry: ToolRegistry, getModel: () => string) {
    this.client = client
    this.registry = registry
    this.getModel = getModel
  }

  /**
   * Decompose `taskDescription` into a sequence of AgentSteps.
   *
   * 1. Collect tool descriptions from the ToolRegistry.
   * 2. Build a system prompt that lists every available tool and its
   *    parameters, then ask the model to reply with *only* a JSON array.
   * 3. Send the prompt to Ollama (non-streaming — chunks are collected).
   * 4. Parse the JSON response robustly (strip markdown fences, etc.).
   * 5. Validate that every step references a known tool name.
   */
  async plan(taskDescription: string): Promise<AgentStep[]> {
    const tools = this.registry.list()

    if (tools.length === 0) {
      throw new PlannerError('No tools registered — cannot create a plan')
    }

    const systemPrompt = this.buildSystemPrompt(tools)
    const rawResponse = await this.callLlm(systemPrompt, taskDescription)

    const steps = this.parseResponse(rawResponse)
    this.validateSteps(steps)

    return steps
  }

  // ── Private helpers ────────────────────────────────────────────────

  /**
   * Build the system prompt that instructs the LLM to output a JSON array
   * of steps using only the tools described below.
   */
  private buildSystemPrompt(
    tools: Array<{ name: string; description: string; parameters: Array<{ name: string; type: string; description: string; required: boolean }> }>
  ): string {
    const toolDescriptions = tools
      .map((t) => {
        const params = t.parameters
          .map(
            (p) =>
              `    - ${p.name} (${p.type}${p.required ? ', required' : ', optional'}): ${p.description}`
          )
          .join('\n')

        return `- ${t.name}: ${t.description}\n  Parameters:\n${params || '    (none)'}`
      })
      .join('\n\n')

    return [
      'You are an AI agent planner. Your job is to decompose a user task into a sequence of tool-calling steps.',
      '',
      '## Available tools',
      '',
      toolDescriptions,
      '',
      '## Rules',
      '',
      '1. Tools run sequentially. Output of step N is available as input to step N+1.',
      '2. To pass data between steps, use the string "<previous_result>" as a placeholder — it will be replaced with the actual output of the previous step.',
      '3. For text analysis tasks (summarize, translate, extract key points): first "extract" text from the current page, then "ai_process" the result.',
      '4. Do NOT navigate to new URLs unless the user explicitly asks to visit a specific website.',
      '5. Always generate at least one step.',
      '',
      '## Output format',
      '',
      'Respond with ONLY a valid JSON array. No prose, no markdown fences.',
      'Each element: {"tool": "<name>", "input": {<params>}}',
      '',
      '## Example: user asks "summarize this page"',
      '[{"tool":"extract","input":{"selector":"article, main, body","schema":"text"}},{"tool":"ai_process","input":{"instruction":"Summarize the following text","text":"<previous_result>"}}]',
    ].join('\n')
  }

  /**
   * Call the Ollama chat endpoint with stream:false for reliable response.
   */
  private async callLlm(systemPrompt: string, userMessage: string): Promise<string> {
    const resp = await fetch(`${this.client.getBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.getModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: false,
        think: false,
      }),
    })

    if (!resp.ok) {
      throw new PlannerError(`Ollama chat request failed: ${resp.status}`)
    }

    const data = await resp.json() as { message?: { content?: string }; error?: string }
    if (data.error) {
      throw new PlannerError(`Ollama error: ${data.error}`)
    }

    return data.message?.content ?? ''
  }

  /**
   * Parse the raw LLM response into an AgentStep[].
   *
   * Handles common LLM output quirks:
   *  - Wrapping in ```json ... ``` markdown code fences
   *  - Leading/trailing whitespace or newlines
   *  - Extraneous text before/after the JSON array
   */
  private parseResponse(raw: string): AgentStep[] {
    let text = raw.trim()

    // Strip markdown code fences if present
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    if (fenceMatch) {
      text = fenceMatch[1].trim()
    }

    // Try to locate the JSON array bounds
    const firstBracket = text.indexOf('[')
    const lastBracket = text.lastIndexOf(']')

    if (firstBracket === -1 || lastBracket === -1 || lastBracket < firstBracket) {
      throw new PlannerError(
        `LLM response does not contain a JSON array. Response: ${truncate(raw, 200)}`
      )
    }

    const jsonSlice = text.slice(firstBracket, lastBracket + 1)

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonSlice)
    } catch (err) {
      throw new PlannerError(
        `Failed to parse LLM JSON output: ${err instanceof Error ? err.message : String(err)}. ` +
        `Raw slice: ${truncate(jsonSlice, 200)}`
      )
    }

    if (!Array.isArray(parsed)) {
      throw new PlannerError(
        `LLM response parsed but is not an array (got ${typeof parsed}). Response: ${truncate(raw, 200)}`
      )
    }

    return (parsed as unknown[]).map((item, index) => this.toAgentStep(item, index))
  }

  /**
   * Coerce a single parsed element into an AgentStep.
   */
  private toAgentStep(item: unknown, index: number): AgentStep {
    if (typeof item !== 'object' || item === null) {
      throw new PlannerError(
        `Step ${index} is not an object: ${JSON.stringify(item)}`
      )
    }

    const record = item as Record<string, unknown>

    if (typeof record.tool !== 'string' || record.tool.length === 0) {
      throw new PlannerError(
        `Step ${index} missing or invalid "tool" field: ${JSON.stringify(item)}`
      )
    }

    if (typeof record.input !== 'object' || record.input === null || Array.isArray(record.input)) {
      throw new PlannerError(
        `Step ${index} missing or invalid "input" field (must be an object): ${JSON.stringify(item)}`
      )
    }

    return {
      id: index,
      tool: record.tool,
      input: record.input as Record<string, unknown>,
      status: 'pending',
    }
  }

  /**
   * Ensure every step references a tool that exists in the registry.
   */
  private validateSteps(steps: AgentStep[]): void {
    const knownTools = new Set(this.registry.list().map((t) => t.name))

    for (const step of steps) {
      if (!knownTools.has(step.tool)) {
        throw new PlannerError(
          `Step ${step.id} references unknown tool "${step.tool}". ` +
          `Known tools: ${Array.from(knownTools).join(', ')}`
        )
      }
    }
  }
}

// ── Error type ───────────────────────────────────────────────────────

export class PlannerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlannerError'
  }
}

// ── Utility ──────────────────────────────────────────────────────────

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '...'
}
