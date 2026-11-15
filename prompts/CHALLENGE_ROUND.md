# Structured cross-review / challenge round

Director: delegate one task per reviewer using the matrix in `CLAUDE.md` §5. Send each reviewer this prompt with the
placeholders filled:

---

You are `[reviewer]`. Read `CLAUDE.md`, then the findings and registers of `[target-1]` and `[target-2]` in
`research/<target>/`. For each target, write `research/cross-review/[reviewer]__on__[target].md` using
`templates/CROSS_REVIEW_TEMPLATE.md`.

Scrutinise from your own discipline: identify the claims that matter most to the investment decision, test whether
the evidence supports them, flag inconsistencies with your workstream (units, timing, phasing, double counting), and
raise concrete, falsifiable challenges. Also record the points you accept. Do not manufacture counter-evidence; where
a challenge rests on missing data, say so. Return a summary of your HIGH-severity challenges.

---

Director, in addition, assign targeted challenges for:
- the largest unsupported revenue line,
- the most optimistic financing assumption,
- the greatest timeline / permitting risk,
- the biggest hidden technology or AI cost,
- the weakest environmental saving claim.
Then reconcile in `research/00_director/reconciliation_log.md` and `outputs/disagreement_log.csv`, and update the
executive summary. Do not erase disagreements.
