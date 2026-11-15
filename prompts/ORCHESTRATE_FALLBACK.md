# Fallback orchestration — main session runs all seven agents explicitly

**Recommended mode in Claude Code on the web**, where `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` prevents a Director
launched as a subagent from spawning specialists. Also use it anywhere nested delegation is unavailable. The main Claude
Code session becomes the orchestrator and calls each agent directly with the Agent tool.

Every agent run is instrumented by the Claude Code hooks in `.claude/settings.json` (see `dashboard/README.md`). The
hooks record only while a study is **active**, so the first step below activates recording. Start a **new** Claude Code
session in this repository so the project hooks are loaded, then paste the following:

---

Run the feasibility study in FALLBACK orchestration mode. You (the main session) orchestrate; you do not do the
specialists' analysis yourself.

**Instrumentation (mandatory).**
- Start the dashboard server in the background if it is not running:
  `cd dashboard && npm ci && npm run build && npm start` (listens on 127.0.0.1:4317). In Claude Code on the web, then
  report port 4317 as a preview so the user can open it.
- Activate recording before any agent call:
  `python3 scripts/studio/studio.py study start <slug> --name "<project name>" --location "<location>"`
- Record each planned task before dispatching it:
  `python3 scripts/studio/studio.py assign <agent> --stage <stage> --title "<task>"`
- Every Agent tool call MUST use a description that begins with a stage tag, e.g.
  `[stage:independent-research] Real estate market and comparables`. Stages: `document-analysis`,
  `independent-research`, `cross-review`, `financial-validation`, `final-report`, `ic-decision`.
- Never mark an agent as run yourself. The run log is generated from recorded hook events:
  `python3 scripts/studio/studio.py runlog --write` (writes `research/00_director/RUN_LOG.md`).

**Workflow.**
1. Assign, then call subagent `head-of-market-research` with description `[stage:document-analysis] Study plan and
   briefs` and prompt: "STAGE 0 ONLY. Read CLAUDE.md and the inputs. Write research/00_director/study_plan.md and the six
   task briefs in research/00_director/task_briefs/. Do not delegate. Return the list of brief paths."
2. Assign, then call all six specialists in parallel (`real-estate-hospitality`, `investment-banking`,
   `project-technology`, `syndications`, `ai-strategy`, `environmental-technologies`) with description
   `[stage:independent-research] <workstream>` and prompt: "Read CLAUDE.md and your task brief at
   research/00_director/task_briefs/<name>.md. Write your outputs to research/<name>/. Return your summary."
3. Call `head-of-market-research` with description `[stage:cross-review] Consistency check` and prompt: "STAGE 2 ONLY.
   Read all six research/<agent>/ outputs, check consistency, and list conflicts and the cross-review assignments.
   Do not delegate."
4. Assign, then call each specialist with its cross-review assignment from the `CLAUDE.md` §5 matrix and
   `prompts/CHALLENGE_ROUND.md`, description `[stage:cross-review] <reviewer> on <targets>`.
5. If reconciliation needs follow-ups, call the affected specialists with the specific questions (tag the stage).
6. Call `investment-banking` with description `[stage:financial-validation] Integrated model and scenarios` to run the
   agreed model in `models/<slug>/`.
7. Call `head-of-market-research` with description `[stage:final-report] Reconcile, integrate and report` and prompt:
   "STAGES 4–6. Reconcile, integrate, write all outputs and issue the verdict in outputs/04_recommendation.md. Do not
   delegate. Mode: FALLBACK."
8. Run `python3 scripts/studio/studio.py sync` (delivers every document) and
   `python3 scripts/studio/studio.py runlog --write`. Report which agents ran (from the generated RUN_LOG.md and the
   dashboard), the verdict, and any agent that failed or was not run.
9. When the study is finished: `python3 scripts/studio/studio.py study stop`, and export a durable bundle with
   `python3 scripts/studio/studio.py export <slug> <file>` if the server is not a persistent deployment.

If any specialist fails, retry once; if it fails again, its workstream is NOT EXECUTED — do not substitute your own
analysis. The dashboard will show the failure as recorded.
