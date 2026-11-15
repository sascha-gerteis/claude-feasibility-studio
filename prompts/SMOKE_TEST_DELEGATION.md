# Delegation smoke test (harmless — no research)

Verifies that agents are discoverable and that the Director can delegate to all six specialists. No web research,
no project analysis, no repository files are modified.

Run from the repository root:

```bash
claude -p --agent head-of-market-research --permission-mode dontAsk --allowedTools "Agent,Read,Glob,Grep" "SMOKE TEST ONLY. Do not research, do not analyse any project, do not write files. Using the Agent tool, delegate this exact task to each of your six specialists in parallel: 'SMOKE TEST: reply with one line: <your agent name> | <the one-sentence role from your agent definition> | READY. Do not use any tools.' Then output a table: agent name, whether the call returned, and its reply. Report honestly any agent you could not invoke."
```

Expected: six rows, each READY. Any failure means discovery or delegation is broken — check `.claude/agents/`
frontmatter with `python3 scripts/validate_agents.py` and restart Claude Code.

Fallback check (nested delegation unavailable): in a normal `claude` session ask the main session to call each of the
seven agents directly with the same one-line task.
