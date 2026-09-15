import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { AgentRunStore } from '../../../../../src/main/services/agent/run-store'

const SCHEMA = `
  CREATE TABLE agent_runs (
    id TEXT PRIMARY KEY,
    tab_url TEXT,
    goal TEXT NOT NULL,
    status TEXT NOT NULL,
    report TEXT,
    iterations INTEGER NOT NULL,
    prompt_chars INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER
  );
  CREATE TABLE agent_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    iteration INTEGER NOT NULL,
    tool TEXT NOT NULL,
    input TEXT NOT NULL,
    status TEXT NOT NULL,
    output TEXT,
    FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
  );
  CREATE TABLE agent_site_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    note TEXT NOT NULL,
    hits INTEGER DEFAULT 1,
    last_seen_at INTEGER NOT NULL,
    UNIQUE(domain, note)
  );
`

let store: AgentRunStore

beforeEach(() => {
  const db = new DatabaseSync(':memory:')
  db.exec(SCHEMA)
  store = new AgentRunStore(db)
})

describe('AgentRunStore', () => {
  it('persists a run with steps and reads it back as a detail', () => {
    const id = store.startRun('open the thing', 'https://example.com/')
    store.recordStep(id, 1, 'navigate', { url: 'https://example.com/x' }, 'done', { ok: true })
    store.recordStep(id, 2, 'click', { ref: 'e3' }, 'error', 'Element not found.')
    store.finishRun(id, 'completed', 'Opened the thing.', 2, 12_345)

    const detail = store.getRun(id)
    expect(detail).not.toBeNull()
    expect(detail?.goal).toBe('open the thing')
    expect(detail?.status).toBe('completed')
    expect(detail?.report).toBe('Opened the thing.')
    expect(detail?.promptChars).toBe(12_345)
    expect(detail?.steps).toHaveLength(2)
    expect(detail?.steps[0]).toMatchObject({
      iteration: 1,
      tool: 'navigate',
      input: { url: 'https://example.com/x' },
      status: 'done',
      output: { ok: true },
    })
    expect(detail?.steps[1].status).toBe('error')
  })

  it('lists runs newest first', async () => {
    const a = store.startRun('first')
    store.finishRun(a, 'completed', 'first done', 1, 100)
    await new Promise((r) => setTimeout(r, 10)) // started_at has ms resolution
    const b = store.startRun('second')
    store.finishRun(b, 'failed', 'blocked', 2, 200)

    const runs = store.listRuns()
    expect(runs).toHaveLength(2)
    expect(runs[0].goal).toBe('second')
    expect(runs[1].goal).toBe('first')
    expect(runs[0].report).toBe('blocked')
  })

  it('truncates oversized step output before persisting', () => {
    const id = store.startRun('big output')
    store.recordStep(id, 1, 'extract', {}, 'done', { text: 'x'.repeat(50_000) })
    const detail = store.getRun(id)
    const out = JSON.stringify(detail?.steps[0].output)
    expect(out.length).toBeLessThan(5_000)
  })

  it('reinforces site notes on repeat and prunes beyond the cap', () => {
    store.addSiteNote('example.com', 'search results live under [e2]')
    store.addSiteNote('example.com', 'search results live under [e2]') // hit again
    store.addSiteNote('example.com', 'checkout needs two clicks')
    store.addSiteNote('other.com', 'unrelated note')

    let notes = store.getSiteNotes('example.com')
    expect(notes).toEqual(['search results live under [e2]', 'checkout needs two clicks'])

    // push 5 more unique notes — the weakest should be pruned (cap = 5)
    for (let i = 0; i < 5; i++) store.addSiteNote('example.com', `filler note ${i}`)
    notes = store.getSiteNotes('example.com')
    expect(notes.length).toBeLessThanOrEqual(5)
    expect(notes[0]).toBe('search results live under [e2]') // 2 hits keep it on top
    expect(store.getSiteNotes('other.com')).toEqual(['unrelated note'])
  })

  it('returns null for an unknown run id', () => {
    expect(store.getRun('nope')).toBeNull()
  })
})
