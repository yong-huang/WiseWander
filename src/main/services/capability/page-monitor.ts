import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import { BrowserWindow } from 'electron'
import { getDatabase } from '../../store/database'
import type { ChatMessage, MonitoredPage, ChangeRecord } from '../../../shared/types'
import type { ModelRouter } from '../ai/router'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'

const DIFF_PROMPT = `You are a change detection assistant. Compare two snapshots of a web page and provide a brief summary of what changed.

Return a JSON object with:
- "summary": a 1-2 sentence description of the changes (what was added, removed, or modified)
- Return ONLY the JSON object, no markdown formatting.`

/** Max chars of page content kept as a snapshot for AI diffing. */
const SNAPSHOT_MAX_CHARS = 20_000

export class PageMonitorService {
  private router: ModelRouter
  private timers = new Map<string, ReturnType<typeof setInterval>>()

  constructor(router: ModelRouter) {
    this.router = router
  }

  add(params: { url: string; title: string; checkIntervalMs?: number; selector?: string }): MonitoredPage {
    const db = getDatabase()
    const now = Date.now()
    const page: MonitoredPage = {
      id: randomUUID(),
      url: params.url,
      title: params.title,
      checkIntervalMs: params.checkIntervalMs ?? 300_000,
      selector: params.selector,
      enabled: true,
      createdAt: now,
    }

    db.prepare(
      `INSERT INTO monitored_pages (id, url, title, check_interval_ms, selector, enabled, created_at)
       VALUES (@id, @url, @title, @checkIntervalMs, @selector, @enabled, @createdAt)`
    ).run(page)

    if (page.enabled) {
      this.startTimer(page.id, page.url, page.checkIntervalMs, page.selector)
    }

    return page
  }

  remove(id: string): boolean {
    const db = getDatabase()
    this.stopTimer(id)
    const result = db.prepare('DELETE FROM monitored_pages WHERE id = ?').run(id)
    return result.changes > 0
  }

  list(): MonitoredPage[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM monitored_pages ORDER BY created_at DESC').all() as Row[]
    return rows.map(rowToMonitoredPage)
  }

  toggle(id: string): MonitoredPage | null {
    const db = getDatabase()
    const existing = db.prepare('SELECT * FROM monitored_pages WHERE id = ?').get(id) as Row | undefined
    if (!existing) return null

    const newEnabled = existing.enabled ? 0 : 1
    db.prepare('UPDATE monitored_pages SET enabled = ? WHERE id = ?').run(newEnabled, id)

    if (newEnabled) {
      this.startTimer(id, existing.url, existing.check_interval_ms, existing.selector ?? undefined)
    } else {
      this.stopTimer(id)
    }

    return rowToMonitoredPage({ ...existing, enabled: newEnabled })
  }

  getHistory(monitoredPageId: string): ChangeRecord[] {
    const db = getDatabase()
    const rows = db.prepare(
      'SELECT * FROM page_changes WHERE monitored_page_id = ? ORDER BY detected_at DESC LIMIT 50'
    ).all(monitoredPageId) as ChangeRow[]
    return rows.map(rowToChangeRecord)
  }

  async checkNow(id: string): Promise<ChangeRecord | null> {
    const db = getDatabase()
    const page = db.prepare('SELECT * FROM monitored_pages WHERE id = ?').get(id) as Row | undefined
    if (!page || !page.enabled) return null

    return this.checkPage(page)
  }

  stop(): void {
    for (const [id] of this.timers) {
      this.stopTimer(id)
    }
  }

  private startTimer(id: string, url: string, intervalMs: number, _selector?: string): void {
    this.stopTimer(id)
    const timer = setInterval(() => {
      const db = getDatabase()
      const page = db.prepare('SELECT * FROM monitored_pages WHERE id = ? AND enabled = 1').get(id) as Row | undefined
      if (!page) {
        this.stopTimer(id)
        return
      }
      this.checkPage(page).catch(() => {})
    }, intervalMs)
    this.timers.set(id, timer)
  }

