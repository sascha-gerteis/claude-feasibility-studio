// Captures the dashboard while a real orchestration session is running.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 1250 }, deviceScaleFactor: 1 });
  await p.goto("http://127.0.0.1:4317/studies/validation-smoke-2026-11-15");
  await p.getByText("LIVE", { exact: true }).waitFor({ timeout: 240000 });
  await p.locator("text=Working").first().waitFor({ timeout: 240000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "docs/screenshots/live-command-center.png", fullPage: true });
  const banner = await p.locator("[role=status]").innerText();
  const working = await p.locator("article").filter({ hasText: "Working" }).count();
  console.log("BANNER:", banner.replace(/\s+/g, " "));
  console.log("cards showing Working:", working);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
