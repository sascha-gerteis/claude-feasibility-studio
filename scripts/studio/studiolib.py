"""Shared helpers for the Feasibility Studio event recorder (standard library only).

Recording model
---------------
* Claude Code hooks call ``hook.py``; ``studio.py`` is the operator CLI.
* Nothing is recorded unless a study is active (``.studio/active_study.json``).
* Every event is first appended to a local outbox (``.studio/outbox/<study>.jsonl``) and then
  forwarded to the dashboard server's ingest API. Delivery is idempotent (events carry UUIDs),
  so a failed or repeated send is safe; ``studio.py sync`` re-sends anything not yet acknowledged.
* Events are facts observed by hooks or explicit operator commands. Nothing here infers or
  simulates progress.
"""
from __future__ import annotations

import datetime as _dt
import fcntl
import hashlib
import json
import os
import re
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Iterable, Optional

ROOT = Path(os.environ.get("CLAUDE_PROJECT_DIR") or Path(__file__).resolve().parents[2]).resolve()
STATE = ROOT / ".studio"
OUTBOX = STATE / "outbox"
ACTIVE = STATE / "active_study.json"
CONFIG = STATE / "config.json"
TOKEN_FILE = STATE / "ingest_token"

AGENTS = [
    "head-of-market-research", "investment-banking", "project-technology", "syndications",
    "real-estate-hospitality", "ai-strategy", "environmental-technologies",
]
STAGES = ["document-analysis", "independent-research", "cross-review",
          "financial-validation", "final-report", "ic-decision"]
STAGE_ALIASES = {
    "s0": "document-analysis", "documents": "document-analysis", "intake": "document-analysis",
    "s1": "independent-research", "research": "independent-research",
    "s2": "cross-review", "s3": "cross-review", "review": "cross-review", "challenge": "cross-review",
    "s4": "financial-validation", "financial": "financial-validation", "model": "financial-validation",
    "s5": "final-report", "report": "final-report",
    "s6": "ic-decision", "verdict": "ic-decision", "decision": "ic-decision",
}
DOC_DIRS = ("research/", "outputs/", "models/")
DOC_EXT = {".md", ".csv", ".txt", ".json"}
MAX_DOC_BYTES = 2_000_000
EXCERPT = 600


def now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def excerpt(text: Any, n: int = EXCERPT) -> str:
    s = text if isinstance(text, str) else json.dumps(text, default=str)
    s = s.strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def parse_stage(*texts: Optional[str]) -> Optional[str]:
    """Stage tag convention: ``[stage:independent-research]`` or ``[S1]`` in the task description/prompt."""
    for t in texts:
        if not t:
            continue
        m = re.search(r"\[stage:\s*([a-z0-9-]+)\s*\]", t, re.I) or re.search(r"\[(S[0-6])\]", t, re.I)
        if m:
            key = m.group(1).lower()
            if key in STAGES:
                return key
            if key in STAGE_ALIASES:
                return STAGE_ALIASES[key]
    return None


def read_json(path: Path) -> Optional[dict]:
    try:
        return json.loads(path.read_text("utf-8"))
    except (OSError, ValueError):
        return None


def active_study() -> Optional[dict]:
    return read_json(ACTIVE)


def config() -> dict:
    cfg = read_json(CONFIG) or {}
    if os.environ.get("STUDIO_URL"):
        cfg["server_url"] = os.environ["STUDIO_URL"]
    cfg.setdefault("server_url", "http://127.0.0.1:4317")
    return cfg


def ingest_token() -> Optional[str]:
    tok = os.environ.get("STUDIO_INGEST_TOKEN")
    if tok:
        return tok.strip()
    try:
        return TOKEN_FILE.read_text("utf-8").strip() or None
    except OSError:
        return None


def make_event(study: str, etype: str, **fields: Any) -> dict:
    ev = {"id": str(uuid.uuid4()), "study": study, "ts": now(), "type": etype}
    ev.update({k: v for k, v in fields.items() if v is not None})
    return ev


def append_outbox(study: str, events: Iterable[dict]) -> None:
    OUTBOX.mkdir(parents=True, exist_ok=True)
    with open(OUTBOX / f"{study}.jsonl", "a", encoding="utf-8") as fh:
        for ev in events:
            fh.write(json.dumps(ev, ensure_ascii=False) + "\n")


def queue_document(study: str, rel_path: str, agent: Optional[str]) -> None:
    OUTBOX.mkdir(parents=True, exist_ok=True)
    with open(OUTBOX / f"{study}.docs", "a", encoding="utf-8") as fh:
        fh.write(json.dumps({"path": rel_path, "agent": agent}) + "\n")


