# inputs/ — project brief and source documents

| Path | Purpose | In git? |
| --- | --- | --- |
| `PROJECT_BRIEF.md` | Fill in before a study. Bracketed/blank fields are treated as UNKNOWN. | yes |
| `source_documents/` | Sponsor feasibility study, master plan, cost plans, market reports, data files (PDF, XLSX, CSV, DOCX, MD). | yes — **repo may be public** |
| `confidential/` | Private financials, contracts, personal data. Agents read it; git ignores it. | **no** |
| `examples/` | Unverified illustrations only. Never project evidence. | yes |

Name files descriptively, e.g. `2026-10_sponsor_feasibility_study_v3.pdf`, `2026-09_cost_plan_QS.xlsx`.
Large PDFs: agents read them in page ranges; list key page numbers in the brief's Evidence section if you can.
