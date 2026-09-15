import { getDatabase } from '../../store/database'
import type { ReadingListItem } from '../../../shared/types'

interface ReadingListRow {
  id: number
  url: string
  title: string
  excerpt: string | null
  favicon_url: string | null
  added_at: number
  source_url: string | null
  ai_summary: string | null
}

function rowToReadingListItem(row: ReadingListRow): ReadingListItem {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    excerpt: row.excerpt ?? undefined,
    faviconUrl: row.favicon_url ?? undefined,
    addedAt: row.added_at,
    sourceUrl: row.source_url ?? undefined,
    aiSummary: row.ai_summary ?? undefined,
  }
}

export class ReadingListService {
  add(params: { url: string; title: string; excerpt?: string; faviconUrl?: string; sourceUrl?: string }): ReadingListItem | null {
    const db = getDatabase()
    const now = Date.now()

    try {
      const result = db.prepare(
        `INSERT INTO reading_list (url, title, excerpt, favicon_url, added_at, source_url)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(params.url, params.title, params.excerpt ?? null, params.faviconUrl ?? null, now, params.sourceUrl ?? null)

      return rowToReadingListItem({
        id: Number(result.lastInsertRowid),
        url: params.url,
        title: params.title,
        excerpt: params.excerpt ?? null,
        favicon_url: params.faviconUrl ?? null,
        added_at: now,
        source_url: params.sourceUrl ?? null,
        ai_summary: null,
      })
    } catch {
      return null
    }
  }

  remove(id: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM reading_list WHERE id = ?').run(id)
    return result.changes > 0
  }

  get(id: number): ReadingListItem | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM reading_list WHERE id = ?').get(id) as ReadingListRow | undefined
    return row ? rowToReadingListItem(row) : null
  }

  list(page = 1, perPage = 50): { entries: ReadingListItem[]; total: number } {
    const db = getDatabase()
    const offset = (page - 1) * perPage

    const countRow = db.prepare('SELECT COUNT(*) AS total FROM reading_list').get() as { total: number }
    const rows = db.prepare(
      'SELECT * FROM reading_list ORDER BY added_at DESC LIMIT ? OFFSET ?'
    ).all(perPage, offset) as ReadingListRow[]

    return {
      entries: rows.map(rowToReadingListItem),
      total: countRow.total,
    }
  }

  search(query: string, limit = 50): ReadingListItem[] {
    const db = getDatabase()
    const pattern = `%${query}%`
    const rows = db.prepare(
      `SELECT * FROM reading_list
       WHERE title LIKE ? OR url LIKE ?
       ORDER BY added_at DESC
       LIMIT ?`
    ).all(pattern, pattern, limit) as ReadingListRow[]
    return rows.map(rowToReadingListItem)
  }

  updateAiSummary(id: number, summary: string): boolean {
    const db = getDatabase()
    const result = db.prepare('UPDATE reading_list SET ai_summary = ? WHERE id = ?').run(summary, id)
    return result.changes > 0
  }

  getAllUrls(): string[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT url FROM reading_list').all() as { url: string }[]
    return rows.map((r) => r.url)
  }

  clear(): number {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM reading_list').run()
    return result.changes
  }
}
