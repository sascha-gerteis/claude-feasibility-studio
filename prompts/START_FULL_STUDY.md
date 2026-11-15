# Start a FULL feasibility study

Use with: `claude --agent head-of-market-research` (recommended) and paste the text below, or in a normal session
prefix it with "Use the head-of-market-research subagent to ...".

---

Act as `head-of-market-research` and run a COMPLETE cross-disciplinary market research and investment feasibility
study for the project described in `inputs/PROJECT_BRIEF.md` and the documents in `inputs/source_documents/`
(and `inputs/confidential/` if present).

Follow `CLAUDE.md` and your agent definition exactly, through all stages:
0. Intake and scoping → `research/00_director/study_plan.md` and `RUN_LOG.md`.
1. Write a self-contained task brief for each specialist and delegate to ALL SIX — `real-estate-hospitality`,
   `investment-banking`, `project-technology`, `syndications`, `ai-strategy`, `environmental-technologies` —
   in parallel where possible. Each writes to `research/<agent-name>/`.
2. Collect and consistency-check all six outputs.
3. Run the structured cross-review (matrix in `CLAUDE.md` §5) using `prompts/CHALLENGE_ROUND.md`.
4. Reconcile conflicts in `research/00_director/reconciliation_log.md` and `outputs/disagreement_log.csv`.
5. Integrate agreed assumptions into one assumption register and the model in `models/`.
6. Write all outputs in `outputs/` and issue a verdict: GO / CONDITIONAL GO / DEFER / NO-GO.

Do not invent missing commercial data. If inputs or tools are insufficient for a full calculation, produce a rigorous
evidence-gap PRE-FEASIBILITY study, showing exactly which missing numbers prevent an investment decision.
Log every agent run honestly; never claim a specialist ran unless it returned.

At completion, give a short table of each specialist's verdict, main objection, evidence strength, and what must be
verified next, plus unresolved dissent.
