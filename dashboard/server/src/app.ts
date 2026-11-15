import express, { type Request, type Response } from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { compareRow, deriveStudy } from "../../shared/derive.js";
import type { StudioEvent, StudyState } from "../../shared/types.js";
import {
  COOKIE, type AuthOptions, type AuthedRequest, currentUser, login, loginAllowed, logout, readCookie,
  requireIngest, requireUser, requireUserOrToken,
} from "./auth.js";
import {
  type DB, getDocuments, insertEvents, listAgents, listDocuments, listEvents, listStudies, upsertAgents, upsertDocument,
} from "./db.js";

export interface AppOptions {
  db: DB;
  auth: AuthOptions;
  secureCookies: boolean;
  webDir?: string;
  allowFraming?: boolean;
}

const SLUG = /^[a-z0-9][a-z0-9-]{1,62}$/;
const eventSchema = z.object({
  id: z.string().uuid(), study: z.string().regex(SLUG), ts: z.string().datetime({ offset: true }),
  type: z.string().regex(/^[a-z]+\.[a-z_]+$/).max(40),
  session_id: z.string().max(100).optional(), agent: z.string().max(80).optional(),
  agent_run_id: z.string().max(100).optional(), tool_use_id: z.string().max(100).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});
const docSchema = z.object({
  study: z.string().regex(SLUG),
  path: z.string().max(400).regex(/^(research|outputs|models)\/[A-Za-z0-9 ._\/-]+$/).refine((p) => !p.includes("..")),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), agent: z.string().max(80).nullable().optional(),
  content: z.string().max(2_000_000), mtime: z.string().nullable().optional(),
});
const agentSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]{2,64}$/), title: z.string().max(200), description: z.string().max(2000),
  model: z.string().max(80), color: z.string().max(20), tools: z.string().max(1000),
});

