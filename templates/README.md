# Templates

| Template | Used by | Produces |
| --- | --- | --- |
| `RESEARCH_PLAN_TEMPLATE.md` | Director | `research/00_director/study_plan.md` |
| `TASK_BRIEF_TEMPLATE.md` | Director | `research/00_director/task_briefs/<agent>.md` |
| `RUN_LOG_TEMPLATE.md` | Director / main session | `research/00_director/RUN_LOG.md` |
| `SPECIALIST_FINDINGS_TEMPLATE.md` | Each specialist | `research/<agent>/findings.md` (research findings) |
| `CROSS_REVIEW_TEMPLATE.md` | Reviewing specialist | `research/cross-review/<reviewer>__on__<target>.md` |
| `EXECUTIVE_SUMMARY_TEMPLATE.md` | Director | `outputs/00_executive_summary.md` |
| `FINAL_REPORT_TEMPLATE.md` | Director | `outputs/01_feasibility_report.md` |
| `FINANCIAL_SCENARIOS_TEMPLATE.md` | Banker + Director | `outputs/02_financial_scenarios.md` |
| `RECOMMENDATION_TEMPLATE.md` | Director | `outputs/04_recommendation.md` |
| `source_register.csv` | All | `research/<agent>/sources.csv` → `outputs/source_register.csv` |
| `assumption_register.csv` | All | `research/<agent>/assumptions.csv` → `outputs/assumption_register.csv` |
| `risk_register.csv` | All | `research/<agent>/risks.csv` → `outputs/03_risk_register.csv` |
| `disagreement_log.csv` | Director | `outputs/disagreement_log.csv` |

Evidence status values (see `CLAUDE.md` §2): `VERIFIED`, `SPONSOR`, `CALCULATED`, `ESTIMATE`, `ASSUMPTION`,
`PROJECTION`, `UNKNOWN`.

Source `quality_tier`: `1` official/regulatory statistics; `2` primary documents (filings, registries, contracts,
operator data); `3` credible institutional research; `4` reputable press; `5` other/unverified.

Risk `classification`: `DEAL-KILLER`, `SIGNIFICANT`, `MITIGABLE`, `NEEDS-SPECIALIST-VERIFICATION`.
