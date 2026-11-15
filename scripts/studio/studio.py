#!/usr/bin/env python3
"""Feasibility Studio operator CLI (standard library only).

  study start <slug> --name NAME [--location LOC] [--kind study|validation]
  study stop                       stop recording (events after this are not captured)
  study current                    show the active study
  assign <agent> --stage STAGE --title TITLE    record an assigned (outstanding) task
  sync                             push agent registry, all study documents and unsent events
  status [<slug>]                  print agent statuses as derived by the server
  runlog [<slug>] [--write]        print/write research/00_director/RUN_LOG.md from recorded events
  export <slug> <file.json>        download a full study bundle (events + documents) from the server
  import <file.json>               load a bundle into the configured server
  artifact-export <slug> <dir>     write documents for the hosted (claude.ai artifact) dashboard
  config --server URL              set the dashboard server URL (default http://127.0.0.1:4317)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import studiolib as S  # noqa: E402


def die(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def push_registry() -> str:
    ok, msg = S.http_post("/api/ingest/agents", {"agents": S.agent_registry()}, timeout=10)
    return "agents registered" if ok else f"agent registry not delivered ({msg})"


def study_start(a: argparse.Namespace) -> None:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,62}", a.slug):
        die("slug must be lowercase letters, digits and hyphens")
    cur = S.active_study()
    if cur and cur["slug"] != a.slug:
        die(f"study '{cur['slug']}' is active; run 'study stop' first")
    S.STATE.mkdir(parents=True, exist_ok=True)
    info = {"slug": a.slug, "name": a.name, "location": a.location, "kind": a.kind, "activated_at": S.now()}
    S.ACTIVE.write_text(json.dumps(info, indent=2), "utf-8")
    S.append_outbox(a.slug, [S.make_event(a.slug, "study.activate",
                                          data={"name": a.name, "location": a.location, "kind": a.kind})])
    print(f"active study: {a.slug}")
    print(push_registry())
    sent, docs, err = S.flush(a.slug, timeout=10, block=True)
    print(f"events delivered: {sent}" + (f" (server unreachable: {err}; queued locally)" if err else ""))


def study_stop(_: argparse.Namespace) -> None:
    cur = S.active_study()
    if not cur:
        die("no active study")
    S.append_outbox(cur["slug"], [S.make_event(cur["slug"], "study.deactivate")])
    S.flush(cur["slug"], timeout=10, block=True)
    S.ACTIVE.unlink()
    print(f"recording stopped for {cur['slug']}")


def current(_: argparse.Namespace) -> None:
    cur = S.active_study()
    print(json.dumps(cur, indent=2) if cur else "no active study")


def assign(a: argparse.Namespace) -> None:
    cur = S.active_study() or die("no active study")
    if a.agent not in S.AGENTS:
        die(f"unknown agent {a.agent}; expected one of {', '.join(S.AGENTS)}")
    stage = S.parse_stage(f"[stage:{a.stage}]") or die(f"unknown stage {a.stage}; use {', '.join(S.STAGES)}")
    S.append_outbox(cur["slug"], [S.make_event(cur["slug"], "task.assign", agent=a.agent,
                                               data={"stage": stage, "title": a.title})])
    sent, _, err = S.flush(cur["slug"], timeout=5, block=True)
    print(f"assigned {a.agent} [{stage}] {a.title}" + (f" — queued (server unreachable: {err})" if err else ""))


def sync(_: argparse.Namespace) -> None:
    cur = S.active_study() or die("no active study")
    print(push_registry())
    n = 0
    for base in ("research", "outputs", "models"):
        for p in sorted((S.ROOT / base).rglob("*")):
            if p.is_file():
                rel = S.rel_doc_path(str(p))
                if rel:
                    S.queue_document(cur["slug"], rel, None)
                    n += 1
    sent, docs, err = S.flush(cur["slug"], timeout=15, block=True)
    print(f"documents scanned: {n}; delivered: {docs}; events delivered: {sent}" + (f"; ERROR: {err}" if err else ""))


def slug_or_active(slug: str | None) -> str:
    if slug:
        return slug
    cur = S.active_study()
    if not cur:
        die("no study given and none active")
    return cur["slug"]


def status(a: argparse.Namespace) -> None:
    st = S.http_get(f"/api/studies/{slug_or_active(a.slug)}")
    print(f"{st['study']['name']} — data as of {st['generatedAt']}")
    for ag in st["agents"]:
        task = (ag.get("currentTask") or {}).get("title", "")
        print(f"  {ag['name']:28s} {ag['status']:10s} done={len(ag['completedTasks'])} open={len(ag['outstandingTasks'])} "
              f"failed={len(ag['failedTasks'])}  {task}")


def runlog(a: argparse.Namespace) -> None:
    slug = slug_or_active(a.slug)
    st = S.http_get(f"/api/studies/{slug}")
    lines = [f"# Run Log — {st['study']['name']}", "",
             "Generated from hook-recorded Claude Code events by `scripts/studio/studio.py runlog`. "
             "Only agent runs that produced recorded lifecycle events appear here.", "",
             f"**Generated:** {st['generatedAt']} · **Study:** `{slug}`", "",
             "| # | Stage | Agent | Task | Started (UTC) | Ended (UTC) | Status | Run id | Notes |",
             "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
    for i, t in enumerate(st["tasks"], 1):
        note = (t.get("error") or "").replace("|", "/")[:120]
        lines.append(f"| {i} | {t.get('stage') or '—'} | {t['agent']} | {(t.get('title') or '').replace('|', '/')} | "
                     f"{t.get('startedAt') or '—'} | {t.get('endedAt') or '—'} | {t['state'].upper()} | "
                     f"{t.get('runId') or '—'} | {note} |")
    text = "\n".join(lines) + "\n"
    if a.write:
        out = S.ROOT / "research" / "00_director" / "RUN_LOG.md"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, "utf-8")
        print(f"wrote {out.relative_to(S.ROOT)}")
    else:
        print(text)


def export(a: argparse.Namespace) -> None:
    bundle = S.http_get(f"/api/studies/{a.slug}/export", timeout=60)
    Path(a.file).write_text(json.dumps(bundle, ensure_ascii=False), "utf-8")
    print(f"exported {len(bundle['events'])} events, {len(bundle['documents'])} documents to {a.file}")


def import_(a: argparse.Namespace) -> None:
    bundle = json.loads(Path(a.file).read_text("utf-8"))
    ok, msg = S.http_post("/api/ingest/bundle", bundle, timeout=120)
    print("imported" if ok else f"import failed: {msg}")


def artifact_export(a: argparse.Namespace) -> None:
    """Write artifact-database documents (one JSON file each) plus manifest.json for the hosted dashboard.

    Everything comes from the dashboard server's derivation of recorded events and stored documents.
    The orchestrating Claude session then writes the files with its ArtifactData tool (batch writes).
    """
    import hashlib
    import urllib.parse
    slug = a.slug
    out = Path(a.dir)
    out.mkdir(parents=True, exist_ok=True)
    state = S.http_get(f"/api/studies/{slug}")
    summary = next((x for x in S.http_get("/api/studies") if x["slug"] == slug), None)
    compare = S.http_get(f"/api/compare?studies={slug}")
    limit_doc = 240_000
    manifest: list[dict] = []

    def emit(collection: str, doc_id: str, body: dict) -> None:
        f = out / f"{collection}__{doc_id}.json"
        f.write_text(json.dumps(body, ensure_ascii=False), "utf-8")
        size = f.stat().st_size
        if size > 256 * 1024:
            die(f"{collection}/{doc_id} is {size} bytes, over the 256 KiB document limit")
        manifest.append({"collection": collection, "doc_id": doc_id, "file_path": str(f.resolve()), "bytes": size})

    doc_ids: dict[str, str] = {}
    for d in state["documents"]:
        did = "d" + hashlib.sha1(f"{slug}\0{d['path']}".encode()).hexdigest()[:24]
        doc_ids[d["path"]] = did
        full = S.http_get(f"/api/studies/{slug}/document?path={urllib.parse.quote(d['path'])}")
        content = full.pop("content")
        body = {**full, "content": ""}
        raw = content.encode("utf-8")
        if len(raw) <= 200_000:
            body["content"] = content
        else:
            chunks, cur = [], ""
            for ch in content:
                cur += ch
                if len(cur) >= 60_000:
                    chunks.append(cur); cur = ""
            if cur:
                chunks.append(cur)
            body["parts"] = len(chunks)
            for i, c in enumerate(chunks):
                emit("docparts", f"{did}-{i}", {"text": c})
        emit("documents", did, body)

    sync = {"syncedAt": S.now(), "eventsThrough": state.get("lastEventAt"), "source": "studio.py artifact-export"}
    state["__sync"] = sync
    state["__docIds"] = doc_ids
    # Keep the state document under the store's per-document limit, trimming the oldest detail first.
    for feed_n, act_n, excerpt_n in ((400, 150, 600), (250, 80, 300), (150, 40, 200), (80, 20, 120)):
        trial = dict(state)
        trial["feed"] = state["feed"][:feed_n]
        trial["agents"] = [{**ag, "activity": ag["activity"][-act_n:]} for ag in state["agents"]]
        trial["orchestrator"] = {**state["orchestrator"], "activity": state["orchestrator"]["activity"][-min(act_n, 50):]}
        trial["tasks"] = [{**t, "resultExcerpt": (t.get("resultExcerpt") or "")[:excerpt_n] or None} for t in state["tasks"]]
        if len(json.dumps(trial, ensure_ascii=False).encode()) <= limit_doc:
            state = trial
            break
    else:
        die("study state is too large for one artifact document even after trimming")
    if summary:
        emit("studies", slug, {**summary, "__sync": sync})
    if compare:
        emit("compare", slug, compare[0])
    emit("states", slug, state)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1), "utf-8")
    print(f"{len(manifest)} documents written to {out} (manifest.json); state covers events through {sync['eventsThrough']}")


def set_config(a: argparse.Namespace) -> None:
    S.STATE.mkdir(parents=True, exist_ok=True)
    cfg = S.read_json(S.CONFIG) or {}
    cfg["server_url"] = a.server
    S.CONFIG.write_text(json.dumps(cfg, indent=2), "utf-8")
    print(f"server: {a.server}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    st = sub.add_parser("study").add_subparsers(dest="sub", required=True)
    s1 = st.add_parser("start"); s1.add_argument("slug"); s1.add_argument("--name", required=True)
    s1.add_argument("--location"); s1.add_argument("--kind", choices=["study", "validation"], default="study")
    s1.set_defaults(fn=study_start)
    st.add_parser("stop").set_defaults(fn=study_stop)
    st.add_parser("current").set_defaults(fn=current)
    s2 = sub.add_parser("assign"); s2.add_argument("agent"); s2.add_argument("--stage", required=True)
    s2.add_argument("--title", required=True); s2.set_defaults(fn=assign)
    sub.add_parser("sync").set_defaults(fn=sync)
    s3 = sub.add_parser("status"); s3.add_argument("slug", nargs="?"); s3.set_defaults(fn=status)
    s4 = sub.add_parser("runlog"); s4.add_argument("slug", nargs="?"); s4.add_argument("--write", action="store_true")
    s4.set_defaults(fn=runlog)
    s5 = sub.add_parser("export"); s5.add_argument("slug"); s5.add_argument("file"); s5.set_defaults(fn=export)
    s6 = sub.add_parser("import"); s6.add_argument("file"); s6.set_defaults(fn=import_)
    s8 = sub.add_parser("artifact-export"); s8.add_argument("slug"); s8.add_argument("dir"); s8.set_defaults(fn=artifact_export)
    s7 = sub.add_parser("config"); s7.add_argument("--server", required=True); s7.set_defaults(fn=set_config)
    a = p.parse_args()
    try:
        a.fn(a)
    except OSError as exc:
        die(f"cannot reach dashboard server at {S.config()['server_url']}: {exc}")


if __name__ == "__main__":
    main()
