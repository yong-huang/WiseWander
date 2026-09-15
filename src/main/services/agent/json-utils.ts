/**
 * Robust JSON extraction from LLM output.
 *
 * Extracted from the retired one-shot Planner (see docs/AGENT_EVOLUTION.md §6.1)
 * and generalized: the agent controller needs to recover single action objects,
 * not just arrays.
 */

export class JsonParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JsonParseError'
  }
}

/** Strip ```json / ``` code fences if present. */
export function stripFences(text: string): string {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  return (fenceMatch ? fenceMatch[1] : trimmed).trim()
}

function sliceBounds(text: string, open: string, close: string): string | null {
  const first = text.indexOf(open)
  const last = text.lastIndexOf(close)
  if (first === -1 || last === -1 || last < first) return null
  return text.slice(first, last + 1)
}

/**
 * Best-effort extraction of the first JSON value (object or array) from raw
 * model output. Tries, in order: direct parse, fence stripping, brace slice,
 * bracket slice.
 */
export function extractJson(raw: string): unknown {
  const attempts: string[] = [raw.trim(), stripFences(raw)]

  const fenced = stripFences(raw)
  attempts.push(sliceBounds(fenced, '{', '}') ?? '', sliceBounds(fenced, '[', ']') ?? '')
  attempts.push(sliceBounds(raw, '{', '}') ?? '', sliceBounds(raw, '[', ']') ?? '')

  let lastError: unknown = null
  for (const candidate of attempts) {
    if (!candidate) continue
    try {
      return JSON.parse(candidate)
    } catch (err) {
      lastError = err
    }
  }

  throw new JsonParseError(
    `Failed to parse JSON from model output: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }. Raw: ${truncate(raw, 200)}`
  )
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '...'
}
