import type { ChatMessage } from '../../../shared/types'
import type { ModelRouter } from '../ai/router'

export interface ResearchSource {
  url: string
  title: string
  snippet: string
}

export interface ResearchReportSection {
  heading: string
  content: string
  sources: string[]
}

export interface ResearchReport {
  title: string
  sections: ResearchReportSection[]
  createdAt: number
}

export interface ResearchResult {
  report: ResearchReport
  sources: ResearchSource[]
}

const RESEARCH_SYSTEM_PROMPT = `You are a research assistant. You generate structured research reports based on a given topic and a list of reference URLs.

You MUST respond with ONLY valid JSON — no markdown fences, no commentary before or after. The JSON must conform exactly to this schema:

{
  "title": "<report title>",
  "sections": [
    {
      "heading": "<section heading>",
      "content": "<1-3 paragraph section body>",
      "sources": ["<url-1>", "<url-2>"]
    }
  ],
  "sources": [
    {
      "url": "<url>",
      "title": "<short descriptive title>",
      "snippet": "<1-2 sentence summary of why this source is relevant>"
    }
  ]
}

Rules:
- Produce 3-5 sections.
- Each section's "sources" array should reference URLs from the provided reference list wherever possible.
- If you have no specific URL for a claim, use an empty array for that section's sources.
- The top-level "sources" array should list every reference URL you used, with a title and snippet.
- Keep the content informative but concise.`

export class ResearchEngine {
  private router: ModelRouter

  constructor(router: ModelRouter) {
    this.router = router
  }

  async research(
    topic: string,
    tabUrls: string[],
  ): Promise<ResearchResult> {
    const urlList =
      tabUrls.length > 0
        ? `Reference URLs:\n${tabUrls.map((u) => `- ${u}`).join('\n')}`
        : 'No reference URLs are available. Use your general knowledge.'

    const userMessage: string = `Research topic: "${topic}"\n\n${urlList}\n\nGenerate a structured research report in the JSON format described.`

    const messages: ChatMessage[] = [
      { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ]

    const raw = await this.router.chatSync(messages)
    return this.parseResponse(raw)
  }

  private parseResponse(raw: string): ResearchResult {
    // Strip markdown code fences if the model wrapped the JSON
    let cleaned = raw.trim()
    const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/)
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim()
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // If parsing fails, return a single-section fallback report
      return {
        report: {
          title: 'Research Report',
          sections: [
            {
              heading: 'Raw Output',
              content: cleaned,
              sources: [],
            },
          ],
          createdAt: Date.now(),
        },
        sources: [],
      }
    }

    const report: ResearchReport = {
      title: typeof parsed.title === 'string' ? parsed.title : 'Research Report',
      sections: Array.isArray(parsed.sections)
        ? (parsed.sections as Array<Record<string, unknown>>).map((s) => ({
            heading: typeof s.heading === 'string' ? s.heading : 'Untitled Section',
            content: typeof s.content === 'string' ? s.content : '',
            sources: Array.isArray(s.sources)
              ? s.sources.filter((src: unknown) => typeof src === 'string')
              : [],
          }))
        : [],
      createdAt: Date.now(),
    }

    const sources: ResearchSource[] = Array.isArray(parsed.sources)
      ? (parsed.sources as Array<Record<string, unknown>>).map((s) => ({
          url: typeof s.url === 'string' ? s.url : '',
          title: typeof s.title === 'string' ? s.title : '',
          snippet: typeof s.snippet === 'string' ? s.snippet : '',
        }))
      : []

    return { report, sources }
  }
}
