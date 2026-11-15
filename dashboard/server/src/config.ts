import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentDef } from "../../shared/types.js";

/** dashboard/ directory (works from src via tsx and from compiled dist). */
export function dashboardDir(): string {
  let d = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(d, "vite.config.ts")) && existsSync(join(d, "package.json"))) return d;
    d = dirname(d);
  }
  throw new Error("cannot locate dashboard directory");
}

export const isLoopback = (host: string) => ["127.0.0.1", "::1", "localhost"].includes(host);

export interface ServerConfig {
  host: string;
  port: number;
  dbFile: string;
  authEnabled: boolean;
  ingestToken: string | null;
  secureCookies: boolean;
  allowFraming: boolean;
  repoDir: string | null;
  webDir: string;
}

function readToken(env: NodeJS.ProcessEnv): string | null {
  if (env.STUDIO_INGEST_TOKEN) return env.STUDIO_INGEST_TOKEN.trim();
  const f = env.STUDIO_INGEST_TOKEN_FILE;
  if (f && existsSync(f)) return readFileSync(f, "utf8").trim() || null;
  return null;
}

export function loadConfig(env = process.env): ServerConfig {
  const dash = dashboardDir();
  const repoGuess = resolve(dash, "..");
  const repoDir = env.STUDIO_REPO_DIR ?? (existsSync(join(repoGuess, ".claude", "agents")) ? repoGuess : null);
  const host = env.HOST ?? "127.0.0.1";
  const loop = isLoopback(host);
  const authMode = env.STUDIO_AUTH ?? (loop ? "off" : "required");
  if (authMode !== "off" && authMode !== "required") throw new Error("STUDIO_AUTH must be 'off' or 'required'");
  if (authMode === "off" && !loop) {
    throw new Error("Refusing to start: browser authentication cannot be disabled on a non-loopback address. Set STUDIO_AUTH=required.");
  }
  const ingestToken = readToken(env);
  if (!loop && !ingestToken) {
    throw new Error("Refusing to start: STUDIO_INGEST_TOKEN (or STUDIO_INGEST_TOKEN_FILE) is required when listening on a non-loopback address.");
  }
  if (ingestToken && ingestToken.length < 32) throw new Error("STUDIO_INGEST_TOKEN must be at least 32 characters");
  return {
    host,
    port: Number(env.PORT ?? 4317),
    dbFile: env.STUDIO_DB ?? join(repoDir ?? dash, ".studio", "studio.db"),
    authEnabled: authMode === "required",
    ingestToken,
    secureCookies: env.STUDIO_SECURE_COOKIES ? env.STUDIO_SECURE_COOKIES === "true" : !loop,
    allowFraming: env.STUDIO_ALLOW_FRAMING ? env.STUDIO_ALLOW_FRAMING === "true" : loop,
    repoDir,
    webDir: env.STUDIO_WEB_DIR ?? join(dash, "dist", "web"),
  };
}

/** Parse .claude/agents/*.md frontmatter so agent cards show the configured definitions. */
export function readAgentDefs(repoDir: string): AgentDef[] {
  const dir = join(repoDir, ".claude", "agents");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md")).flatMap((f) => {
    const text = readFileSync(join(dir, f), "utf8");
    const m = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/.exec(text);
    if (!m) return [];
    const fm: Record<string, string> = {};
    for (const line of m[1].split("\n")) {
      const i = line.indexOf(":");
      if (i > 0 && !line.startsWith(" ")) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    const title = /You are (?:the )?\*\*(.+?)\*\*/.exec(m[2])?.[1];
    const name = fm.name ?? f.replace(/\.md$/, "");
    return [{ name, title: title ?? name, description: fm.description ?? "", model: fm.model ?? "inherit", color: fm.color ?? "", tools: fm.tools ?? "" }];
  });
}