def rel_doc_path(path: str) -> Optional[str]:
    """Return a repo-relative path if the file is a study deliverable we track, else None."""
    try:
        p = Path(path)
        p = (p if p.is_absolute() else ROOT / p).resolve()
        rel = p.relative_to(ROOT).as_posix()
    except (ValueError, OSError):
        return None
    if not rel.startswith(DOC_DIRS) or p.suffix.lower() not in DOC_EXT:
        return None
    if rel.startswith("models/") and rel.split("/")[1] in ("scripts", "tests"):
        return None
    if Path(rel).name in (".gitkeep", "README.md") and rel.count("/") <= 1:
        return None
    return rel


def document_payload(study: str, rel: str, agent: Optional[str]) -> Optional[dict]:
    p = ROOT / rel
    try:
        data = p.read_bytes()
    except OSError:
        return None
    if len(data) > MAX_DOC_BYTES:
        return None
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return None
    return {"study": study, "path": rel, "agent": agent, "sha256": hashlib.sha256(data).hexdigest(),
            "content": text, "mtime": _dt.datetime.fromtimestamp(p.stat().st_mtime, _dt.timezone.utc)
            .isoformat(timespec="seconds").replace("+00:00", "Z")}


def http_post(path: str, payload: Any, timeout: float = 2.0) -> tuple[bool, str]:
    cfg = config()
    url = cfg["server_url"].rstrip("/") + path
    headers = {"Content-Type": "application/json"}
    tok = ingest_token()
    if tok:
        headers["Authorization"] = f"Bearer {tok}"
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return 200 <= resp.status < 300, resp.read(500).decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        return False, f"HTTP {exc.code}: {exc.read(300).decode('utf-8', 'replace')}"
    except (urllib.error.URLError, OSError, ValueError) as exc:
        return False, str(exc)


def http_get(path: str, timeout: float = 10.0) -> Any:
    cfg = config()
    headers = {}
    tok = ingest_token()
    if tok:
        headers["Authorization"] = f"Bearer {tok}"
    req = urllib.request.Request(cfg["server_url"].rstrip("/") + path, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def flush(study: str, timeout: float = 2.0, block: bool = False) -> tuple[int, int, str]:
    """Send unsent events and queued documents. Returns (events_sent, docs_sent, error)."""
    OUTBOX.mkdir(parents=True, exist_ok=True)
    lock = open(OUTBOX / f"{study}.lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | (0 if block else fcntl.LOCK_NB))
    except OSError:
        return 0, 0, "another flush in progress"
    try:
        sent_file = OUTBOX / f"{study}.sent"
        try:
            offset = int(sent_file.read_text().strip() or 0)
        except (OSError, ValueError):
            offset = 0
        try:
            lines = (OUTBOX / f"{study}.jsonl").read_text("utf-8").splitlines()
        except OSError:
            lines = []
        pending = [json.loads(line) for line in lines[offset:] if line.strip()]
        ev_sent = 0
        for i in range(0, len(pending), 200):
            batch = pending[i:i + 200]
            ok, msg = http_post("/api/ingest/events", {"events": batch}, timeout)
            if not ok:
                sent_file.write_text(str(offset + ev_sent))
                return ev_sent, 0, msg
            ev_sent += len(batch)
        sent_file.write_text(str(offset + ev_sent))

        docs_file = OUTBOX / f"{study}.docs"
        try:
            queued = [json.loads(line) for line in docs_file.read_text("utf-8").splitlines() if line.strip()]
        except OSError:
            queued = []
        latest: dict[str, Optional[str]] = {}
        for q in queued:
            latest[q["path"]] = q.get("agent") or latest.get(q["path"])
        docs_sent = 0
        failed: list[dict] = []
        err = ""
        for rel, agent in latest.items():
            payload = document_payload(study, rel, agent)
            if payload is None:
                continue
            ok, msg = http_post("/api/ingest/documents", {"documents": [payload]}, timeout)
            if ok:
                docs_sent += 1
            else:
                failed.append({"path": rel, "agent": agent})
                err = msg
        docs_file.write_text("".join(json.dumps(f) + "\n" for f in failed), "utf-8")
        return ev_sent, docs_sent, err
    finally:
        fcntl.flock(lock, fcntl.LOCK_UN)
        lock.close()


def parse_agent_file(path: Path) -> Optional[dict]:
    text = path.read_text("utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.S)
    if not m:
        return None
    fm: dict[str, str] = {}
    for line in m.group(1).splitlines():
        if ":" in line and not line.startswith(" "):
            k, v = line.split(":", 1)
            fm[k.strip()] = v.strip()
    body = m.group(2)
    role = re.search(r"You are (?:the )?\*\*(.+?)\*\*", body)
    return {"name": fm.get("name", path.stem), "description": fm.get("description", ""),
            "model": fm.get("model", "inherit"), "color": fm.get("color", ""),
            "tools": fm.get("tools", ""), "title": role.group(1) if role else fm.get("name", path.stem)}


def agent_registry() -> list[dict]:
    out = []
    for p in sorted((ROOT / ".claude" / "agents").glob("*.md")):
        a = parse_agent_file(p)
        if a:
            out.append(a)
    return out
