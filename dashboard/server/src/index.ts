import { createApp } from "./app.js";
import { userCount } from "./auth.js";
import { loadConfig, readAgentDefs } from "./config.js";
import { openDb, upsertAgents } from "./db.js";

function main() {
  let cfg;
  try {
    cfg = loadConfig();
  } catch (e) {
    console.error(String((e as Error).message));
    process.exit(2);
  }
  const db = openDb(cfg.dbFile);
  if (cfg.authEnabled && userCount(db) === 0) {
    console.error("Refusing to start: authentication is required but no users exist.\n" +
      "Create an admin first:  STUDIO_NEW_PASSWORD=... npm run user -- add <username> --role admin");
    process.exit(2);
  }
  if (cfg.repoDir) {
    const defs = readAgentDefs(cfg.repoDir);
    if (defs.length) upsertAgents(db, defs);
  }
  const { app } = createApp({
    db, auth: { enabled: cfg.authEnabled, ingestToken: cfg.ingestToken, loopback: cfg.host === "127.0.0.1" || cfg.host === "::1" || cfg.host === "localhost" },
    secureCookies: cfg.secureCookies, webDir: cfg.webDir, allowFraming: cfg.allowFraming,
  });
  app.listen(cfg.port, cfg.host, () => {
    console.log(`Feasibility Studio dashboard listening on http://${cfg.host}:${cfg.port}`);
    console.log(`  database: ${cfg.dbFile}`);
    console.log(`  browser auth: ${cfg.authEnabled ? "required" : "off (loopback only)"}; ingest token: ${cfg.ingestToken ? "configured" : "not set (loopback ingest only)"}`);
  });
}

main();
