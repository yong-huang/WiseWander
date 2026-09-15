import type { ChatMessage, InterestProfile, Recommendation, HistoryEntry, ReadingListItem } from '../../../shared/types'
import { RECOMMENDATION_MAX_HISTORY_SAMPLE } from '../../../shared/constants'
import { getDatabase } from '../../store/database'
import type { ModelRouter } from '../ai/router'

interface RawInterest {
  label: string
  keywords: string[]
  weight: number
  sampleUrls: string[]
}

interface RawSuggestion {
  title: string
  url: string
  reason: string
  interest_label?: string
  based_on?: string
}

function safeJsonParse<T>(text: string): T | null {
  try {
    // Find JSON object in the response
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0]) as T
  } catch {
    return null
  }
}

export class InterestAnalyzer {
  constructor(private modelRouter: ModelRouter) {}

  async analyze(history: HistoryEntry[]): Promise<InterestProfile[]> {
    if (history.length === 0) return []

    const sample = history.slice(0, RECOMMENDATION_MAX_HISTORY_SAMPLE)
    const historyText = sample
      .map((h) => `- ${h.title || h.url} (${h.visitCount} visits)`)
      .join('\n')

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a browsing behavior analyst. Given browsing history, identify 3-8 interest areas.
Output ONLY valid JSON in this exact format, no markdown:
{ "interests": [{ "label": "Interest Name", "keywords": ["kw1", "kw2"], "weight": 1.0, "sampleUrls": ["https://example.com"] }] }
Weight should be 0.5-2.0 based on how dominant the interest is.`,
      },
      { role: 'user', content: `Here is the user's browsing history:\n${historyText}` },
    ]

    try {
      const response = await this.modelRouter.chatSync(messages)
      const parsed = safeJsonParse<{ interests: RawInterest[] }>(response)
      if (!parsed?.interests) return []

      const now = Date.now()
      const db = getDatabase()

      db.prepare('DELETE FROM interest_profiles').run()

      return parsed.interests.map((raw, i) => {
        const profile: InterestProfile = {
          id: i,
          label: raw.label,
          keywords: raw.keywords,
          weight: raw.weight,
          createdAt: now,
          updatedAt: now,
          sampleUrls: raw.sampleUrls ?? [],
        }

        db.prepare(
          `INSERT INTO interest_profiles (label, keywords, weight, created_at, updated_at, sample_urls)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          profile.label,
          JSON.stringify(profile.keywords),
          profile.weight,
          profile.createdAt,
          profile.updatedAt,
          JSON.stringify(profile.sampleUrls),
        )

        return profile
      })
    } catch {
      return []
    }
  }

  async suggestContent(interests: InterestProfile[]): Promise<Recommendation[]> {
    if (interests.length === 0) return []

    const interestText = interests
      .map((i) => `${i.label} (keywords: ${i.keywords.join(', ')})`)
      .join('\n')

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a content recommendation engine. Based on the user's interest profile, suggest web pages they might find interesting.
Output ONLY valid JSON:
{ "suggestions": [{ "title": "Page Title", "url": "https://example.com/page", "reason": "Why they might like this", "interest_label": "Matching Interest" }] }
Suggest 4-8 pages. Use real, well-known websites.`,
      },
      { role: 'user', content: `User interests:\n${interestText}` },
    ]

    try {
      const response = await this.modelRouter.chatSync(messages)
      const parsed = safeJsonParse<{ suggestions: RawSuggestion[] }>(response)
      if (!parsed?.suggestions) return []

      const now = Date.now()
      return parsed.suggestions.map((s, i) => ({
        id: i,
        category: 'interest' as const,
        title: s.title,
        url: s.url,
        excerpt: s.reason,
        sourceType: 'ai_interest' as const,
        interestLabel: s.interest_label,
        score: 1.5,
        createdAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
      }))
    } catch {
      return []
    }
  }

  async findSimilarContent(readingList: ReadingListItem[]): Promise<Recommendation[]> {
    if (readingList.length === 0) return []

    const listText = readingList
      .slice(0, 10)
      .map((item) => `- ${item.title} (${item.url})`)
      .join('\n')

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a content recommendation engine. Based on the user's reading list, suggest similar content they might enjoy.
Output ONLY valid JSON:
{ "suggestions": [{ "title": "Page Title", "url": "https://example.com/page", "reason": "Why they might like this", "based_on": "Title of reading list item it's based on" }] }
Suggest 3-6 pages. Use real, well-known websites.`,
      },
      { role: 'user', content: `User's reading list:\n${listText}` },
    ]

    try {
      const response = await this.modelRouter.chatSync(messages)
      const parsed = safeJsonParse<{ suggestions: RawSuggestion[] }>(response)
      if (!parsed?.suggestions) return []

      const now = Date.now()
      return parsed.suggestions.map((s, i) => ({
        id: i,
        category: 'reading_list' as const,
        title: s.title,
        url: s.url,
        excerpt: s.reason,
        sourceType: 'reading_list_similar' as const,
        interestLabel: s.based_on,
        score: 1.3,
        createdAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
      }))
    } catch {
      return []
    }
  }
}
