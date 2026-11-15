// Screenshot tour of every view against the running local server (recorded data only).
const { chromium } = require("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:4317";
const SLUG = process.env.SLUG ?? "validation-smoke-2026-11-15";
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 1 });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const shot = async (name) => { await p.waitForTimeout(600); await p.screenshot({ path: `dashboard/docs/screenshots/tour-${name}.png`, fullPage: true }); };

  await p.goto(`${BASE}/studies/${SLUG}`);
  await p.locator("article").first().waitFor();
  await shot("command-center");
  await p.getByRole("button", { name: /Show all/ }).click();
  await p.getByRole("button", { name: "Errors", exact: true }).click();
  await shot("activity-feed-errors");

  await p.goto(`${BASE}/studies/${SLUG}/agents/real-estate-hospitality`);
  await p.getByText("Task ledger").waitFor();
  await shot("agent-detail-timeline");
  await p.getByRole("button", { name: /^Research/ }).first().click();
  await shot("agent-detail-research");
  await p.getByRole("button", { name: /^Sources/ }).first().click();
  await shot("agent-detail-sources");

  await p.goto(`${BASE}/studies/${SLUG}/reports?doc=${encodeURIComponent("research/00_director/smoke_check.md")}`);
  await p.getByText("Director smoke check").waitFor();
  await shot("reports");

  await p.goto(`${BASE}/studies`);
  const boxes = p.getByRole("checkbox");
  const n = await boxes.count();
  for (let i = 0; i < Math.min(n, 2); i++) await boxes.nth(i).check();
  if (n >= 2) await p.getByText("Comparison (from recorded").waitFor();
  await shot("studies-compare");

  console.log(JSON.stringify({ studies: n, consoleErrors: errors }));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
