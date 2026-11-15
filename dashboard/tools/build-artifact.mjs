// Builds the hosted (claude.ai artifact) page: one HTML file with the app's CSS and JS inlined.
// The artifact contract wraps the file in its own <!doctype>/<head>/<body>, so this emits only content.
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

execSync("npx vite build --mode artifact --outDir ../dist/artifact-build", { stdio: "inherit", env: { ...process.env, VITE_TARGET: "artifact" } });
const dir = "dist/artifact-build/assets";
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith(".js"));
const css = files.filter((f) => f.endsWith(".css"));
if (js.length !== 1) throw new Error(`expected one JS chunk, found ${js.join(", ")}`);
const script = readFileSync(join(dir, js[0]), "utf8").replace(/<\/script/gi, "<\\/script").replace(/\uFFFD/g, "\\uFFFD");
const style = css.map((f) => readFileSync(join(dir, f), "utf8")).join("\n").replace(/<\/style/gi, "<\\/style");
const page = `<title>Feasibility Studio Command Center</title>
<style>
:root { color-scheme: light; }
body { background: #f5f6f8; color: #1b2430; margin: 0; }
${style}
</style>
<div id="root"><p style="margin:24px;font:14px system-ui;color:#5b6676">Loading the Research Command Center…</p></div>
<script type="module">
${script}
</script>
`;
mkdirSync("dist/artifact", { recursive: true });
writeFileSync("dist/artifact/command-center.html", page);
console.log(`dist/artifact/command-center.html written (${(page.length / 1024).toFixed(0)} KB)`);
