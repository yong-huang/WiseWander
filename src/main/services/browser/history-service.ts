import { getDatabase } from '../../store/database'
import type { HistoryEntry } from '../../../shared/types'

export class HistoryService {
  /**
   * Add a visit for the given URL. If the URL already exists in history,
   * increment its visit count and update the last-visit time.
   * Otherwise insert a new row.
   */
  add(params: { url: string; title: string }): HistoryEntry {
    const db = getDatabase()
    const now = Date.now()

    const existing = db.prepare('SELECT * FROM history WHERE url = ?').get(params.url) as HistoryRow | undefined

    if (existing) {
      const newCount = existing.visit_count + 1
      db.prepare(
        `UPDATE history SET visit_count = ?, last_visit_time = ?, title = ? WHERE id = ?`
      ).run(newCount, now, params.title, existing.id)

      return {
        id: existing.id,
        url: existing.url,
        title: params.title,
        visitCount: newCount,
        lastVisitTime: now,
      }
    }

    const result = db.prepare(
      `INSERT INTO history (url, title, visit_count, last_visit_time) VALUES (?, ?, 1, ?)`
    ).run(params.url, params.title, now)

    return {
      id: Number(result.lastInsertRowid),
      url: params.url,
      title: params.title,
      visitCount: 1,
      lastVisitTime: now,
    }
  }

  /**
   * Search history by title or URL (case-insensitive substring match).
   * Returns results ordered by recency.
   */
  search(query: string, limit = 50): HistoryEntry[] {
    const db = getDatabase()
    const pattern = `%${query}%`
    const rows = db.prepare(
      `SELECT * FROM history
       WHERE title LIKE ? OR url LIKE ?
       ORDER BY last_visit_time DESC
       LIMIT ?`
    ).all(pattern, pattern, limit) as HistoryRow[]
    return rows.map(rowToHistoryEntry)
  }

  /**
   * List recent history entries, paginated and sorted by recency.
   * @param page  1-based page number
   * @param perPage  number of entries per page
   */
  list(page = 1, perPage = 50): { entries: HistoryEntry[]; total: number } {
    const db = getDatabase()
    const offset = (page - 1) * perPage

    const countRow = db.prepare('SELECT COUNT(*) AS total FROM history').get() as { total: number }

    const rows = db.prepare(
      `SELECT * FROM history ORDER BY last_visit_time DESC LIMIT ? OFFSET ?`
    ).all(perPage, offset) as HistoryRow[]

    return {
      entries: rows.map(rowToHistoryEntry),
      total: countRow.total,
    }
  }

  /**
   * Remove a single history entry by id.
   */
  remove(id: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM history WHERE id = ?').run(id)
    return result.changes > 0
  }

  /**
   * Delete all history entries.
   */
  clear(): number {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM history').run()
    return result.changes
  }
}

// ── internal types ──

interface HistoryRow {
  id: number
  url: string
  title: string | null
  visit_count: number
  last_visit_time: number
}

function rowToHistoryEntry(row: HistoryRow): HistoryEntry {
  return {
    id: row.id,
    url: row.url,
    title: row.title ?? '',
    visitCount: row.visit_count,
    lastVisitTime: row.last_visit_time,
  }
}
