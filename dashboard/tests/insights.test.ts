import { describe, expect, it } from "vitest";
import { agentInsight, extractVerdict, listItems, qualityFrom, readiness, risksFrom, section } from "../shared/insights";
import type { DocumentRec } from "../shared/types";

const doc = (path: string, content: string): DocumentRec => ({ study: "s", path, sha256: "a".repeat(64), size: content.length, updatedAt: "2026-11-15T10:00:00Z", versions: 1, content });

const FINDINGS = `# Research Findings — real-estate-hospitality
**Preliminary verdict:** DEFER · **Confidence:** LOW

## 1. Executive thesis (max 150 words)
Pattaya's hotel market is active, but **nothing** in the supplied study shows incremental demand for 1,250 new keys [S3].

## 2. Evidence-backed findings
| Claim ID | Finding (with numeric definition) | Status | Source ID(s) |
| --- | --- | --- | --- |
| RE-1 | Pattaya H1 2026 ADR reported at THB 3,663 | VERIFIED | S3 |
| RE-2 | Occupancy "nearing 80%" conflicts with a 72.7% secondary series | VERIFIED | S3, S4 |
`;

describe("insights are copied from real documents", () => {
  it("extracts summary, verdict, confidence and findings", () => {
    const i = agentInsight(doc("research/real-estate-hospitality/findings.md", FINDINGS));
    expect(i.verdict).toBe("DEFER");
    expect(i.confidence).toBe("LOW");
    expect(i.summary).toMatch(/^Pattaya's hotel market is active, but nothing/);
    expect(i.keyFindings).toEqual(["Pattaya H1 2026 ADR reported at THB 3,663", 'Occupancy "nearing 80%" conflicts with a 72.7% secondary series']);
  });

  it("returns empty insight when no report exists (Not ready state)", () => {
    expect(agentInsight(undefined)).toEqual({ summary: null, verdict: null, confidence: null, keyFindings: [] });
  });

  it("ignores template placeholders listing every verdict", () => {
    expect(extractVerdict("**Preliminary verdict:** GO / CONDITIONAL GO / DEFER / NO-GO")).toBeNull();
    expect(extractVerdict("**Preliminary verdict:** CONDITIONAL GO — subject to gates")).toBe("CONDITIONAL GO");
  });

  it("reads bullets when there is no table", () => {
    expect(listItems("- first finding here\n- second finding here", 5)).toEqual(["first finding here", "second finding here"]);
    expect(section("# A\nx\n## B\ny\n# C\nz", /^B$/)).toBe("y");
  });

  it("separates report readiness from task status", () => {
    const r = readiness("ai-strategy", new Set(["research/ai-strategy/findings.md", "research/ai-strategy/sources.csv"]), false);
    expect(r).toMatchObject({ present: 2, total: 4, ready: false, mainPath: "research/ai-strategy/findings.md" });
  });

  it("quality status is NOT CHECKED without a recorded gate, and parses PASS/FAIL", () => {
    expect(qualityFrom(undefined).status).toBe("NOT CHECKED");
    expect(qualityFrom(doc("q", '{"status":"FAIL","checks":[{"name":"x","passed":false}]}')).status).toBe("FAIL");
    expect(qualityFrom(doc("q", "not json")).status).toBe("NOT CHECKED");
  });

  it("orders risks with deal-killers first", () => {
    const r = risksFrom(doc("r.csv", "risk_id,risk,classification\nR1,minor,MITIGABLE\nR2,fatal,DEAL-KILLER\n"));
    expect(r.map((x) => x.id)).toEqual(["R2", "R1"]);
  });
});
