# Setup Validation Record — Phase 1

**Date:** 2026-11-15 · **Environment:** Claude Code on the web (cloud container), Claude Code CLI 2.1.325
**Scope:** configuration and delegation only. **No feasibility study, market research or project analysis was run.**

## 1. Archive extraction and repair
- Source: `claude_agents_for_web_github.zip` (SHA-256 `fb60a00e…a454ac`, 24 files). The file in the repo root
  was byte-identical to the archive uploaded in chat. It was extracted flat at the repository root; the original
  archive is kept at `docs/claude_agents_for_web_github.zip` for provenance.
- The archive's seven agent files were kept under their original names. They were then expanded to the Phase 1
  specification and repaired:
  - Specialists had no Write/Edit/Bash, so they could not save findings under `research/`. Added.
  - Verdict scale aligned to GO / CONDITIONAL GO / DEFER / NO-GO.
  - `SPONSOR` and `PROJECTION` evidence labels added.
  - Templates, workspace folders, cross-review matrix and run-log honesty rules added.
  - `environmental-technologies` colour changed from a duplicate green to pink.

## 2. Static validation
`python3 scripts/validate_agents.py` → PASS. It checks:
- 7 agents with unique names that match their filenames
- frontmatter fields, models and colours against the documented schema
- tool access
- the Director's `Agent(...)` allowlist naming all six specialists
- 26 shared files, every referenced template, prompt and model path, and the workspace directories

Negative test: a copy with four deliberate faults (missing allowlist entry, invalid colour, misspelled field,
missing template) → all four reported, exit code 1.

`python3 -m unittest discover -s models/tests` → 5 tests OK. These use synthetic values only.

## 3. Live delegation tests (harmless "reply READY" tasks; no tools used by the agents)
| Test | Command shape | Result |
| --- | --- | --- |
| Discovery | `claude -p --agent head-of-market-research …` (init event) | All 7 project agents listed as available ✅ |
| Mode A: Director as main thread → 6 specialists | `prompts/SMOKE_TEST_DELEGATION.md` | Director issued 6 parallel Agent calls; all 6 returned READY ✅ |
| Mode B: main → Director (subagent) → specialist | normal `claude -p` session | Director had **no Agent tool**, because this cloud environment sets `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`. It reported the failure honestly and did not fabricate a reply ❌ (environment limit, not a config fault) |
| Mode C: fallback, main session → all 7 agents | normal `claude -p` session | 7 parallel Agent calls; all 7 returned READY ✅ |

## 4. Conclusions
- Use **Mode C** (`prompts/ORCHESTRATE_FALLBACK.md`) in Claude Code on the web.
- Use **Mode A** (`claude --agent head-of-market-research`) in a local CLI.
- Agents in `.claude/agents/` load when a session **starts** in this repository. Start a new session after cloning or
  pulling.
- Web search and fetch were not exercised by the agents during setup. Availability will be confirmed at the start of
  Phase 2 and recorded in `study_plan.md` §9.
