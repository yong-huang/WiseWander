import { randomUUID } from 'crypto'
import { getDatabase } from '../../store/database'
import type { DownloadItem } from '../../../shared/types'

export class DownloadService {
  /**
   * Track the start of a new download. Inserts a row with state 'downloading'.
   */
  start(params: { url: string; filename: string; savePath: string; totalBytes?: number }): DownloadItem {
    const db = getDatabase()
    const now = Date.now()
    const item: DownloadItem = {
      id: randomUUID(),
      url: params.url,
      filename: params.filename,
      savePath: params.savePath,
      state: 'downloading',
      totalBytes: params.totalBytes ?? 0,
      receivedBytes: 0,
      startedAt: now,
    }

    db.prepare(
      `INSERT INTO downloads (id, url, filename, save_path, state, total_bytes, received_bytes, started_at, completed_at)
       VALUES (@id, @url, @filename, @savePath, @state, @totalBytes, @receivedBytes, @startedAt, @completedAt)`
    ).run({
      id: item.id,
      url: item.url,
      filename: item.filename,
      savePath: item.savePath,
      state: item.state,
      totalBytes: item.totalBytes,
      receivedBytes: item.receivedBytes,
      startedAt: item.startedAt,
      completedAt: null,
    })

    return item
  }

  /**
   * Update the progress of an in-progress download.
   */
  updateProgress(id: string, receivedBytes: number): DownloadItem | null {
    const db = getDatabase()
    const existing = this.getById(id)
    if (!existing || existing.state !== 'downloading') return null

    db.prepare('UPDATE downloads SET received_bytes = ? WHERE id = ?').run(receivedBytes, id)

    return { ...existing, receivedBytes }
  }

  /**
   * Mark a download as completed.
   */
  complete(id: string): DownloadItem | null {
    const db = getDatabase()
    const existing = this.getById(id)
    if (!existing) return null

    const now = Date.now()
    db.prepare(
      `UPDATE downloads SET state = 'completed', received_bytes = total_bytes, completed_at = ? WHERE id = ?`
    ).run(now, id)

    return { ...existing, state: 'completed', completedAt: now, receivedBytes: existing.totalBytes }
  }

  /**
   * Mark a download as errored with the given message stored in state.
   */
  markError(id: string): DownloadItem | null {
    const db = getDatabase()
    const existing = this.getById(id)
    if (!existing) return null

    const now = Date.now()
    db.prepare(
      `UPDATE downloads SET state = 'error', completed_at = ? WHERE id = ?`
    ).run(now, id)

    return { ...existing, state: 'error', completedAt: now }
  }

  /**
   * Cancel an in-progress download.
   */
  cancel(id: string): boolean {
    const db = getDatabase()
    const existing = this.getById(id)
    if (!existing || existing.state !== 'downloading') return false

    const now = Date.now()
    db.prepare(
      `UPDATE downloads SET state = 'cancelled', completed_at = ? WHERE id = ?`
    ).run(now, id)

    return true
  }

  /**
   * List all downloads, optionally filtered by state, ordered by start time descending.
   */
  list(state?: DownloadItem['state']): DownloadItem[] {
    const db = getDatabase()
    let rows: DownloadRow[]

    if (state) {
      rows = db.prepare('SELECT * FROM downloads WHERE state = ? ORDER BY started_at DESC').all(state) as DownloadRow[]
    } else {
      rows = db.prepare('SELECT * FROM downloads ORDER BY started_at DESC').all() as DownloadRow[]
    }

    return rows.map(rowToDownloadItem)
  }

  /**
   * Delete all completed, cancelled, or errored downloads from the database.
   * Active downloads are preserved.
   */
  clear(): number {
    const db = getDatabase()
    const result = db.prepare(
      `DELETE FROM downloads WHERE state IN ('completed', 'cancelled', 'error')`
    ).run()
    return result.changes
  }

  /**
   * Remove a single download record by id.
   */
  remove(id: string): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM downloads WHERE id = ?').run(id)
    return result.changes > 0
  }

  // ── helpers ──

  private getById(id: string): DownloadItem | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM downloads WHERE id = ?').get(id) as DownloadRow | undefined
    return row ? rowToDownloadItem(row) : null
  }
}

// ── internal types ──

interface DownloadRow {
  id: string
  url: string
  filename: string
  save_path: string
  state: string
  total_bytes: number
  received_bytes: number
  started_at: number
  completed_at: number | null
}

function rowToDownloadItem(row: DownloadRow): DownloadItem {
  return {
    id: row.id,
    url: row.url,
    filename: row.filename,
    savePath: row.save_path,
    state: row.state as DownloadItem['state'],
    totalBytes: row.total_bytes,
    receivedBytes: row.received_bytes,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
  }
}
