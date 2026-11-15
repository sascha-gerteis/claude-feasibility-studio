// Authentication and access control.
//  * Browser users: username + password (scrypt), opaque session cookie (HttpOnly, SameSite=Strict,
//    Secure when served over HTTPS), sessions stored hashed server-side, 12-hour expiry.
//  * Roles: admin (everything) and viewer (read-only).
//  * Machine ingest (hooks / CLI): separate bearer token, constant-time comparison.
//  * Browser auth can only be disabled when the server listens on a loopback address.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { DB } from "./db.js";

const SESSION_HOURS = 12;
const SCRYPT = { N: 16384, r: 8, p: 1 } as const;
export const COOKIE = "studio_session";

export function hashPassword(password: string): string {
  if (password.length < 12) throw new Error("password must be at least 12 characters");
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, s, k] = stored.split("$");
  if (alg !== "scrypt" || !s || !k) return false;
  const key = Buffer.from(k, "base64");
  const got = scryptSync(password, Buffer.from(s, "base64"), key.length, SCRYPT);
  return key.length === got.length && timingSafeEqual(key, got);
}

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const DUMMY_HASH = hashPassword("timing-equaliser-password");

export function addUser(db: DB, username: string, password: string, role: "admin" | "viewer") {
  if (!/^[a-zA-Z0-9._@-]{2,64}$/.test(username)) throw new Error("invalid username");
  db.prepare(`INSERT INTO users (username, pass_hash, role, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (username) DO UPDATE SET pass_hash = excluded.pass_hash, role = excluded.role`)
    .run(username, hashPassword(password), role, new Date().toISOString());
}

export function removeUser(db: DB, username: string) {
  db.prepare("DELETE FROM users WHERE username = ?").run(username);
}

export function userCount(db: DB): number {
  return Number((db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n);
}

export function login(db: DB, username: string, password: string): string | null {
  const u = db.prepare("SELECT pass_hash FROM users WHERE username = ?").get(username) as { pass_hash: string } | undefined;
  // Unknown users still pay for one scrypt so response timing does not reveal valid usernames.
  const ok = verifyPassword(password, u?.pass_hash ?? DUMMY_HASH) && Boolean(u);
  if (!ok) return null;
  const token = randomBytes(32).toString("base64url");
  const exp = new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
  db.prepare("INSERT INTO sessions (token_hash, username, expires_at) VALUES (?, ?, ?)").run(sha(token), username, exp);
  return token;
}

export function logout(db: DB, token: string) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
}

export interface Principal { username: string; role: "admin" | "viewer"; }

export function sessionUser(db: DB, token: string | undefined): Principal | null {
  if (!token) return null;
  const r = db.prepare(`SELECT u.username, u.role, s.expires_at FROM sessions s JOIN users u ON u.username = s.username
    WHERE s.token_hash = ?`).get(sha(token)) as { username: string; role: "admin" | "viewer"; expires_at: string } | undefined;
  if (!r || r.expires_at < new Date().toISOString()) return null;
  return { username: r.username, role: r.role };
}

export function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** Fixed-window login limiter: 10 attempts per client per 15 minutes. */
const attempts = new Map<string, { n: number; reset: number }>();
export function loginAllowed(ip: string): boolean {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.reset < now) { attempts.set(ip, { n: 1, reset: now + 15 * 60_000 }); return true; }
  a.n += 1;
  return a.n <= 10;
}

export interface AuthOptions { enabled: boolean; ingestToken: string | null; loopback: boolean; }
export type AuthedRequest = Request & { principal?: Principal };

export function currentUser(db: DB, opts: AuthOptions, req: Request): Principal | null {
  if (!opts.enabled) return { username: "local", role: "admin" };
  return sessionUser(db, readCookie(req, COOKIE));
}

export function requireUser(db: DB, opts: AuthOptions, role: "viewer" | "admin" = "viewer") {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const p = currentUser(db, opts, req);
    if (!p) return res.status(401).json({ error: "authentication required" });
    if (role === "admin" && p.role !== "admin") return res.status(403).json({ error: "admin role required" });
    req.principal = p;
    next();
  };
}

/**
 * Hooks/CLI ingest. A configured bearer token is always required when present.
 * Without one, ingest is accepted only when the whole server is bound to loopback.
 * Read endpoints also accept the token so the CLI can query status and export bundles.
 */
export function bearerOk(req: Request, opts: AuthOptions): boolean {
  const h = req.headers.authorization ?? "";
  const tok = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (opts.ingestToken) return Boolean(tok) && safeEqual(tok, opts.ingestToken);
  return opts.loopback;
}

export function requireIngest(opts: AuthOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (bearerOk(req, opts)) return next();
    return res.status(401).json({ error: opts.ingestToken ? "invalid ingest token" : "ingest token not configured" });
  };
}

export function requireUserOrToken(db: DB, opts: AuthOptions) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const p = currentUser(db, opts, req);
    if (p) { req.principal = p; return next(); }
    if (opts.ingestToken && bearerOk(req, opts)) { req.principal = { username: "ingest-token", role: "viewer" }; return next(); }
    return res.status(401).json({ error: "authentication required" });
  };
}
