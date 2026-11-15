// User administration:  npm run user -- add <username> --role admin|viewer   (password from STUDIO_NEW_PASSWORD)
//                        npm run user -- remove <username>
//                        npm run user -- list
import { addUser, removeUser } from "./auth.js";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";

const [cmd, username, ...rest] = process.argv.slice(2);
const cfg = loadConfig({ ...process.env, HOST: "127.0.0.1", STUDIO_AUTH: "off" });
const db = openDb(process.env.STUDIO_DB ?? cfg.dbFile);

if (cmd === "add" && username) {
  const role = rest[rest.indexOf("--role") + 1] === "viewer" ? "viewer" : "admin";
  const pw = process.env.STUDIO_NEW_PASSWORD;
  if (!pw) { console.error("Set STUDIO_NEW_PASSWORD (min 12 characters) in the environment; passwords are never taken as arguments."); process.exit(2); }
  addUser(db, username, pw, role);
  console.log(`user ${username} saved with role ${role}`);
} else if (cmd === "remove" && username) {
  removeUser(db, username);
  console.log(`user ${username} removed`);
} else if (cmd === "list") {
  for (const r of db.prepare("SELECT username, role, created_at FROM users ORDER BY username").all()) console.log(r);
} else {
  console.error("usage: add <username> --role admin|viewer | remove <username> | list");
  process.exit(2);
}
