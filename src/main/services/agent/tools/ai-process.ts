import type { ToolParameter } from '../../../../shared/types'
import type { AgentTool } from '../tool-registry'
import { modelRouter } from '../../ai/router-instance'

interface AIProcessResult {
  instruction: string
  result: string
}

const parameters: ToolParameter[] = [
  {
    name: 'instruction',
    type: 'string',
    description: 'What to do with the extracted text, e.g. "summarize", "translate to English", "list key points"',
    required: true,
  },
  {
    name: 'text',
    type: 'string',
    description: 'The text content to process',
    required: true,
  },
]

export const aiProcessTool: AgentTool = {
  name: 'ai_process',
  description:
    'Uses AI to process text content. Can summarize, translate, analyze, extract key points, answer questions, or perform any text-based task. Always use this tool after extracting text from the page when the user wants AI analysis.',
  parameters,

  async execute(
    params: Record<string, unknown>,
  ): Promise<AIProcessResult> {
    const { instruction, text } = params

    if (typeof instruction !== 'string' || !instruction) {
      throw new Error('A valid "instruction" string parameter is required.')
    }
    if (typeof text !== 'string' || !text) {
      throw new Error('A valid "text" string parameter is required.')
    }

    const truncatedText = text.length > 15000 ? text.slice(0, 15000) + '...(truncated)' : text

    const messages = [
      {
        role: 'system' as const,
        content: 'You are a helpful assistant. Process the given text according to the instruction. Respond directly with the result, do not add preamble.',
      },
      {
        role: 'user' as const,
        content: `Instruction: ${instruction}\n\nText:\n${truncatedText}`,
      },
    ]

    const result = await modelRouter.chatSync(messages)

    return { instruction, result }
  },
}
