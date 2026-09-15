import { getDatabase } from '../../store/database'
import { ReadingListService } from '../browser/reading-list-service'
import { HistoryService } from '../browser/history-service'
import { BookmarkService } from '../browser/bookmark-service'
import { HistoryAnalyzer } from './history-analyzer'
import { InterestAnalyzer } from './interest-analyzer'
import type { ModelRouter } from '../ai/router'
import type { Recommendation, InterestProfile, RecommendationBundle } from '../../../shared/types'
import {
  RECOMMENDATION_RECOMPUTE_INTERVAL,
  RECOMMENDATION_CACHE_TTL,
  RECOMMENDATION_MIN_HISTORY_DELTA,
} from '../../../shared/constants'

interface CacheRow {
  id: number
  category: string
  title: string
  url: string
  excerpt: string | null
  favicon_url: string | null
  source_type: string
  interest_label: string | null
  score: number
  created_at: number
  expires_at: number
}

interface InterestRow {
  id: number
  label: string
  keywords: string
  weight: number
  created_at: number
  updated_at: number
  sample_urls: string | null
}

function cacheRowToRecommendation(row: CacheRow): Recommendation {
  return {
    id: row.id,
    category: row.category as Recommendation['category'],
    title: row.title,
    url: row.url,
    excerpt: row.excerpt ?? undefined,
    faviconUrl: row.favicon_url ?? undefined,
    sourceType: row.source_type as Recommendation['sourceType'],
    interestLabel: row.interest_label ?? undefined,
    score: row.score,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }
}

function interestRowToProfile(row: InterestRow): InterestProfile {
  return {
    id: row.id,
    label: row.label,
    keywords: JSON.parse(row.keywords),
    weight: row.weight,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sampleUrls: row.sample_urls ? JSON.parse(row.sample_urls) : [],
  }
}

export class RecommendationService {
  private readingListService: ReadingListService
  private historyService: HistoryService
  private bookmarkService: BookmarkService
  private interestAnalyzer: InterestAnalyzer
  private historyAnalyzer: HistoryAnalyzer
  private lastAnalysisTime = 0
  private isAnalyzing = false

  constructor(
    readingListService: ReadingListService,
    historyService: HistoryService,
    bookmarkService: BookmarkService,
    modelRouter: ModelRouter,
  ) {
    this.readingListService = readingListService
    this.historyService = historyService
    this.bookmarkService = bookmarkService
    this.historyAnalyzer = new HistoryAnalyzer()
    this.interestAnalyzer = new InterestAnalyzer(modelRouter)
  }

  getRecommendations(): RecommendationBundle {
    const cached = this.getValidCache()
    if (cached.length > 0) {
      return {
        recommendations: cached,
        generatedAt: Date.now(),
        isFromCache: true,
        interestProfiles: this.getInterestProfiles(),
      }
    }

    const freq = this.historyAnalyzer.getTopDomains(8)
    return {
      recommendations: freq,
      generatedAt: Date.now(),
      isFromCache: false,
      interestProfiles: this.getInterestProfiles(),
    }
  }

  refreshRecommendations(force = false): RecommendationBundle {
    if (!force) {
      this.pruneCache()
    }

    const freq = this.historyAnalyzer.getTopDomains(8)
    const revisit = this.historyAnalyzer.getRevisitCandidates(4)
    const all = [...freq, ...revisit]

    this.updateCache(all)

    // Kick off AI analysis in background (fire and forget)
    this.analyzeInterestsAsync().catch(() => {})

    return {
      recommendations: all,
      generatedAt: Date.now(),
      isFromCache: false,
      interestProfiles: this.getInterestProfiles(),
    }
  }

  async analyzeInterestsAsync(): Promise<RecommendationBundle | null> {
    if (this.isAnalyzing) return null
    const now = Date.now()
    if (!this.shouldReanalyze(now)) return null

    this.isAnalyzing = true
    this.lastAnalysisTime = now

    try {
      const { entries: history } = this.historyService.list(1, RECOMMENDATION_MIN_HISTORY_DELTA)
      if (history.length < 5) return null

      // Analyze interests
      const interests = await this.interestAnalyzer.analyze(history)
      if (interests.length === 0) return null

      // Get AI-powered suggestions
      const aiSuggestions = await this.interestAnalyzer.suggestContent(interests)

      // Get reading list similar content
      const { entries: readingList } = this.readingListService.list(1, 10)
      const similarContent = await this.interestAnalyzer.findSimilarContent(readingList)

      // Merge and cache
      const allAi = [...aiSuggestions, ...similarContent]
      this.updateCache(allAi)

      return {
        recommendations: this.getValidCache(),
        generatedAt: Date.now(),
        isFromCache: false,
        interestProfiles: interests,
      }
    } catch {
      return null
    } finally {
      this.isAnalyzing = false
    }
  }

  getReadingList(page = 1, perPage = 50) {
    return this.readingListService.list(page, perPage)
  }

  addToReadingList(params: { url: string; title: string; excerpt?: string; faviconUrl?: string }) {
    return this.readingListService.add(params)
  }

  removeFromReadingList(id: number) {
    return this.readingListService.remove(id)
  }

  // ── Private helpers ──

  private shouldReanalyze(now: number): boolean {
    if (now - this.lastAnalysisTime < RECOMMENDATION_RECOMPUTE_INTERVAL) return false

    const db = getDatabase()
    const row = db.prepare(
      'SELECT MAX(created_at) AS last FROM recommendation_cache WHERE source_type IN (?, ?)'
    ).get('ai_interest', 'reading_list_similar') as { last: number | null } | undefined

    if (!row?.last) return true
    return now - row.last >= RECOMMENDATION_RECOMPUTE_INTERVAL
  }

  private getValidCache(): Recommendation[] {
    const db = getDatabase()
    const now = Date.now()
    const rows = db.prepare(
      'SELECT * FROM recommendation_cache WHERE expires_at > ? ORDER BY score DESC'
    ).all(now) as CacheRow[]
    return rows.map(cacheRowToRecommendation)
  }

  private updateCache(recommendations: Recommendation[]): void {
    const db = getDatabase()
    const now = Date.now()
    const expires = now + RECOMMENDATION_CACHE_TTL

    const upsert = db.prepare(
      `INSERT INTO recommendation_cache (category, title, url, excerpt, favicon_url, source_type, interest_label, score, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET
         category = excluded.category, title = excluded.title, excerpt = excluded.excerpt,
         source_type = excluded.source_type, interest_label = excluded.interest_label,
         score = excluded.score, created_at = excluded.created_at, expires_at = excluded.expires_at`
    )

    const transaction = db.transaction((recs: Recommendation[]) => {
      for (const r of recs) {
        upsert.run(
          r.category, r.title, r.url, r.excerpt ?? null, r.faviconUrl ?? null,
          r.sourceType, r.interestLabel ?? null, r.score, r.createdAt, expires,
        )
      }
    })

    transaction(recommendations)
  }

  private getInterestProfiles(): InterestProfile[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM interest_profiles ORDER BY weight DESC').all() as InterestRow[]
    return rows.map(interestRowToProfile)
  }

  private pruneCache(): void {
    const db = getDatabase()
    db.prepare('DELETE FROM recommendation_cache WHERE expires_at <= ?').run(Date.now())
  }
}
