import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../server/src/app";
import { addUser } from "../server/src/auth";
import { loadConfig } from "../server/src/config";
import { openDb } from "../server/src/db";

const TOKEN = "t".repeat(40);
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const event = (over: Record<string, unknown> = {}) => ({ id: uuid(), study: "demo-study", ts: "2026-11-15T10:00:00.000Z", type: "session.start", session_id: "S", ...over });

async function start(auth: { enabled: boolean; ingestToken: string | null; loopback: boolean }) {
  const db = openDb(":memory:");
  addUser(db, "analyst", "correct horse battery", "viewer");
  const { app } = createApp({ db, auth, secureCookies: false });
  const server: Server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { db, server, base };
}

describe("secured deployment mode", () => {
  let ctx: Awaited<ReturnType<typeof start>>;
  beforeAll(async () => { ctx = await start({ enabled: true, ingestToken: TOKEN, loopback: false }); });
  afterAll(() => ctx.server.close());
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(ctx.base + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

  it("rejects unauthenticated reads and the stream", async () => {
    expect((await fetch(ctx.base + "/api/studies")).status).toBe(401);
    expect((await fetch(ctx.base + "/api/stream")).status).toBe(401);
    expect((await fetch(ctx.base + "/api/studies/demo-study/document?path=outputs/x.md")).status).toBe(401);
  });

  it("rejects ingest without or with a wrong token", async () => {
    expect((await post("/api/ingest/events", { events: [event()] })).status).toBe(401);
    expect((await post("/api/ingest/events", { events: [event()] }, { Authorization: "Bearer wrong" })).status).toBe(401);
  });

  it("accepts ingest with the token, idempotently", async () => {
    const e = event();
    const auth = { Authorization: `Bearer ${TOKEN}` };
    const r1 = await (await post("/api/ingest/events", { events: [e] }, auth)).json();
    const r2 = await (await post("/api/ingest/events", { events: [e] }, auth)).json();
    expect(r1).toEqual({ accepted: 1, duplicates: 0 });
    expect(r2).toEqual({ accepted: 0, duplicates: 1 });
  });

  it("validates events and document paths (no traversal, no arbitrary dirs)", async () => {
    const auth = { Authorization: `Bearer ${TOKEN}` };
    expect((await post("/api/ingest/events", { events: [{ ...event(), ts: "yesterday" }] }, auth)).status).toBe(400);
    const doc = (path: string) => ({ study: "demo-study", path, sha256: "a".repeat(64), content: "x" });
    expect((await post("/api/ingest/documents", { documents: [doc("../etc/passwd")] }, auth)).status).toBe(400);
    expect((await post("/api/ingest/documents", { documents: [doc("research/../../x.md")] }, auth)).status).toBe(400);
    expect((await post("/api/ingest/documents", { documents: [doc("inputs/confidential/a.md")] }, auth)).status).toBe(400);
    expect((await post("/api/ingest/documents", { documents: [doc("outputs/04_recommendation.md")] }, auth)).status).toBe(200);
  });

  it("logs in with a session cookie, then reads; bad passwords fail", async () => {
    expect((await post("/api/auth/login", { username: "analyst", password: "nope" })).status).toBe(401);
    expect((await post("/api/auth/login", { username: "ghost", password: "correct horse battery" })).status).toBe(401);
    const r = await post("/api/auth/login", { username: "analyst", password: "correct horse battery" });
    expect(r.status).toBe(200);
    const cookie = r.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    const studies = await (await fetch(ctx.base + "/api/studies", { headers: { Cookie: cookie.split(";")[0] } })).json();
    expect(studies[0].slug).toBe("demo-study");
    const me = await (await fetch(ctx.base + "/api/auth/me", { headers: { Cookie: cookie.split(";")[0] } })).json();
    expect(me.user).toEqual({ username: "analyst", role: "viewer" });
  });

  it("sets security headers", async () => {
    const r = await fetch(ctx.base + "/api/health");
    expect(r.headers.get("x-frame-options")).toBe("DENY");
    expect(r.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("local loopback mode", () => {
  let ctx: Awaited<ReturnType<typeof start>>;
  beforeAll(async () => { ctx = await start({ enabled: false, ingestToken: null, loopback: true }); });
  afterAll(() => ctx.server.close());

  it("streams a notification when events are ingested, then serves derived state", async () => {
    const ac = new AbortController();
    const res = await fetch(ctx.base + "/api/stream?study=demo-study", { signal: ac.signal });
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const until = async (s: string) => { while (!buf.includes(s)) buf += dec.decode((await reader.read()).value); };
    await until("event: hello");
    await fetch(ctx.base + "/api/ingest/events", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: [event({ type: "study.activate", data: { name: "Demo", kind: "validation" } }), event({ type: "task.assign", agent: "syndications", data: { stage: "cross-review", title: "Review" } })] }) });
    await until("event: studio");
    ac.abort();
    const st = await (await fetch(ctx.base + "/api/studies/demo-study")).json();
    expect(st.study.name).toBe("Demo");
    expect(st.recordingActive).toBe(true);
    expect(st.agents.find((a: { name: string }) => a.name === "syndications").status).toBe("Waiting");
  });

  it("exports a bundle that can be re-imported into another server", async () => {
    const bundle = await (await fetch(ctx.base + "/api/studies/demo-study/export")).json();
    expect(bundle.format).toBe("feasibility-studio-bundle/1");
    const other = await start({ enabled: false, ingestToken: null, loopback: true });
    const r = await (await fetch(other.base + "/api/ingest/bundle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bundle) })).json();
    expect(r.events).toBe(bundle.events.length);
    other.server.close();
  });
});

describe("startup safety", () => {
  it("refuses to disable auth on a public interface", () => {
    expect(() => loadConfig({ HOST: "0.0.0.0", STUDIO_AUTH: "off", STUDIO_INGEST_TOKEN: TOKEN })).toThrow(/cannot be disabled/);
  });
  it("requires an ingest token on a public interface", () => {
    expect(() => loadConfig({ HOST: "0.0.0.0" })).toThrow(/STUDIO_INGEST_TOKEN/);
  });
  it("rejects short ingest tokens", () => {
    expect(() => loadConfig({ HOST: "0.0.0.0", STUDIO_INGEST_TOKEN: "short" })).toThrow(/32/);
  });
  it("defaults to secure, auth-required settings off loopback", () => {
    const c = loadConfig({ HOST: "0.0.0.0", STUDIO_INGEST_TOKEN: TOKEN });
    expect(c).toMatchObject({ authEnabled: true, secureCookies: true, allowFraming: false });
  });
});