/** In-process pub/sub for Server-Sent Events. */
class Hub {
  private clients = new Set<{ res: Response; study: string | null }>();
  add(res: Response, study: string | null) {
    const c = { res, study };
    this.clients.add(c);
    return () => this.clients.delete(c);
  }
  publish(study: string, payload: unknown) {
    const msg = `event: studio\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const c of this.clients) if (!c.study || c.study === study) c.res.write(msg);
  }
  get size() { return this.clients.size; }
}

export function studyState(db: DB, slug: string): StudyState | null {
  const study = listStudies(db).find((s) => s.slug === slug);
  if (!study) return null;
  const metas = listDocuments(db, slug);
  const contents = getDocuments(db, slug, (p) => p.endsWith(".csv") || p === "outputs/04_recommendation.md");
  const state = deriveStudy(study, listEvents(db, slug), metas, contents, listAgents(db));
  return { ...state, generatedAt: new Date().toISOString() };
}

export function createApp(opts: AppOptions) {
  const { db, auth } = opts;
  const app = express();
  const hub = new Hub();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback, linklocal, uniquelocal");

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; " +
      "base-uri 'none'; form-action 'self'" + (opts.allowFraming ? "" : "; frame-ancestors 'none'"));
    if (!opts.allowFraming) res.setHeader("X-Frame-Options", "DENY");
    next();
  });

  const user = requireUser(db, auth);
  const userOrToken = requireUserOrToken(db, auth);
  const ingest = requireIngest(auth);

  // ---------- health / auth ----------
  app.get("/api/health", (_req, res) => { res.json({ ok: true, authEnabled: auth.enabled }); });

  app.get("/api/auth/me", (req, res) => {
    const p = currentUser(db, auth, req);
    res.json({ authEnabled: auth.enabled, user: p });
  });

  app.post("/api/auth/login", express.json({ limit: "10kb" }), (req, res) => {
    if (!auth.enabled) return res.json({ ok: true });
    if (!loginAllowed(req.ip ?? "unknown")) return res.status(429).json({ error: "too many attempts; try again later" });
    const body = z.object({ username: z.string().max(64), password: z.string().max(256) }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid request" });
    const token = login(db, body.data.username, body.data.password);
    if (!token) return res.status(401).json({ error: "invalid credentials" });
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: "strict", secure: opts.secureCookies, path: "/", maxAge: 12 * 3600_000 });
    res.json({ ok: true });
  });

  app.post("/api/auth/logout", (req, res) => {
    const t = readCookie(req, COOKIE);
    if (t) logout(db, t);
    res.clearCookie(COOKIE, { path: "/" });
    res.json({ ok: true });
  });

  // ---------- ingest (hooks / CLI) ----------
  app.post("/api/ingest/events", ingest, express.json({ limit: "5mb" }), (req, res) => {
    const parsed = z.object({ events: z.array(eventSchema).max(1000) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid events", issues: parsed.error.issues.slice(0, 5) });
    const fresh = insertEvents(db, parsed.data.events as StudioEvent[]);
    const studies = new Set(fresh.map((e) => e.study));
    for (const s of studies) hub.publish(s, { study: s, kind: "events", count: fresh.filter((e) => e.study === s).length });
    res.json({ accepted: fresh.length, duplicates: parsed.data.events.length - fresh.length });
  });

  app.post("/api/ingest/documents", ingest, express.json({ limit: "25mb" }), (req, res) => {
    const parsed = z.object({ documents: z.array(docSchema).max(100) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid documents", issues: parsed.error.issues.slice(0, 5) });
    let changed = 0;
    for (const d of parsed.data.documents) {
      if (upsertDocument(db, d)) { changed++; hub.publish(d.study, { study: d.study, kind: "document", path: d.path }); }
    }
    res.json({ stored: parsed.data.documents.length, changed });
  });

  app.post("/api/ingest/agents", ingest, express.json({ limit: "1mb" }), (req, res) => {
    const parsed = z.object({ agents: z.array(agentSchema).max(50) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid agents" });
    upsertAgents(db, parsed.data.agents);
    res.json({ stored: parsed.data.agents.length });
  });

  app.post("/api/ingest/bundle", ingest, express.json({ limit: "200mb" }), (req, res) => {
    const parsed = z.object({
      events: z.array(eventSchema), documents: z.array(docSchema), agents: z.array(agentSchema).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid bundle" });
    if (parsed.data.agents) upsertAgents(db, parsed.data.agents);
    const fresh = insertEvents(db, parsed.data.events as StudioEvent[]);
    let docs = 0;
    for (const d of parsed.data.documents) if (upsertDocument(db, d)) docs++;
    res.json({ events: fresh.length, documents: docs });
  });

  // ---------- read API ----------
  app.get("/api/studies", user, (_req, res) => { res.json(listStudies(db)); });

  app.get("/api/studies/:slug", userOrToken, (req, res) => {
    const st = studyState(db, String(req.params.slug));
    if (!st) return res.status(404).json({ error: "study not found" });
    res.json(st);
  });

  app.get("/api/studies/:slug/events", user, (req, res) => {
    const evs = listEvents(db, String(req.params.slug));
    res.json(evs);
  });

  app.get("/api/studies/:slug/documents", user, (req, res) => { res.json(listDocuments(db, String(req.params.slug))); });

  app.get("/api/studies/:slug/document", user, (req, res) => {
    const path = String(req.query.path ?? "");
    const doc = getDocuments(db, String(req.params.slug), (p) => p === path)[0];
    if (!doc) return res.status(404).json({ error: "document not found" });
    res.json(doc);
  });

  app.get("/api/compare", user, (req, res) => {
    const slugs = String(req.query.studies ?? "").split(",").filter((s) => SLUG.test(s)).slice(0, 6);
    const rows = slugs.flatMap((s) => {
      const st = studyState(db, s);
      if (!st) return [];
      const docs = new Map(getDocuments(db, s, (p) => p.startsWith("outputs/") && p.endsWith(".csv")).map((d) => [d.path, d]));
      return [compareRow(st, docs)];
    });
    res.json(rows);
  });

  app.get("/api/studies/:slug/export", userOrToken, (req, res) => {
    const slug = String(req.params.slug);
    const study = listStudies(db).find((s) => s.slug === slug);
    if (!study) return res.status(404).json({ error: "study not found" });
    res.setHeader("Content-Disposition", `attachment; filename="${slug}-bundle.json"`);
    res.json({
      format: "feasibility-studio-bundle/1", exportedAt: new Date().toISOString(), study,
      agents: listAgents(db), events: listEvents(db, slug).map(({ received_at: _r, ...e }) => e),
      documents: getDocuments(db, slug).map(({ study: s, path, sha256, agent, content, mtime }) => ({ study: s, path, sha256, agent, content, mtime })),
    });
  });

  // ---------- live stream ----------
  app.get("/api/stream", user, (req: AuthedRequest, res) => {
    const study = typeof req.query.study === "string" && SLUG.test(req.query.study) ? req.query.study : null;
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    res.write(`event: hello\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`);
    const remove = hub.add(res, study);
    // Transport keep-alive comment only (keeps proxies from closing the socket). It carries no status.
    const ka = setInterval(() => res.write(": keep-alive\n\n"), 25_000);
    req.on("close", () => { clearInterval(ka); remove(); });
  });

  // ---------- static web app ----------
  if (opts.webDir && existsSync(join(opts.webDir, "index.html"))) {
    app.use(express.static(opts.webDir, { index: false, maxAge: 0 }));
    app.get(/^(?!\/api\/).*/, (_req: Request, res: Response) => res.sendFile(join(opts.webDir!, "index.html")));
  }
  return { app, hub };
}
