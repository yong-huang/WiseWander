import type {
  AgentRunDetail,
  AgentRunSummary,
  AgentStep,
} from '../../../shared/types'
import {
  AGENT_STEP_OUTPUT_DB_CHARS,
  AGENT_SITE_NOTE_LIMIT,
} from '../../../shared/constants'
import { truncate } from './json-utils'

/**
 * Minimal DB surface used by the store — satisfied by better-sqlite3 in the
 * app and by node:sqlite (DatabaseSync) in unit tests (ABI-independence).
 */
export interface RunStoreDb {
  prepare(sql: string): {
    run(...args: unknown[]): unknown
    get(...args: unknown[]): unknown
    all(...args: unknown[]): unknown[]
  }
}

/**
 * Persists agent runs, their steps, and per-site experience notes
 * (docs/AGENT_EVOLUTION.md Phase 3).
 */
export class AgentRunStore {
  constructor(private db: RunStoreDb) {}

  startRun(goal: string, tabUrl?: string): string {
    const id = crypto.randomUUID()
    this.db
      .prepare(
        `INSERT INTO agent_runs (id, tab_url, goal, status, iterations, prompt_chars, started_at)
         VALUES (?, ?, ?, 'running', 0, 0, ?)`
      )
      .run(id, tabUrl ?? null, goal, Date.now())
    return id
  }

  recordStep(
    runId: string,
    iteration: number,
    tool: string,
    input: Record<string, unknown>,
    status: AgentStep['status'],
    output?: unknown
  ): void {
    this.db
      .prepare(
        `INSERT INTO agent_steps (run_id, iteration, tool, input, status, output)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        runId,
        iteration,
        tool,
        JSON.stringify(input),
        status,
        output === undefined ? null : truncate(JSON.stringify(output), AGENT_STEP_OUTPUT_DB_CHARS)
      )
  }

  updateStepStatus(
    runId: string,
    iteration: number,
    status: AgentStep['status'],
    output?: unknown
  ): void {
    this.db
      .prepare(
        `UPDATE agent_steps SET status = ?, output = ? WHERE run_id = ? AND iteration = ?`
      )
      .run(status, output === undefined ? null : truncate(JSON.stringify(output), AGENT_STEP_OUTPUT_DB_CHARS), runId, iteration)
  }

  finishRun(
    id: string,
    status: string,
    report: string,
    iterations: number,
    promptChars: number
  ): void {
    this.db
      .prepare(
        `UPDATE agent_runs
         SET status = ?, report = ?, iterations = ?, prompt_chars = ?, finished_at = ?
         WHERE id = ?`
      )
      .run(status, report, iterations, promptChars, Date.now(), id)
  }

  listRuns(limit: number = 20): AgentRunSummary[] {
    const rows = this.db
      .prepare(
        `SELECT id, goal, status, report, iterations, started_at, finished_at
         FROM agent_runs ORDER BY started_at DESC LIMIT ?`
      )
      .all(limit) as Array<Record<string, unknown>>
    return rows.map((r) => ({
      id: String(r.id),
      goal: String(r.goal),
      status: String(r.status),
      report: r.report === null ? undefined : String(r.report),
      iterations: Number(r.iterations),
      startedAt: Number(r.started_at),
      finishedAt: r.finished_at === null ? undefined : Number(r.finished_at),
    }))
  }

  getRun(id: string): AgentRunDetail | null {
    const run = this.db
      .prepare(
        `SELECT id, tab_url, goal, status, report, iterations, prompt_chars, started_at, finished_at
         FROM agent_runs WHERE id = ?`
      )
      .get(id) as Record<string, unknown> | undefined
    if (!run) return null

    const steps = (
      this.db
        .prepare(
          `SELECT iteration, tool, input, status, output
           FROM agent_steps WHERE run_id = ? ORDER BY iteration ASC`
        )
        .all(id) as Array<Record<string, unknown>>
    ).map((s) => ({
      iteration: Number(s.iteration),
      tool: String(s.tool),
      input: safeParse(String(s.input)),
      status: String(s.status),
      output: s.output === null ? undefined : safeParse(String(s.output)),
    }))

    return {
      id: String(run.id),
      tabUrl: run.tab_url === null ? undefined : String(run.tab_url),
      goal: String(run.goal),
      status: String(run.status),
      report: run.report === null ? undefined : String(run.report),
      iterations: Number(run.iterations),
      promptChars: Number(run.prompt_chars),
      startedAt: Number(run.started_at),
      finishedAt: run.finished_at === null ? undefined : Number(run.finished_at),
      steps,
    }
  }

  /** Record (or reinforce) a one-line experience note for a domain. */
  addSiteNote(domain: string, note: string): void {
    const compact = truncate(note.replace(/\s+/g, ' ').trim(), 200)
    if (!compact) return
    this.db
      .prepare(
        `INSERT INTO agent_site_notes (domain, note, hits, last_seen_at)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(domain, note) DO UPDATE SET hits = hits + 1, last_seen_at = ?`
      )
      .run(domain, compact, Date.now(), Date.now())
    // Prune: keep only the most-hit / most-recent notes per domain.
    this.db
      .prepare(
        `DELETE FROM agent_site_notes
         WHERE domain = ? AND id NOT IN (
           SELECT id FROM agent_site_notes WHERE domain = ?
           ORDER BY hits DESC, last_seen_at DESC LIMIT ?
         )`
      )
      .run(domain, domain, AGENT_SITE_NOTE_LIMIT)
  }

  getSiteNotes(domain: string, limit = 3): string[] {
    const rows = this.db
      .prepare(
        `SELECT note FROM agent_site_notes
         WHERE domain = ? ORDER BY hits DESC, last_seen_at DESC LIMIT ?`
      )
      .all(domain, limit) as Array<Record<string, unknown>>
    return rows.map((r) => String(r.note))
  }
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return json
  }
}
