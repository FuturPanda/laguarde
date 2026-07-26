import type { Database } from "./database.js";

function ensureColumn(
  db: Database,
  table: "contexts" | "guidelines" | "proposals",
  column: string,
  declaration: string,
): void {
  const columns = db
    .query<{ name: string }, []>(`PRAGMA table_info(${table})`)
    .all();
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration}`);
  }
}

export function initializeSchema(db: Database): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS guidelines (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      summary TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      context_tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      current_revision_id TEXT,
      fields TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS guideline_revisions (
      id TEXT PRIMARY KEY,
      guideline_id TEXT NOT NULL REFERENCES guidelines(id),
      revision_no INTEGER NOT NULL,
      body TEXT NOT NULL,
      fields TEXT NOT NULL DEFAULT '{}',
      rationale TEXT,
      author TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(guideline_id, revision_no)
    );

    CREATE TABLE IF NOT EXISTS contexts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      active_kinds TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      context_id TEXT NOT NULL REFERENCES contexts(id),
      request_json TEXT NOT NULL,
      evaluation_json TEXT NOT NULL,
      decision_level TEXT NOT NULL,
      state TEXT NOT NULL,
      reviewed_by TEXT,
      review_note TEXT,
      related_guideline_revisions TEXT NOT NULL DEFAULT '[]',
      next_action TEXT NOT NULL,
      created_at TEXT NOT NULL,
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      scope_kind TEXT NOT NULL,
      scope_id TEXT REFERENCES guidelines(id),
      title TEXT NOT NULL,
      suggested_edit TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending',
      convergence_count INTEGER NOT NULL DEFAULT 1,
      proposed_by TEXT NOT NULL DEFAULT '[]',
      reviewed_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS proposal_observations (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL REFERENCES proposals(id),
      observation TEXT NOT NULL,
      proposed_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_guidelines_kind_status
      ON guidelines(kind, status) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_decisions_created_at
      ON decisions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_proposals_state
      ON proposals(state);
  `);

  ensureColumn(db, "contexts", "repository_url", "TEXT");
  ensureColumn(db, "contexts", "root_path", "TEXT");
  ensureColumn(db, "contexts", "last_seen_at", "TEXT");
  ensureColumn(
    db,
    "guidelines",
    "project_id",
    "TEXT REFERENCES contexts(id)",
  );
  ensureColumn(
    db,
    "proposals",
    "project_id",
    "TEXT REFERENCES contexts(id)",
  );

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_contexts_repository_url
      ON contexts(repository_url) WHERE repository_url IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_contexts_root_path
      ON contexts(root_path) WHERE root_path IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_guidelines_project
      ON guidelines(project_id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_proposals_project_state
      ON proposals(project_id, state);
  `);
}
