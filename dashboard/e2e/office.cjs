// Visual + interaction checks of the research office against a running server.
// Usage: BASE=http://127.0.0.1:4317 SLUG=<study> OUT=docs/screenshots/v2 node e2e/office.cjs
const { chromium, devices } = require("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:4317";
const SLUG = process.env.SLUG ?? "validation-smoke-2026-11-15";
const OUT = process.env.OUT ?? "docs/screenshots/v2";
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const watch = (p) => { p.on("pageerror", (e) => errors.push(String(e))); p.on("console", (m) => m.type() === "error" && errors.push(m.text())); };
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  watch(p);
  await p.goto(`${BASE}/studies/${SLUG}`);
  await p.locator("article").first().waitFor();
  const cards = await p.locator("article").count();
  // keyboard: Tab to the first character card and open it with Enter
  for (let i = 0; i < 12 && !(await p.evaluate(() => document.activeElement?.getAttribute("aria-label")?.includes("Open details"))); i++) await p.keyboard.press("Tab");
  await p.keyboard.press("Enter");
  await p.getByRole("dialog").waitFor();
  const dialogTitle = await p.getByRole("dialog").getAttribute("aria-label");
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/agent-drawer.png` });
  await p.keyboard.press("Escape");
  await p.getByRole("dialog").waitFor({ state: "detached" });
  for (const [path, name] of [["agents", "agents"], ["findings", "findings"], ["final", "final-report"], ["technical", "technical"]]) {
    await p.goto(`${BASE}/studies/${SLUG}/${path}`);
    await p.locator("main h1").first().waitFor();
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  }
  // mobile + reduced motion
  const m = await b.newContext({ ...devices["iPhone 13"], reducedMotion: "reduce" });
  const mp = await m.newPage();
  watch(mp);
  await mp.goto(`${BASE}/studies/${SLUG}`);
  await mp.locator("article").first().waitFor();
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const animating = await mp.evaluate(() => [...document.querySelectorAll(".office-anim *")].filter((e) => getComputedStyle(e).animationName !== "none").length);
  await mp.screenshot({ path: `${OUT}/mobile.png`, fullPage: false });
  console.log(JSON.stringify({ cards, dialogTitle, mobileHorizontalOverflowPx: overflow, animatedElementsUnderReducedMotion: animating, errors }));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
