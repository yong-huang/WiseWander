import type { ChatMessage, DesignStyleData, DesignAnalysisResult } from '../../../shared/types'
import type { ModelRouter } from '../ai/router'

const SYSTEM_PROMPT = `You are a senior front-end design expert. The user will provide structured design data extracted from a webpage.

Your task:
1. Analyze the design data and describe the visual style in a concise paragraph (colors, typography, spacing, component styles).
2. Generate a complete, self-contained HTML template that replicates this design style.

The template MUST include ALL of the following sections and components:
- Navigation bar with logo, menu links, and a dropdown menu
- Hero section with heading, subtext, and CTA buttons
- Tabs component (3-4 tabs, clickable to switch content panels with mock data)
- Cards section (3-4 cards with title, image placeholder, description, action button)
- Data table with 5+ rows of realistic mock data, sortable-looking headers, and row hover effect
- Pagination below the table (prev/next + page numbers)
- Form section with text inputs, select dropdown, checkbox, radio buttons, textarea, and a submit button
- Modal/dialog component (hidden by default, with a button to open it; includes title, body text, cancel and confirm buttons)
- Alert/notification banners (success, warning, error styles)
- Badge/tag elements
- Footer with links and copyright

Additional requirements:
- Fill ALL elements with realistic mock data (not "Lorem ipsum" — use meaningful English content).
- Add interactive JavaScript for: tab switching, modal open/close, pagination highlight, alert dismiss, button click ripple/feedback effects.
- Use the EXACT colors, fonts, border-radius, shadows, and spacing from the provided design data.
- All CSS must be inside a <style> tag in the HTML.
- The template must be responsive and visually polished.
- Do NOT use any external CDN links or images — use inline SVG icons or CSS-only placeholders.

Output format:
First, write your analysis as plain text.
Then, output the HTML template inside a code block like:

\`\`\`html
<!DOCTYPE html>
...
\`\`\``

export class DesignAnalyzer {
  private router: ModelRouter

  constructor(router: ModelRouter) {
    this.router = router
  }

  async analyze(styleData: DesignStyleData): Promise<DesignAnalysisResult> {
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Analyze this design data and generate a matching HTML template:\n\n${JSON.stringify(styleData, null, 2)}`,
      },
    ]

    const fullResponse = await this.router.chatSync(messages)

    // Extract HTML code block
    const htmlMatch = fullResponse.match(/```html\n([\s\S]*?)```/)
    const templateHtml = htmlMatch ? htmlMatch[1].trim() : ''

    // Extract analysis text (everything before the code block)
    const analysis = htmlMatch
      ? fullResponse.slice(0, fullResponse.indexOf('```html')).trim()
      : fullResponse.trim()

    return { analysis, templateHtml }
  }
}
