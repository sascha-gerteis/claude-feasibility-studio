# Public-practice-inspired institutional research protocol

**Status:** supplementary to `CLAUDE.md` and each specialist's instructions. Higher-priority user evidence constraints always prevail. Public firms' real practices are not fully observable; every recommendation here is **our adapted method** grounded in disclosed examples.

## Source-mode gate (MUST execute first)
1. Read the specific study's scope and authorized evidence mode from its brief, prompts and (where available) private study config.
2. `INTERNAL_DOCUMENT_ONLY` (current Aquaverse V4.0 -> V5.0): **use V4.0 as the only project evidence**. The public case library may guide audit *questions, structure, failure modes and techniques*, but must not appear as evidence for the project's market demand, prices, construction timelines, cost factors, regulations, tax, financing availability, hotel performance or technology efficacy. Mark every non-V4 factual input UNKNOWN; show hypothetical formula structures symbolically unless V4 has inputs. Cite V4 page / section / table / line.
3. `EXTERNAL_RESEARCH_ALLOWED` (only when explicitly authorized): collect contemporary, dated primary sources; then independent corroboration for material figures; log time period, region, units and status. Even here, external cases are analogues requiring transferability tests, never direct comparables without adjustments.
4. Never claim a public firm worked on Aquaverse or endorsed a finding. Avoid logos, actual-executive impersonation and unsupported "proprietary methodology" claims.

## Mandatory 10-step analytical cycle (each agent)
1. **Issue tree:** define decision, hypotheses (including the 'project may be uneconomic' null), workstream boundaries, and falsification conditions.
2. **Evidence map:** list every relevant available V4 page/table and every factual claim extracted; split facts / author assertions / projections / assumptions / calculations / unknowns.
3. **Bottom-up reconstruction:** use relevant units (room-nights, ticket-days, m2 leaseable, units sold, kWh, m3 water, construction work packages, debt draws). Recompute relationships rather than restating top-line forecasts.
4. **Alternative pathways:** at least 2 plausible options including 'do less / phase later' and 'no new technology' where relevant.
5. **Constraint test:** identify physical capacity, regulatory sign-offs, critical-path dependencies, financing availability, maintenance/operations capability; distinguish true showstoppers from fixable gaps.
6. **Financial bridge:** map all recommendations to capex timing, opex, maintenance, revenue, working capital and sensitivity. Do not double-count shared savings, visitors, rooms, sales or infrastructure.
7. **Downside/failure case:** at least 3 disconfirming scenarios or mechanisms with quantitative sensitivity when inputs exist; otherwise specify missing inputs and symbolic relationships.
8. **Cross-agent handoff:** name affected disciplines, exact assumption ID, proposed change, evidence and what the other agent should recalculate. No silent edits to another agent's model.
9. **Traceability:** source per material fact; original document page/table when INTERNAL_DOCUMENT_ONLY; calculation formula and linked inputs for every derived numeric result. Disclose uncertainty rather than adding apparent precision.
10. **Decision-ready output:** one-page verdict, robust technical annex, top risks, ranked actions, owners, verification dependencies, scenario thresholds, dissent, and an explicit 'what would change the verdict' section.

## Controls for projects with many overlapping assets
- **Asset register:** each hotel, conference center, retail street, waterpark, residential/office/mixed-use, back-of-house utility area, roads and common areas should have unique identifiers **only if actually present in V4.0**.
- **Shared-cost bridge:** allocate common area utilities, security, engineering, transport, marketing, digital platforms, upkeep and capital contingencies; state basis or UNKNOWN.
- **Demand bridge:** visitors vs hotel guests vs retail transactions are distinct metrics; trace overlaps and cross-sell rather than adding unverified flows.
- **Phasing:** link design freeze, EIA or permitting **where relevant**, utility connection, financing commitments, pre-leasing/partners, procurement, build, commissioning and ramp-up with hold points.
- **Program flexibility:** compare approved vs proposed vs speculative buildings; never redesign actual footprints as part of a feasibility-method update.
- **Value of optionality:** prefer staged decisions when uncertainty is high; show what is lost by waiting versus what risk is avoided.

## Public example transferability tests
For each external case used to inspire a recommendation, write:
- Public source and the actual firm's role (investor / adviser / project consultant / technology builder).
- What happened publicly; what is not disclosed.
- Mechanism (e.g., funding diversification, design-to-cost, preleasing, impact KPIs, evaluator-optimizer).
- Differences in asset, jurisdiction, capex scale, sponsor, technology maturity, time period, customer segment, and regulatory system.
- Which aspect of the method **can** be adapted; which figures / outcomes / assumptions **cannot**.
- A validation question and required input from V4.0 or a missing document.

## Research stopping rule
Research until the defined question is answered with sufficient admissible evidence or clearly unresolved; do not continue web browsing for cosmetic citations. If web access is disabled by scope, obey it even if the agent normally has WebSearch access.

## Model and dashboard safety
An agent's hook-run completion is not report quality approval. Keep separate task status, evidence/quality gate, final study decision. Do not change public case examples or agent configuration mid-run; version changes and compare a representative report before/after.
