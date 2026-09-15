import { randomUUID } from 'crypto'
import { getDatabase } from '../../store/database'
import type { ChatMessage, ResearchProject, ResearchSource, ResearchNote } from '../../../shared/types'
import type { ModelRouter } from '../ai/router'

const SYNTHESIZE_PROMPT = `You are a research assistant. Given a collection of source materials (snippets from web pages), synthesize comprehensive research notes.

Your notes should:
- Organize information by key themes and topics
- Cite sources using [Source N] format
- Highlight connections between sources
- Identify gaps or areas needing further research
- Provide actionable insights

Return a JSON object with:
- "notes": string — the synthesized notes in markdown format
- "citations": string — a JSON array of source references used (each with index, title, url)

Return ONLY the JSON object.`

export class ResearchWorkbench {
  private router: ModelRouter

  constructor(router: ModelRouter) {
    this.router = router
  }

  createProject(name: string, topic: string): ResearchProject {
    const db = getDatabase()
    const now = Date.now()
    const project: ResearchProject = {
      id: randomUUID(),
      name,
      topic,
      createdAt: now,
      updatedAt: now,
    }

    db.prepare(
      'INSERT INTO research_projects (id, name, topic, created_at, updated_at) VALUES (@id, @name, @topic, @createdAt, @updatedAt)'
    ).run(project)

    return project
  }

  listProjects(): ResearchProject[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM research_projects ORDER BY updated_at DESC').all() as ProjectRow[]
    return rows.map(rowToProject)
  }

  getProject(id: string): ResearchProject | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM research_projects WHERE id = ?').get(id) as ProjectRow | undefined
    return row ? rowToProject(row) : null
  }

  deleteProject(id: string): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM research_projects WHERE id = ?').run(id)
    return result.changes > 0
  }

  addSource(projectId: string, url: string, title?: string, snippet?: string): ResearchSource {
    const db = getDatabase()
    const source: ResearchSource = {
      id: randomUUID(),
      projectId,
      url,
      title,
      snippet,
      addedAt: Date.now(),
    }

    db.prepare(
      'INSERT INTO research_sources (id, project_id, url, title, snippet, added_at) VALUES (@id, @projectId, @url, @title, @snippet, @addedAt)'
    ).run(source)

    // Update project timestamp
    db.prepare('UPDATE research_projects SET updated_at = ? WHERE id = ?').run(Date.now(), projectId)

    return source
  }

  removeSource(id: string): boolean {
    const db = getDatabase()
    const source = db.prepare('SELECT project_id FROM research_sources WHERE id = ?').get(id) as { project_id: string } | undefined
    const result = db.prepare('DELETE FROM research_sources WHERE id = ?').run(id)
    if (source) {
      db.prepare('UPDATE research_projects SET updated_at = ? WHERE id = ?').run(Date.now(), source.project_id)
    }
    return result.changes > 0
  }

  getSources(projectId: string): ResearchSource[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM research_sources WHERE project_id = ? ORDER BY added_at DESC').all(projectId) as SourceRow[]
    return rows.map(rowToSource)
  }

  getNotes(projectId: string): ResearchNote[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM research_notes WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as NoteRow[]
    return rows.map(rowToNote)
  }

  async synthesizeNotes(projectId: string): Promise<ResearchNote> {
    const db = getDatabase()
    const sources = this.getSources(projectId)

    if (sources.length === 0) {
      throw new Error('No sources to synthesize')
    }

    const sourceText = sources
      .map((s, i) => `[Source ${i + 1}] ${s.title || s.url}\n${s.snippet || '(no content)'}`)
      .join('\n\n')

    const messages: ChatMessage[] = [
      { role: 'system', content: SYNTHESIZE_PROMPT },
      { role: 'user', content: `Research topic and sources:\n\n${sourceText}` },
    ]

    const rawText = await this.router.chatSync(messages)

    let notesContent: string
    let citations: string
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)
      notesContent = parsed.notes || rawText
      citations = typeof parsed.citations === 'string' ? parsed.citations : JSON.stringify(parsed.citations || sources)
    } catch {
      notesContent = rawText
      citations = JSON.stringify(sources)
    }

    const note: ResearchNote = {
      id: randomUUID(),
      projectId,
      content: notesContent,
      citations,
      createdAt: Date.now(),
    }

    db.prepare(
      'INSERT INTO research_notes (id, project_id, content, citations, created_at) VALUES (@id, @projectId, @content, @citations, @createdAt)'
    ).run(note)

    db.prepare('UPDATE research_projects SET updated_at = ? WHERE id = ?').run(Date.now(), projectId)

    return note
  }

  exportNotes(projectId: string): string {
    const db = getDatabase()
    const project = db.prepare('SELECT * FROM research_projects WHERE id = ?').get(projectId) as ProjectRow | undefined
    if (!project) throw new Error('Project not found')

    const sources = this.getSources(projectId)
    const notes = this.getNotes(projectId)

    let output = `# ${project.name}\n\n**Topic:** ${project.topic}\n**Created:** ${new Date(project.created_at).toLocaleDateString()}\n\n`

    if (sources.length > 0) {
      output += `## Sources\n\n`
      for (const s of sources) {
        output += `- [${s.title || s.url}](${s.url})${s.snippet ? `\n  > ${s.snippet.slice(0, 200)}` : ''}\n`
      }
      output += '\n'
    }

    if (notes.length > 0) {
      output += `## Notes\n\n`
      for (const n of notes) {
        output += `### ${new Date(n.createdAt).toLocaleString()}\n\n${n.content}\n\n`
      }
    }

    return output
  }
}

interface ProjectRow {
  id: string
  name: string
  topic: string
  created_at: number
  updated_at: number
}

interface SourceRow {
  id: string
  project_id: string
  url: string
  title: string | null
  snippet: string | null
  added_at: number
}

interface NoteRow {
  id: string
  project_id: string
  content: string
  citations: string
  created_at: number
}

function rowToProject(row: ProjectRow): ResearchProject {
  return { id: row.id, name: row.name, topic: row.topic, createdAt: row.created_at, updatedAt: row.updated_at }
}

function rowToSource(row: SourceRow): ResearchSource {
  return {
    id: row.id,
    projectId: row.project_id,
    url: row.url,
    title: row.title ?? undefined,
    snippet: row.snippet ?? undefined,
    addedAt: row.added_at,
  }
}

function rowToNote(row: NoteRow): ResearchNote {
  return { id: row.id, projectId: row.project_id, content: row.content, citations: row.citations, createdAt: row.created_at }
}
