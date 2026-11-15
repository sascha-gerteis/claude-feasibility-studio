# Fallback orchestration — main session runs all seven agents explicitly

**Recommended mode in Claude Code on the web**, where `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` prevents a Director
launched as a subagent from spawning specialists. Also use it anywhere nested delegation is unavailable. The main Claude Code session becomes the orchestrator and calls each agent
directly with the Agent tool. Paste the following into a normal `claude` session in this repository:

---

Run the feasibility study in FALLBACK orchestration mode. You (the main session) orchestrate; you do not do the
specialists' analysis yourself. Record every call in `research/00_director/RUN_LOG.md` with mode FALLBACK.

1. Call subagent `head-of-market-research` with: "STAGE 0 ONLY. Read CLAUDE.md and the inputs. Write
   research/00_director/study_plan.md and the six task briefs in research/00_director/task_briefs/. Do not delegate.
   Return the list of brief paths."
2. Call all six specialists in parallel (`real-estate-hospitality`, `investment-banking`, `project-technology`,
   `syndications`, `ai-strategy`, `environmental-technologies`), each with: "Read CLAUDE.md and your task brief at
   research/00_director/task_briefs/<name>.md. Write your outputs to research/<name>/. Return your summary."
3. Call `head-of-market-research` with: "STAGE 2 ONLY. Read all six research/<agent>/ outputs, check consistency, and
   list conflicts and the cross-review assignments. Do not delegate."
4. Call each specialist with its cross-review assignment from the `CLAUDE.md` §5 matrix and `prompts/CHALLENGE_ROUND.md`.
5. If reconciliation needs follow-ups, call the affected specialists with the specific questions.
6. Call `head-of-market-research` with: "STAGES 4–6. Reconcile, integrate, run the model, write all outputs and issue
   the verdict. Do not delegate. Mode: FALLBACK."
7. Report which agents ran (from RUN_LOG.md), the verdict, and any agent that failed or was not run.

Never mark an agent as run unless its result returned. If any specialist fails, retry once; if it fails again, mark
its workstream NOT EXECUTED — do not substitute your own analysis.
