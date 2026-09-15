import { getDatabase } from '../../store/database'
import type { Recommendation } from '../../../shared/types'

interface HistoryRow {
  id: number
  url: string
  title: string | null
  visit_count: number
  last_visit_time: number
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export class HistoryAnalyzer {
  getTopDomains(limit = 8): Recommendation[] {
    const db = getDatabase()
    const now = Date.now()
    const results: Recommendation[] = []

    const domainRows = db.prepare(
      `SELECT url, title, visit_count, last_visit_time
       FROM history
       WHERE visit_count >= 2
       ORDER BY visit_count DESC, last_visit_time DESC
       LIMIT ?`
    ).all(limit * 3) as HistoryRow[]

    const domainMap = new Map<string, { totalVisits: number; topPages: HistoryRow[] }>()

    for (const row of domainRows) {
      const domain = extractDomain(row.url)
      const existing = domainMap.get(domain)
      if (existing) {
        existing.totalVisits += row.visit_count
        if (existing.topPages.length < 2) {
          existing.topPages.push(row)
        }
      } else {
        domainMap.set(domain, { totalVisits: row.visit_count, topPages: [row] })
      }
    }

    const sorted = Array.from(domainMap.entries())
      .sort((a, b) => b[1].totalVisits - a[1].totalVisits)
      .slice(0, limit)

    let id = 0
    for (const [domain, data] of sorted) {
      const topPage = data.topPages[0]
      if (!topPage) continue
      results.push({
        id: id++,
        category: 'history',
        title: topPage.title ?? domain,
        url: topPage.url,
        sourceType: 'frequency',
        score: data.totalVisits,
        createdAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
      })
    }

    return results
  }

  getRevisitCandidates(limit = 6): Recommendation[] {
    const db = getDatabase()
    const now = Date.now()

    const rows = db.prepare(
      `SELECT * FROM history
       WHERE visit_count BETWEEN 2 AND 10
       ORDER BY last_visit_time DESC
       LIMIT ?`
    ).all(limit) as HistoryRow[]

    return rows.map((row, i) => ({
      id: i,
      category: 'history' as const,
      title: row.title ?? row.url,
      url: row.url,
      sourceType: 'frequency' as const,
      score: row.visit_count * 0.5,
      createdAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
    }))
  }
}
