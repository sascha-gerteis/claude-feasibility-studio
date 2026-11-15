// Durable store: a single SQLite file (Node's built-in node:sqlite, no native build step).
// Events are append-only and idempotent by id; documents keep every distinct version.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AgentDef, DocumentMeta, DocumentRec, StudioEvent, StudySummary } from "../../shared/types.js";

export type DB = DatabaseSync;

export function openDb(file: string): DB {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS studies (
      slug TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT, kind TEXT NOT NULL DEFAULT 'study',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, study TEXT NOT NULL, ts TEXT NOT NULL, type TEXT NOT NULL,
      session_id TEXT, agent TEXT, agent_run_id TEXT, tool_use_id TEXT, data TEXT,
      received_at TEXT NOT NULL, seq INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS events_study_ts ON events (study, ts);
    CREATE TABLE IF NOT EXISTS documents (
      study TEXT NOT NULL, path TEXT NOT NULL, sha256 TEXT NOT NULL, agent TEXT, size INTEGER NOT NULL,
      mtime TEXT, content TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (study, path)
    );
    CREATE TABLE IF NOT EXISTS document_versions (
      study TEXT NOT NULL, path TEXT NOT NULL, sha256 TEXT NOT NULL, content TEXT NOT NULL,
      recorded_at TEXT NOT NULL, PRIMARY KEY (study, path, sha256)
    );
    CREATE TABLE IF NOT EXISTS agents (
      name TEXT PRIMARY KEY, title TEXT, description TEXT, model TEXT, color TEXT, tools TEXT, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY, pass_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','viewer')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
  `);
  return db;
}

const nowIso = () => new Date().toISOString();

export function ensureStudy(db: DB, slug: string, name?: string, location?: string | null, kind?: string) {
  const row = db.prepare("SELECT slug FROM studies WHERE slug = ?").get(slug);
  if (!row) {
    db.prepare("INSERT INTO studies (slug, name, location, kind, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(slug, name ?? slug, location ?? null, kind === "validation" ? "validation" : "study", nowIso());
  } else if (name) {
    db.prepare("UPDATE studies SET name = ?, location = COALESCE(?, location), kind = COALESCE(?, kind) WHERE slug = ?")
      .run(name, location ?? null, kind === "validation" || kind === "study" ? kind : null, slug);
  }
}

/** Insert events; returns those that were new (duplicates by id are ignored). */
export function insertEvents(db: DB, events: StudioEvent[]): StudioEvent[] {
  const fresh: StudioEvent[] = [];
  const ins = db.prepare(`INSERT OR IGNORE INTO events
    (id, study, ts, type, session_id, agent, agent_run_id, tool_use_id, data, received_at, seq)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(seq),0)+1 FROM events))`);
  db.exec("BEGIN");
  try {
    for (const e of events) {
      if (e.type === "study.activate") {
        const d = e.data ?? {};
        ensureStudy(db, e.study, d.name as string | undefined, d.location as string | undefined, d.kind as string | undefined);
      } else {
        ensureStudy(db, e.study);
      }
      const received = nowIso();
      const r = ins.run(e.id, e.study, e.ts, e.type, e.session_id ?? null, e.agent ?? null, e.agent_run_id ?? null,
        e.tool_use_id ?? null, e.data ? JSON.stringify(e.data) : null, received);
      if (Number(r.changes) > 0) fresh.push({ ...e, received_at: received });
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return fresh;
}

type Row = Record<string, unknown>;
const toEvent = (r: Row): StudioEvent => ({
  id: r.id as string, study: r.study as string, ts: r.ts as string, type: r.type as string,
  session_id: (r.session_id as string) ?? undefined, agent: (r.agent as string) ?? undefined,
  agent_run_id: (r.agent_run_id as string) ?? undefined, tool_use_id: (r.tool_use_id as string) ?? undefined,
  data: r.data ? JSON.parse(r.data as string) : undefined, received_at: r.received_at as string,
});

export function listEvents(db: DB, study: string): StudioEvent[] {
  return (db.prepare("SELECT * FROM events WHERE study = ? ORDER BY ts, seq").all(study) as Row[]).map(toEvent);
}

export function upsertDocument(db: DB, d: { study: string; path: string; sha256: string; agent?: string | null; content: string; mtime?: string | null }): boolean {
  ensureStudy(db, d.study);
  const cur = db.prepare("SELECT sha256, agent FROM documents WHERE study = ? AND path = ?").get(d.study, d.path) as Row | undefined;
  const now = nowIso();
  db.prepare("INSERT OR IGNORE INTO document_versions (study, path, sha256, content, recorded_at) VALUES (?, ?, ?, ?, ?)")
    .run(d.study, d.path, d.sha256, d.content, now);
  if (cur && cur.sha256 === d.sha256) {
    if (d.agent && !cur.agent) db.prepare("UPDATE documents SET agent = ? WHERE study = ? AND path = ?").run(d.agent, d.study, d.path);
    return false;
  }
  db.prepare(`INSERT INTO documents (study, path, sha256, agent, size, mtime, content, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (study, path) DO UPDATE SET sha256 = excluded.sha256, agent = COALESCE(excluded.agent, documents.agent),
      size = excluded.size, mtime = excluded.mtime, content = excluded.content, updated_at = excluded.updated_at`)
    .run(d.study, d.path, d.sha256, d.agent ?? null, Buffer.byteLength(d.content), d.mtime ?? null, d.content, now);
  return true;
}

export function listDocuments(db: DB, study: string): DocumentMeta[] {
  return (db.prepare(`SELECT d.study, d.path, d.sha256, d.agent, d.size, d.mtime, d.updated_at,
      (SELECT COUNT(*) FROM document_versions v WHERE v.study = d.study AND v.path = d.path) AS versions
      FROM documents d WHERE d.study = ? ORDER BY d.path`).all(study) as Row[]).map((r) => ({
    study: r.study as string, path: r.path as string, sha256: r.sha256 as string, agent: (r.agent as string) ?? null,
    size: Number(r.size), mtime: (r.mtime as string) ?? null, updatedAt: r.updated_at as string, versions: Number(r.versions),
  }));
}

export function getDocuments(db: DB, study: string, pred: (path: string) => boolean = () => true): DocumentRec[] {
  return (db.prepare(`SELECT d.*, (SELECT COUNT(*) FROM document_versions v WHERE v.study = d.study AND v.path = d.path) AS versions
      FROM documents d WHERE d.study = ?`).all(study) as Row[])
    .filter((r) => pred(r.path as string))
    .map((r) => ({
      study: r.study as string, path: r.path as string, sha256: r.sha256 as string, agent: (r.agent as string) ?? null,
      size: Number(r.size), mtime: (r.mtime as string) ?? null, updatedAt: r.updated_at as string,
      versions: Number(r.versions), content: r.content as string,
    }));
}

export function upsertAgents(db: DB, agents: AgentDef[]) {
  const st = db.prepare(`INSERT INTO agents (name, title, description, model, color, tools, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (name) DO UPDATE SET title = excluded.title, description = excluded.description, model = excluded.model,
    color = excluded.color, tools = excluded.tools, updated_at = excluded.updated_at`);
  for (const a of agents) st.run(a.name, a.title, a.description, a.model, a.color, a.tools, nowIso());
}

export function listAgents(db: DB): AgentDef[] {
  return db.prepare("SELECT name, title, description, model, color, tools FROM agents").all() as unknown as AgentDef[];
}

export function listStudies(db: DB): StudySummary[] {
  const rows = db.prepare(`SELECT s.*, 
      (SELECT MIN(ts) FROM events e WHERE e.study = s.slug) AS first_ts,
      (SELECT MAX(ts) FROM events e WHERE e.study = s.slug) AS last_ts,
      (SELECT COUNT(*) FROM events e WHERE e.study = s.slug) AS n_events,
      (SELECT COUNT(*) FROM documents d WHERE d.study = s.slug) AS n_docs,
      (SELECT type FROM events e WHERE e.study = s.slug AND type IN ('study.activate','study.deactivate') ORDER BY ts DESC, seq DESC LIMIT 1) AS last_rec
      FROM studies s ORDER BY last_ts DESC`).all() as Row[];
  return rows.map((r) => ({
    slug: r.slug as string, name: r.name as string, location: (r.location as string) ?? null,
    kind: (r.kind as "study" | "validation") ?? "study", createdAt: r.created_at as string,
    firstEventAt: (r.first_ts as string) ?? null, lastEventAt: (r.last_ts as string) ?? null,
    eventCount: Number(r.n_events), documentCount: Number(r.n_docs), active: r.last_rec === "study.activate",
  }));
}
