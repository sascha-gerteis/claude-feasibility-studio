#!/usr/bin/env python3
"""Claude Code hook entry point for the Feasibility Studio dashboard.

Registered in ``.claude/settings.json`` for SessionStart, SessionEnd, Stop, PreToolUse, PostToolUse,
PostToolUseFailure, SubagentStart and SubagentStop. It reads the hook JSON from stdin, converts it
into a normalised studio event, appends it to the local outbox, and tries to deliver it to the
dashboard server. It ALWAYS exits 0 and never writes to stdout, so it can never block or alter
Claude Code's behaviour. It records nothing unless a study is active.
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import studiolib as S  # noqa: E402

RESEARCH_TOOLS = {"WebSearch", "WebFetch"}
FILE_TOOLS = {"Write", "Edit", "MultiEdit", "NotebookEdit"}
TRACKED_TOOLS = RESEARCH_TOOLS | FILE_TOOLS | {"Bash", "Read"}


def tool_summary(name: str, inp: dict) -> str:
    if name == "WebSearch":
        return S.excerpt(inp.get("query", ""), 200)
    if name == "WebFetch":
        return S.excerpt(inp.get("url", ""), 300)
    if name in FILE_TOOLS or name == "Read":
        return S.excerpt(inp.get("file_path") or inp.get("notebook_path") or "", 300)
    if name == "Bash":
        return S.excerpt(inp.get("description") or inp.get("command", ""), 200)
    return ""


def normalise(h: dict, study: str) -> tuple[list[dict], list[tuple[str, str | None]]]:
    ev = h.get("hook_event_name", "")
    sid = h.get("session_id")
    agent = h.get("agent_type")          # present only for tool calls made inside a subagent
    run = h.get("agent_id")
    tool = h.get("tool_name", "")
    inp = h.get("tool_input") or {}
    out: list[dict] = []
    docs: list[tuple[str, str | None]] = []
    E = lambda t, **kw: out.append(S.make_event(study, t, session_id=sid, **kw))  # noqa: E731

    if ev == "SessionStart":
        E("session.start", data={"source": h.get("source")})
    elif ev == "SessionEnd":
        E("session.end", data={"reason": h.get("reason")})
    elif ev == "Stop":
        E("session.turn_end", data={"background_tasks": len(h.get("background_tasks") or [])})
    elif ev == "SubagentStart":
        E("agent.start", agent=agent, agent_run_id=run)
    elif ev == "SubagentStop":
        E("agent.stop", agent=agent, agent_run_id=run,
          data={"result_excerpt": S.excerpt(h.get("last_assistant_message") or "")})
    elif ev == "PreToolUse" and tool == "Agent" and not run:
        desc, prompt = inp.get("description", ""), inp.get("prompt", "")
        E("task.dispatch", agent=inp.get("subagent_type") or "general-purpose", tool_use_id=h.get("tool_use_id"),
          data={"description": S.excerpt(desc, 300), "stage": S.parse_stage(desc, prompt),
                "background": bool(inp.get("run_in_background")), "prompt_excerpt": S.excerpt(prompt)})
    elif ev == "PostToolUse" and tool == "Agent" and not run:
        r = h.get("tool_response") or {}
        r = r if isinstance(r, dict) else {"content": r}
        text = ""
        if isinstance(r.get("content"), list):
            text = " ".join(c.get("text", "") for c in r["content"] if isinstance(c, dict))
        E("task.result", agent=inp.get("subagent_type") or r.get("agentType"), tool_use_id=h.get("tool_use_id"),
          agent_run_id=r.get("agentId"),
          data={"status": r.get("status"), "async": bool(r.get("isAsync")), "model": r.get("resolvedModel"),
                "duration_ms": r.get("totalDurationMs"), "tokens": r.get("totalTokens"),
                "tool_uses": r.get("totalToolUseCount"), "result_excerpt": S.excerpt(text) if text else None})
    elif ev == "PostToolUseFailure" and tool == "Agent" and not run:
        E("task.failure", agent=inp.get("subagent_type"), tool_use_id=h.get("tool_use_id"),
          data={"error": S.excerpt(h.get("error") or "", 400), "interrupted": bool(h.get("is_interrupt"))})
    elif ev == "PostToolUse" and tool == "TaskStop":
        r = h.get("tool_response") or {}
        tid = (inp.get("task_id") or inp.get("shell_id") or (r.get("task_id") if isinstance(r, dict) else None))
        if isinstance(r, dict) and r.get("task_type") == "local_agent":
            E("agent.killed", agent_run_id=tid, data={"message": S.excerpt(r.get("message", ""), 200)})
    elif ev in ("PostToolUse", "PostToolUseFailure") and tool in TRACKED_TOOLS:
        if tool == "Read" and not run:
            return out, docs                       # orchestrator reads are noise
        failed = ev == "PostToolUseFailure"
        E("tool.error" if failed else "tool.use", agent=agent or "orchestrator", agent_run_id=run,
          tool_use_id=h.get("tool_use_id"),
          data={"tool": tool, "summary": tool_summary(tool, inp),
                "error": S.excerpt(h.get("error") or "", 300) if failed else None})
        if tool in FILE_TOOLS and not failed:
            rel = S.rel_doc_path(inp.get("file_path") or inp.get("notebook_path") or "")
            if rel:
                E("file.write", agent=agent or "orchestrator", agent_run_id=run,
                  data={"path": rel, "tool": tool})
                docs.append((rel, agent or "orchestrator"))
    return out, docs


def main() -> None:
    try:
        raw = sys.stdin.read()
        study = S.active_study()
        if not study:
            return
        h = json.loads(raw) if raw.strip() else {}
        events, docs = normalise(h, study["slug"])
        if not events:
            return
        S.append_outbox(study["slug"], events)
        for rel, agent in docs:
            S.queue_document(study["slug"], rel, agent)
        S.flush(study["slug"], timeout=float(os.environ.get("STUDIO_HOOK_TIMEOUT", "1.5")))
    except Exception as exc:  # never disturb Claude Code
        try:
            S.STATE.mkdir(parents=True, exist_ok=True)
            with open(S.STATE / "hook_errors.log", "a", encoding="utf-8") as fh:
                fh.write(f"{S.now()} {type(exc).__name__}: {exc}\n")
        except OSError:
            pass


if __name__ == "__main__":
    main()
    sys.exit(0)
