import { randomUUID } from 'crypto'
import { getDatabase } from '../../store/database'
import { EmbeddingService } from './embedding-service'
import type { Bookmark } from '../../../shared/types'

export class BookmarkService {
  private embeddingService = new EmbeddingService()
  /**
   * Toggle a bookmark by URL: delete if exists, add if not.
   * Returns `{ action: 'added' | 'removed', bookmark? }`.
   */
  toggle(params: { title: string; url: string; faviconUrl?: string; parentId?: string }): { action: 'added' | 'removed'; bookmark?: Bookmark } {
    const db = getDatabase()
    const existing = db.prepare('SELECT * FROM bookmarks WHERE url = ?').get(params.url) as Row | undefined
    if (existing) {
      db.prepare('DELETE FROM bookmarks WHERE id = ?').run(existing.id)
      return { action: 'removed' }
    }
    return { action: 'added', bookmark: this.add(params) }
  }

  /**
   * Add a new bookmark. Generates an id and timestamps automatically.
   */
  add(params: { title: string; url: string; faviconUrl?: string; parentId?: string }): Bookmark {
    const db = getDatabase()
    const now = Date.now()
    const bookmark: Bookmark = {
      id: randomUUID(),
      title: params.title,
      url: params.url,
      faviconUrl: params.faviconUrl,
      parentId: params.parentId,
      createdAt: now,
      updatedAt: now,
    }

    db.prepare(
      `INSERT INTO bookmarks (id, title, url, favicon_url, parent_id, created_at, updated_at)
       VALUES (@id, @title, @url, @faviconUrl, @parentId, @createdAt, @updatedAt)`
    ).run({
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      faviconUrl: bookmark.faviconUrl ?? null,
      parentId: bookmark.parentId ?? null,
      createdAt: bookmark.createdAt,
      updatedAt: bookmark.updatedAt,
    })

    return bookmark
  }

  /**
   * Remove a bookmark by id. Returns true if a row was deleted.
   */
  remove(id: string): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
    return result.changes > 0
  }

  /**
   * Update fields on an existing bookmark. Only supplied fields are changed.
   */
  update(id: string, fields: Partial<Pick<Bookmark, 'title' | 'url' | 'faviconUrl' | 'parentId'>>): Bookmark | null {
    const db = getDatabase()
    const existing = this.getById(id)
    if (!existing) return null

    const merged: Bookmark = {
      ...existing,
      ...fields,
      updatedAt: Date.now(),
    }

    db.prepare(
      `UPDATE bookmarks
       SET title = @title, url = @url, favicon_url = @faviconUrl, parent_id = @parentId, updated_at = @updatedAt
       WHERE id = @id`
    ).run({
      id: merged.id,
      title: merged.title,
      url: merged.url,
      faviconUrl: merged.faviconUrl ?? null,
      parentId: merged.parentId ?? null,
      updatedAt: merged.updatedAt,
    })

    return merged
  }

  /**
   * Return all bookmarks as a flat list, ordered by creation date.
   */
  list(): Bookmark[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM bookmarks ORDER BY created_at ASC').all() as Row[]
    return rows.map(rowToBookmark)
  }

  /**
   * Build a tree structure from the flat bookmark list.
   * Top-level nodes have no parentId. Children are nested inside a `children` array.
   */
  getTree(): BookmarkTreeNode[] {
    const flat = this.list()
    const nodeMap = new Map<string, BookmarkTreeNode>()
    const roots: BookmarkTreeNode[] = []

    // First pass: create node for every bookmark
    for (const bm of flat) {
      nodeMap.set(bm.id, { ...bm, children: [] })
    }

    // Second pass: build parent-child relationships
    for (const bm of flat) {
      const node = nodeMap.get(bm.id)!
      if (bm.parentId && nodeMap.has(bm.parentId)) {
        nodeMap.get(bm.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    return roots
  }

  /**
   * Search bookmarks by title or URL, case-insensitive substring match.
   */
  search(query: string): Bookmark[] {
    const db = getDatabase()
    const pattern = `%${query}%`
    const rows = db.prepare(
      `SELECT * FROM bookmarks
       WHERE title LIKE ? OR url LIKE ?
       ORDER BY updated_at DESC`
    ).all(pattern, pattern) as Row[]
    return rows.map(rowToBookmark)
  }

  /**
   * Compute embeddings for all bookmarks that don't have one yet.
   * Processes in batches to avoid overwhelming Ollama.
   */
  async computeEmbeddings(): Promise<{ updated: number; errors: number }> {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM bookmarks WHERE embedding IS NULL').all() as Row[]
    let updated = 0
    let errors = 0

    for (const row of rows) {
      try {
        const text = `${row.title} ${row.url}`
        const embedding = await this.embeddingService.embedSingle(text)
        const buffer = Buffer.from(new Float32Array(embedding).buffer)
        db.prepare('UPDATE bookmarks SET embedding = ? WHERE id = ?').run(buffer, row.id)
        updated++
      } catch {
        errors++
      }
    }

    return { updated, errors }
  }

  /**
   * Search bookmarks by semantic similarity using a natural language query.
   * Falls back to text search if no embeddings are available.
   */
  async semanticSearch(query: string, limit = 10): Promise<Array<Bookmark & { score: number }>> {
    const db = getDatabase()
    const queryEmbedding = await this.embeddingService.embedSingle(query)

    const rows = db.prepare('SELECT * FROM bookmarks WHERE embedding IS NOT NULL').all() as Row[]

    const scored = rows.map((row) => {
      const storedBuffer = row.embedding as Buffer | null
      if (!storedBuffer) return { row, score: 0 }
      const storedArray = Array.from(new Float32Array(storedBuffer.buffer, storedBuffer.byteOffset, storedBuffer.byteLength / 4))
      const score = this.embeddingService.cosineSimilarity(queryEmbedding, storedArray)
      return { row, score }
    })

    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, limit)

    // If no semantic results, fall back to text search
    if (top.length === 0 || top[0].score < 0.1) {
      return this.search(query).map((bm) => ({ ...bm, score: 0 }))
    }

    return top
      .filter((item) => item.score > 0.1)
      .map((item) => ({ ...rowToBookmark(item.row), score: item.score }))
  }

  // ── helpers ──

  private getById(id: string): Bookmark | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as Row | undefined
    return row ? rowToBookmark(row) : null
  }
}

// ── internal types ──

interface Row {
  id: string
  title: string
  url: string
  favicon_url: string | null
  parent_id: string | null
  created_at: number
  updated_at: number
  embedding: Buffer | null
}

function rowToBookmark(row: Row): Bookmark {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    faviconUrl: row.favicon_url ?? undefined,
    parentId: row.parent_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface BookmarkTreeNode extends Bookmark {
  children: BookmarkTreeNode[]
}
