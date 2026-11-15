// Static presentation metadata mirroring the team table in CLAUDE.md (configuration, not status).
export const AGENT_META: Record<string, { role: string; perspective: string; focus: string }> = {
  "head-of-market-research": {
    role: "Head of Market Research", perspective: "Master Director",
    focus: "Research plan, delegation, cross-review, reconciliation, investment committee recommendation",
  },
  "investment-banking": {
    role: "Senior Investment Banker", perspective: "Goldman Sachs-style",
    focus: "Capex/opex, DCF, NPV, IRR, MOIC, WACC, scenarios, bankability",
  },
  "project-technology": {
    role: "Head of Projects & Technology", perspective: "McKinsey-style",
    focus: "Deliverability, infrastructure, phasing, procurement, critical path",
  },
  syndications: {
    role: "Head of Capital Syndications", perspective: "Morgan Stanley-style",
    focus: "Capital stack, investors, lenders, covenants, raise sequence, exit",
  },
  "real-estate-hospitality": {
    role: "Head of Real Estate & Hospitality", perspective: "JLL-style",
    focus: "Demand/supply, comparables, ADR, occupancy, absorption, mix",
  },
  "ai-strategy": {
    role: "Head of Artificial Intelligence", perspective: "Anthropic-style",
    focus: "AI use cases, build vs buy, ROI, governance, security",
  },
  "environmental-technologies": {
    role: "Head of Environmental Technologies", perspective: "Bain Capital-style",
    focus: "Energy, water, waste, resilience, permitting, green finance",
  },
};

export const STAGE_LABEL: Record<string, string> = {
  "document-analysis": "Document analysis",
  "independent-research": "Independent research",
  "cross-review": "Cross-agent review",
  "financial-validation": "Financial validation",
  "final-report": "Final report",
  "ic-decision": "IC decision",
};
