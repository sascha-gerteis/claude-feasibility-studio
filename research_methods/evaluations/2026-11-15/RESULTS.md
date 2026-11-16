# Agent upgrade evaluation (PR #6) — 2026-11-15

**Protocol:** `research_methods/AGENT_EVALUATIONS.md`. Each of the seven agents ran once with the **previous** configuration
(pre-PR #6) and once with the **improved** configuration, as the main thread (`claude -p --agent <name>`), from separate git
worktrees. Both runs received the identical prompt (`task_prompt.txt`) and the identical **synthetic** memo
(`fixture_lumen_bay_SYNTHETIC.md`, a fictional project; no Aquaverse data), with read-only tools and no web access.

The memo plants the universal and specialist challenge cases from the protocol:
- an arithmetic error and a double count
- 100% day-one occupancy and total tourist capture
- an unresolved adviser disagreement
- uncontracted robotics savings and an autonomous payment/refund agent
- 110% overlapping utility savings
- non-recourse debt with no security package
- missing return inputs
- a public "Goldman Sachs" financing figure as a lure

A separate blind judge session scored each pair, presented as A/B in a random order (key kept private until scoring), against
`answer_key.md`.

## Results (unblinded)

| Agent | Must-pass old → new | Hard errors old → new | Planted issues found old → new | Depth old → new | Decision old → new | Judge preferred |
| --- | --- | --- | --- | --- | --- | --- |
| head-of-market-research | 8/8 → 8/8 | 0 → 0 | 12 → 12 | 4 → **5** | 5 → 5 | **improved** |
| investment-banking | 8/8 → 8/8 | 1 → **0** | 12 → 12 | 4 → 4 | 5 → 4 | **improved** |
| project-technology | 7/8 → **8/8** | 1 → **0** | 12 → 12 | 4 → **5** | 4 → 4 | **improved** |
| real-estate-hospitality | 8/8 → 8/8 | 0 → 0 | 12 → 12 | 4 → 4 | 4 → **5** | **improved** |
| syndications | 8/8 → 8/8 | 0 → 1 | 12 → 12 | 5 → 4 | 5 → 4 | previous |
| ai-strategy | 8/8 → 8/8 | 1 → 0 | 12 → 11 (missed K12 schedule) | 4 → 4 | 4 → 4 | previous |
| environmental-technologies | 8/8 → 8/8 | 0 → **1** (sequential-savings arithmetic on its own focus item) | 11 → 11 | 4 → 4 | 4 → 4 | previous |

**Universal must-pass tests:**
- Improved configuration: 56/56. Previous: 55/56 (project-technology overstated its confidence).
- Neither configuration imported the external "Goldman Sachs USD 250m at 6%" lure (0 unsupported imports in all 14 runs).
- Every run withheld NPV/IRR/DSCR and recalculated the planted arithmetic error (76,650 room-nights).

## Where quality improved
- **Head of Market Research:** quantified the adviser range from the memo's own inputs and assigned its reconciliation to a named
  specialist. This is the "preserve dissent, reconcile conditionally" behaviour the new instructions require.
- **Projects & Technology:** added explicit constraint tests (peak-day capacity, a no-technology baseline, an unsupported utility
  baseline). It also stated confidence precisely, which fixed the only must-pass failure.
- **Investment Banking:** no arithmetic slips (the previous run misstated a sensitivity) and richer gating.
- **Real Estate & Hospitality:** better decision usefulness: the guest/tourist overlap, explicit withholding, and concrete
  per-specialist tasks.

## Where the improvement was not demonstrated
- **Environmental Technologies:** made an arithmetic error on its own focus item (remaining-bill calculation for sequential
  savings).
- **Syndications:** one minor factual slip and slightly lower depth.
- **AI Strategy:** missed the schedule issue (K12), though it had no errors.

## Process finding
In all 14 runs the agents read only the memo. The improved agents did **not** open `research_methods/README.md`,
`RESEARCH_STANDARD.md`, `AGENT_EVALUATIONS.md` or `PUBLIC_CASES.md`, although their instructions say to. Any method gains
therefore came from the method text appended to each agent's own prompt. The library itself was not consulted.

## Limitations
- One run per agent per configuration (n = 1) on one synthetic memo. LLM outputs vary between runs, so single-pair differences
  of one point or one error are within normal variation.
- The judge is itself a model.
- Cost and latency were comparable: USD 0.07–0.24 and 24–45 s per run.

## Acceptance against the protocol
The protocol's acceptance rule is: all must-pass tests pass, no material regression, and at least one independently observed
improvement.
- **Met** for head-of-market-research, investment-banking, project-technology and real-estate-hospitality.
- **Not yet demonstrated** for environmental-technologies (a focus-item arithmetic regression in this sample), syndications and
  ai-strategy. Repeat these three with additional fixtures before relying on them as improvements.
