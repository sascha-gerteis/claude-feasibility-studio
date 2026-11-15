#!/usr/bin/env python3
"""Tests for hook.py using payload shapes captured from Claude Code 2.1.325 (run: python3 -I scripts/studio/test_hook.py)."""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HOOK = Path(__file__).resolve().parent / "hook.py"


def run(project: Path, payload: dict) -> subprocess.CompletedProcess:
    env = {**os.environ, "CLAUDE_PROJECT_DIR": str(project), "STUDIO_URL": "http://127.0.0.1:9", "STUDIO_HOOK_TIMEOUT": "0.2"}
    env.pop("STUDIO_INGEST_TOKEN", None)
    return subprocess.run([sys.executable, "-I", str(HOOK)], input=json.dumps(payload), text=True, capture_output=True, env=env, timeout=20)


class HookTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = Path(self.tmp.name)
        (self.p / "research" / "ai-strategy").mkdir(parents=True)

    def tearDown(self):
        self.tmp.cleanup()

    def activate(self):
        (self.p / ".studio").mkdir(exist_ok=True)
        (self.p / ".studio" / "active_study.json").write_text(json.dumps({"slug": "t-study", "name": "T"}))

    def outbox(self):
        f = self.p / ".studio" / "outbox" / "t-study.jsonl"
        return [json.loads(l) for l in f.read_text().splitlines()] if f.exists() else []

    def test_records_nothing_without_active_study(self):
        r = run(self.p, {"hook_event_name": "SessionStart", "session_id": "S", "source": "startup"})
        self.assertEqual(r.returncode, 0)
        self.assertEqual(r.stdout, "")
        self.assertFalse((self.p / ".studio").exists())

    def test_lifecycle_sequence(self):
        self.activate()
        f = self.p / "research" / "ai-strategy" / "findings.md"
        f.write_text("# findings\n")
        seq = [
            {"hook_event_name": "SessionStart", "session_id": "S", "source": "startup"},
            {"hook_event_name": "PreToolUse", "session_id": "S", "tool_name": "Agent", "tool_use_id": "TU1",
             "tool_input": {"description": "[S1] AI research", "prompt": "Read CLAUDE.md", "subagent_type": "ai-strategy", "run_in_background": False}},
            {"hook_event_name": "SubagentStart", "session_id": "S", "agent_id": "R1", "agent_type": "ai-strategy"},
            {"hook_event_name": "PostToolUse", "session_id": "S", "agent_id": "R1", "agent_type": "ai-strategy", "tool_name": "WebSearch",
             "tool_input": {"query": "hotel automation evidence"}, "tool_response": {}},
            {"hook_event_name": "PostToolUse", "session_id": "S", "agent_id": "R1", "agent_type": "ai-strategy", "tool_name": "Write",
             "tool_input": {"file_path": str(f), "content": "x"}, "tool_response": {"type": "create"}},
            {"hook_event_name": "SubagentStop", "session_id": "S", "agent_id": "R1", "agent_type": "ai-strategy", "last_assistant_message": "DONE"},
            {"hook_event_name": "PostToolUse", "session_id": "S", "tool_name": "Agent", "tool_use_id": "TU1",
             "tool_input": {"subagent_type": "ai-strategy"},
             "tool_response": {"status": "completed", "agentId": "R1", "totalTokens": 10, "content": [{"type": "text", "text": "DONE"}]}},
            {"hook_event_name": "PostToolUseFailure", "session_id": "S", "tool_name": "Agent", "tool_use_id": "TU2",
             "tool_input": {"subagent_type": "nonexistent-agent"}, "error": "Agent type 'nonexistent-agent' not found", "is_interrupt": False},
            {"hook_event_name": "PostToolUse", "session_id": "S", "tool_name": "TaskStop", "tool_input": {"task_id": "R9"},
             "tool_response": {"message": "Successfully stopped task", "task_id": "R9", "task_type": "local_agent"}},
            {"hook_event_name": "PostToolUse", "session_id": "S", "tool_name": "Read", "tool_input": {"file_path": "/x"}},
            {"hook_event_name": "SessionEnd", "session_id": "S", "reason": "other"},
        ]
        for h in seq:
            r = run(self.p, h)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(r.stdout, "", "hooks must never write to stdout")
        types = [e["type"] for e in self.outbox()]
        self.assertEqual(types, ["session.start", "task.dispatch", "agent.start", "tool.use", "tool.use", "file.write",
                                 "agent.stop", "task.result", "task.failure", "agent.killed", "session.end"])
        ev = {e["type"]: e for e in self.outbox()}
        self.assertEqual(ev["task.dispatch"]["data"]["stage"], "independent-research")
        self.assertEqual(ev["file.write"]["data"]["path"], "research/ai-strategy/findings.md")
        self.assertEqual(ev["file.write"]["agent"], "ai-strategy")
        self.assertEqual(ev["task.result"]["agent_run_id"], "R1")
        self.assertIn("not found", ev["task.failure"]["data"]["error"])
        docs = (self.p / ".studio" / "outbox" / "t-study.docs").read_text()
        self.assertIn("research/ai-strategy/findings.md", docs)  # queued for delivery while server is down

    def test_untracked_paths_are_not_queued(self):
        self.activate()
        run(self.p, {"hook_event_name": "PostToolUse", "session_id": "S", "agent_id": "R", "agent_type": "ai-strategy",
                     "tool_name": "Write", "tool_input": {"file_path": str(self.p / "inputs" / "confidential" / "x.md")}})
        self.assertFalse((self.p / ".studio" / "outbox" / "t-study.docs").exists())

    def test_garbage_input_never_fails(self):
        self.activate()
        env = {**os.environ, "CLAUDE_PROJECT_DIR": str(self.p)}
        r = subprocess.run([sys.executable, "-I", str(HOOK)], input="not json", text=True, capture_output=True, env=env)
        self.assertEqual((r.returncode, r.stdout), (0, ""))


if __name__ == "__main__":
    unittest.main()
