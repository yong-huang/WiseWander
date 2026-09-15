import type { ChatMessage, MultiTabRequest, MultiTabResult, MultiTabAnalysisMode } from '../../../shared/types'
import type { ModelRouter } from '../ai/router'

const PROMPTS: Record<MultiTabAnalysisMode, string> = {
  compare: `You are a research analyst. Compare the content from multiple web pages and provide a structured comparison. Highlight similarities, differences, and unique perspectives. Organize by key themes.`,
  aggregate: `You are a research synthesizer. Aggregate information from multiple web pages into a coherent summary. Combine complementary information, remove duplicates, and create a unified overview.`,
  contradiction: `You are a fact-checking analyst. Analyze multiple web pages and identify any contradictions, conflicting claims, or disagreements between sources. For each contradiction, cite which sources disagree and what they claim.`,
}

export class MultiTabAnalyzer {
  private router: ModelRouter

  constructor(router: ModelRouter) {
    this.router = router
  }

  async analyze(request: MultiTabRequest): Promise<MultiTabResult> {
    const systemPrompt = PROMPTS[request.mode]

    const tabDescriptions = request.tabs
      .map((tab, i) => `--- Source ${i + 1}: ${tab.title} (${tab.url}) ---\n${tab.content.slice(0, 15_000)}`)
      .join('\n\n')

    const queryNote = request.query ? `\n\nFocus question: ${request.query}` : ''

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Analyze the following ${request.tabs.length} web pages:${queryNote}\n\n${tabDescriptions}`,
      },
    ]

    const analysis = await this.router.chatSync(messages)

    return { analysis, mode: request.mode, tabCount: request.tabs.length }
  }
}
