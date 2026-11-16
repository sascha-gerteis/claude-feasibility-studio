// Pose fixture: ingests hook-shaped events into a THROWAWAY server (never the real store) so every
// pose can be screenshotted. Usage: BASE=http://127.0.0.1:4320 node e2e/poses.cjs
const { chromium } = require("playwright");
const { randomUUID } = require("node:crypto");
const BASE = process.env.BASE ?? "http://127.0.0.1:4320";
const S = "pose-fixture";
const t = (s) => `2026-11-15T12:00:${String(s).padStart(2, "0")}.000Z`;
const E = (type, s, f = {}) => ({ id: randomUUID(), study: S, ts: t(s), type, session_id: "FIX", ...f });
const events = [
  E("study.activate", 0, { data: { name: "Animation fixture (test harness)", kind: "validation" } }),
  E("session.start", 1),
  E("task.dispatch", 2, { agent: "investment-banking", tool_use_id: "a", data: { description: "[stage:independent-research] Financial appraisal", stage: "independent-research" } }),
  E("agent.start", 3, { agent: "investment-banking", agent_run_id: "r1" }),
  E("task.dispatch", 4, { agent: "syndications", tool_use_id: "b", data: { description: "[stage:cross-review] Review project-technology", stage: "cross-review" } }),
  E("agent.start", 5, { agent: "syndications", agent_run_id: "r2" }),
  E("task.assign", 6, { agent: "real-estate-hospitality", data: { stage: "independent-research", title: "Market demand and comparables" } }),
  E("task.dispatch", 7, { agent: "ai-strategy", tool_use_id: "c", data: { description: "x" } }),
  E("task.failure", 8, { agent: "ai-strategy", tool_use_id: "c", data: { error: "Agent call failed (fixture)" } }),
  E("task.dispatch", 9, { agent: "environmental-technologies", tool_use_id: "d", data: { description: "y" } }),
  E("agent.start", 10, { agent: "environmental-technologies", agent_run_id: "r4" }),
  E("agent.stop", 11, { agent: "environmental-technologies", agent_run_id: "r4" }),
];
(async () => {
  const r = await fetch(`${BASE}/api/ingest/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events }) });
  if (!r.ok) throw new Error(await r.text());
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`${BASE}/studies/${S}`);
  await p.locator("article").first().waitFor();
  await p.waitForTimeout(900);
  const poses = await p.$$eval("svg.office-anim", (els) => els.map((e) => [...e.classList].find((c) => c.startsWith("pose-"))));
  const animating = await p.evaluate(() => [...document.querySelectorAll(".pose-typing .arm-l, .pose-reviewing .doc")].map((e) => getComputedStyle(e).animationName));
  await p.screenshot({ path: "docs/screenshots/v2/poses-fixture.png", fullPage: true });
  console.log(JSON.stringify({ poses, animating }));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
