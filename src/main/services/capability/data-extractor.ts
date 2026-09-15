import type { ChatMessage, ExtractionRequest, ExtractionResult } from '../../../shared/types'
import type { ModelRouter } from '../ai/router'

const SYSTEM_PROMPT = `You are a data extraction specialist. Given webpage content and a description of what to extract, return ONLY the extracted data.

Rules:
- Return ONLY valid JSON (an array of objects) unless the user requests CSV format.
- Each object should have consistent keys matching the described fields.
- Do not include any explanation, commentary, or markdown formatting outside the data.
- If using CSV format, return raw CSV text with a header row.
- Extract as many matching items as possible from the content.
- If nothing matches, return an empty array [] (JSON) or empty string (CSV).`

export class DataExtractor {
  private router: ModelRouter

  constructor(router: ModelRouter) {
    this.router = router
  }

  async extract(request: ExtractionRequest): Promise<ExtractionResult> {
    const formatInstruction = request.format === 'csv'
      ? 'Return the data as CSV with a header row. No markdown code fences.'
      : 'Return the data as a JSON array of objects. No markdown code fences.'

    const selectorNote = request.cssSelector
      ? `\nFocus only on content within this CSS selector: ${request.cssSelector}`
      : ''

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Extract the following from this page (${request.url}): ${request.description}${selectorNote}\n\nPage content:\n${request.pageContent.slice(0, 50_000)}\n\n${formatInstruction}`,
      },
    ]

    const rawText = await this.router.chatSync(messages)

    let data: unknown
    try {
      if (request.format === 'json') {
        // Strip markdown fences if present
        const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        data = JSON.parse(cleaned)
      } else {
        data = rawText.trim()
      }
    } catch {
      // If parsing fails, return raw text
      data = rawText
    }

    return { data, format: request.format, rawText }
  }
}