  private stopTimer(id: string): void {
    const timer = this.timers.get(id)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(id)
    }
  }

  private async checkPage(page: Row): Promise<ChangeRecord | null> {
    try {
      const response = await fetch(page.url, {
        headers: { 'User-Agent': 'WiseWander-Monitor/1.0' },
      })
      const text = await response.text()

      // Apply selector if specified
      let content = text
      if (page.selector) {
        const regex = new RegExp(`<[^>]*${page.selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*>[\\s\\S]*?</[^>]+>`, 'gi')
        const matches = text.match(regex)
        if (matches) {
          content = matches.join('\n')
        }
      }

      const newHash = createHash('sha256').update(content).digest('hex')
      const now = Date.now()
      const newSnapshot = content.slice(0, SNAPSHOT_MAX_CHARS)

      const db = getDatabase()
      db.prepare('UPDATE monitored_pages SET last_checked_at = ? WHERE id = ?').run(now, page.id)

      // Skip first check — record the baseline hash + snapshot for future diffs
      if (!page.last_content_hash) {
        db.prepare('UPDATE monitored_pages SET last_content_hash = ?, last_content_snapshot = ? WHERE id = ?')
          .run(newHash, newSnapshot, page.id)
        return null
      }

      // No change detected
      if (newHash === page.last_content_hash) return null

      // Change detected — generate AI diff summary from the real snapshots
      const previousSnapshot = page.last_content_snapshot ?? ''
      let diffSummary = 'Content changed.'
      if (previousSnapshot) {
        try {
          const messages: ChatMessage[] = [
            { role: 'system', content: DIFF_PROMPT },
            {
              role: 'user',
              content: `Previous:\n${previousSnapshot.slice(0, 5_000)}\n\nNew:\n${newSnapshot.slice(0, 5_000)}`,
            },
          ]
          const result = await this.router.chatSync(messages)
          const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          const parsed = JSON.parse(cleaned)
          diffSummary = parsed.summary || diffSummary
        } catch {
          // Keep default summary
        }
      }

      const change: ChangeRecord = {
        id: randomUUID(),
        monitoredPageId: page.id,
        detectedAt: now,
        previousHash: page.last_content_hash,
        newHash,
        diffSummary,
        previousSnapshot: previousSnapshot || undefined,
        newSnapshot,
      }

      db.prepare(
        `INSERT INTO page_changes (id, monitored_page_id, detected_at, previous_hash, new_hash, diff_summary, previous_snapshot, new_snapshot)
         VALUES (@id, @monitoredPageId, @detectedAt, @previousHash, @newHash, @diffSummary, @previousSnapshot, @newSnapshot)`
      ).run({
        ...change,
        previousSnapshot: previousSnapshot || null,
        newSnapshot,
      })

      db.prepare('UPDATE monitored_pages SET last_content_hash = ?, last_content_snapshot = ? WHERE id = ?')
        .run(newHash, newSnapshot, page.id)

      // Notify renderer
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        win.webContents.send(IPC_CHANNELS.MONITOR_CHANGE_DETECTED, change)
      }

      return change
    } catch {
      return null
    }
  }
}

interface Row {
  id: string
  url: string
  title: string
  check_interval_ms: number
  selector: string | null
  enabled: number
  last_checked_at: number | null
  last_content_hash: string | null
  last_content_snapshot: string | null
  created_at: number
}

interface ChangeRow {
  id: string
  monitored_page_id: string
  detected_at: number
  previous_hash: string
  new_hash: string
  diff_summary: string | null
  previous_snapshot: string | null
  new_snapshot: string | null
}

function rowToMonitoredPage(row: Row): MonitoredPage {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    checkIntervalMs: row.check_interval_ms,
    selector: row.selector ?? undefined,
    enabled: row.enabled === 1,
    lastCheckedAt: row.last_checked_at ?? undefined,
    lastContentHash: row.last_content_hash ?? undefined,
    createdAt: row.created_at,
  }
}

function rowToChangeRecord(row: ChangeRow): ChangeRecord {
  return {
    id: row.id,
    monitoredPageId: row.monitored_page_id,
    detectedAt: row.detected_at,
    previousHash: row.previous_hash,
    newHash: row.new_hash,
    diffSummary: row.diff_summary ?? undefined,
    previousSnapshot: row.previous_snapshot ?? undefined,
    newSnapshot: row.new_snapshot ?? undefined,
  }
}
