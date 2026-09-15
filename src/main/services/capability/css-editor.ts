import type { ChatMessage, CssEditRequest, CssEditResult } from '../../../shared/types'
import type { ModelRouter } from '../ai/router'

const SYSTEM_PROMPT = `You are a CSS expert. Given a CSS selector and a natural language description of desired style changes, generate the CSS to achieve that look.

Rules:
- Return a JSON object with exactly these keys: "css", "selector", "explanation"
- "css": the CSS property declarations as a single string (e.g., "background: #1a1a2e; color: #fff; padding: 16px;")
- "selector": the CSS selector to target (use the provided selector or a more specific one if needed)
- "explanation": a brief one-sentence explanation of what the CSS does
- Return ONLY the JSON object, no markdown formatting or code fences
- Use modern CSS properties and values
- Include any necessary vendor prefixes for broader compatibility`

export class CssEditor {
  private router: ModelRouter

  constructor(router: ModelRouter) {
    this.router = router
  }

  async generate(request: CssEditRequest): Promise<CssEditResult> {
    const currentNote = request.currentCss
      ? `\n\nCurrent CSS for this element:\n${request.currentCss}`
      : ''

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Selector: ${request.selector}\nDesired style: ${request.description}\nPage: ${request.pageUrl}${currentNote}`,
      },
    ]

    const rawText = await this.router.chatSync(messages)

    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned) as CssEditResult
      return {
        css: parsed.css || '',
        selector: parsed.selector || request.selector,
        explanation: parsed.explanation || '',
      }
    } catch {
      // Fallback: return raw text as CSS
      return {
        css: rawText,
        selector: request.selector,
        explanation: 'Generated CSS (parsing fallback)',
      }
    }
  }
}
