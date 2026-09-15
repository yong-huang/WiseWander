import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import { DB_NAME } from '../../shared/constants'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), DB_NAME)
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  migrate(db)
  return db
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      favicon_url TEXT,
      parent_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES bookmarks(id)
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT,
      visit_count INTEGER DEFAULT 1,
      last_visit_time INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS downloads (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      filename TEXT NOT NULL,
      save_path TEXT NOT NULL,
      state TEXT NOT NULL,
      total_bytes INTEGER,
      received_bytes INTEGER,
      started_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS reading_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      excerpt TEXT,
      favicon_url TEXT,
      added_at INTEGER NOT NULL,
      source_url TEXT,
      ai_summary TEXT
    );

    CREATE TABLE IF NOT EXISTS interest_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      keywords TEXT NOT NULL,
      weight REAL DEFAULT 1.0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      sample_urls TEXT
    );

    CREATE TABLE IF NOT EXISTS recommendation_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      excerpt TEXT,
      favicon_url TEXT,
      source_type TEXT NOT NULL,
      interest_label TEXT,
      score REAL DEFAULT 0.0,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rec_cache_expires ON recommendation_cache(expires_at);

    -- Feature 5: Page Monitor
    CREATE TABLE IF NOT EXISTS monitored_pages (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      check_interval_ms INTEGER NOT NULL DEFAULT 300000,
      selector TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_checked_at INTEGER,
      last_content_hash TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS page_changes (
      id TEXT PRIMARY KEY,
      monitored_page_id TEXT NOT NULL,
      detected_at INTEGER NOT NULL,
      previous_hash TEXT,
      new_hash TEXT,
      diff_summary TEXT,
      previous_snapshot TEXT,
      new_snapshot TEXT,
      FOREIGN KEY (monitored_page_id) REFERENCES monitored_pages(id) ON DELETE CASCADE
    );

    -- Feature 6: Agent memory (docs/AGENT_EVOLUTION.md Phase 3)
    CREATE TABLE IF NOT EXISTS agent_runs (
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

    CREATE TABLE IF NOT EXISTS agent_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      iteration INTEGER NOT NULL,
      tool TEXT NOT NULL,
      input TEXT NOT NULL,
      status TEXT NOT NULL,
      output TEXT,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_agent_steps_run ON agent_steps(run_id);

    CREATE TABLE IF NOT EXISTS agent_site_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL,
      note TEXT NOT NULL,
      hits INTEGER DEFAULT 1,
      last_seen_at INTEGER NOT NULL,
      UNIQUE(domain, note)
    );

    -- Feature 4: Research Workbench
    CREATE TABLE IF NOT EXISTS research_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      topic TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS research_sources (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      snippet TEXT,
      added_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES research_projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS research_notes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      content TEXT NOT NULL,
      citations TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES research_projects(id) ON DELETE CASCADE
    );
  `)

  // Feature 3: Semantic Bookmark Search — add embedding column
  try {
    db.exec('ALTER TABLE bookmarks ADD COLUMN embedding BLOB')
  } catch {
    // Column already exists
  }

  // Page Monitor: keep the last raw content snapshot for AI diff summaries
  try {
    db.exec('ALTER TABLE monitored_pages ADD COLUMN last_content_snapshot TEXT')
  } catch {
    // Column already exists
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
