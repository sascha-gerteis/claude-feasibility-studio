// Plain-language insights extracted from the documents agents actually wrote.
// Nothing here is generated: every string is copied (and lightly de-formatted) from a stored
// document, and every count is a count of real files or register rows.
import { csvObjects } from "./csv.js";
import type { DocumentRec } from "./types.js";

export interface RequiredDeliverable { path: string; label: string; present: boolean }
export interface ReportReadiness {
  required: RequiredDeliverable[];
  present: number;
  total: number;
  ready: boolean;
  mainPath?: string;
}
export type QualityStatus = "PASS" | "FAIL" | "NOT CHECKED";
export interface QualityResult {
  status: QualityStatus;
  checkedAt?: string;
  checks: { name: string; passed: boolean; detail?: string }[];
}
export interface AgentInsight {
  summary: string | null;
  verdict: string | null;
  confidence: string | null;
  keyFindings: string[];
}
export interface RiskItem { id?: string; risk: string; classification?: string; severity?: string; mitigation?: string }

const VERDICT_RE = /(CONDITIONAL GO|NO-GO|GO|DEFER)\b/;

export function plain(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]+/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function clip(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
}

/** Body text of the first heading matching `re` (until the next heading of the same or higher level). */
export function section(md: string, re: RegExp): string | null {
  const lines = md.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (!m || !re.test(m[2])) continue;
    const level = m[1].length;
    const body: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const n = /^(#{1,6})\s+/.exec(lines[j]);
      if (n && n[1].length <= level) break;
      body.push(lines[j]);
    }
    return body.join("\n").trim();
  }
  return null;
}

function firstParagraph(body: string): string | null {
  for (const para of body.split(/\n\s*\n/)) {
    const t = para.trim();
    if (!t || t.startsWith("|") || /^[-*]\s/.test(t) || t.startsWith(">") && /template/i.test(t)) continue;
    const p = plain(t.replace(/^>\s?/gm, ""));
    if (p.length > 20) return p;
  }
  return null;
}

/** Bullets or the most descriptive table column of a section, in document order. */
export function listItems(body: string, max: number): string[] {
  const out: string[] = [];
  const lines = body.split(/\r?\n/);
  const table = lines.filter((l) => l.trim().startsWith("|"));
  if (table.length >= 3) {
    const header = table[0].split("|").slice(1, -1).map((h) => plain(h).toLowerCase());
    const pick = (re: RegExp) => header.findIndex((h) => re.test(h) && !/\bid\b/.test(h));
    let col = [/finding/, /conclusion/, /claim/, /issue|risk/].map(pick).find((i) => i >= 0) ?? -1;
    if (col < 0) col = header.length > 1 ? 1 : 0;
    for (const row of table.slice(2)) {
      const cells = row.split("|").slice(1, -1);
      const v = plain(cells[col] ?? "");
      if (v && !/^-+$/.test(v)) out.push(v);
      if (out.length >= max) return out;
    }
  }
  for (const l of lines) {
    const m = /^\s*(?:[-*]|\d+[.)])\s+(.*)$/.exec(l);
    if (m) {
      const v = plain(m[1]);
      if (v.length > 8) out.push(v);
    }
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

export function extractVerdict(md: string): string | null {
  const m = /\*\*\s*(?:Preliminary verdict|Discipline verdict|Verdict|Recommendation)[^*\n]*:?\s*\*\*\s*:?\s*([^\n]+)/i.exec(md)
    ?? /^(?:Preliminary verdict|Verdict|Recommendation)\s*:\s*([^\n]+)/im.exec(md);
  if (!m) return null;
  const v = plain(m[1]);
  if (/GO\s*\/\s*CONDITIONAL/.test(v)) return null; // template placeholder listing every option
  return VERDICT_RE.exec(v.toUpperCase())?.[1] ?? null;
}

export function extractConfidence(md: string): string | null {
  const m = /\*\*\s*(?:Confidence|Research reliability|Reliability(?: of evidence)?)\s*:?\s*\*\*\s*:?\s*([^\n]+)/i.exec(md);
  if (!m) return null;
  const v = plain(m[1]).toUpperCase();
  if (v.includes(" / ")) return null;
  return /^(HIGH|MODERATE|MEDIUM|LOW)/.exec(v)?.[1] ?? null;
}

export function agentInsight(doc?: DocumentRec): AgentInsight {
  if (!doc) return { summary: null, verdict: null, confidence: null, keyFindings: [] };
  const md = doc.content;
  const summaryBody = section(md, /executive|summary|takeaway|thesis|bottom line/i);
  const findingsBody = section(md, /key findings|main findings|evidence.backed findings|findings/i);
  return {
    summary: summaryBody ? (firstParagraph(summaryBody) ? clip(firstParagraph(summaryBody)!, 420) : null) : null,
    verdict: extractVerdict(md),
    confidence: extractConfidence(md),
    keyFindings: findingsBody ? listItems(findingsBody, 6).map((f) => clip(f, 260)) : [],
  };
}

export function qualityFrom(doc?: DocumentRec): QualityResult {
  if (!doc) return { status: "NOT CHECKED", checks: [] };
  try {
    const q = JSON.parse(doc.content) as { status?: string; checked_at?: string; checks?: { name: string; passed: boolean; detail?: string }[] };
    const status: QualityStatus = q.status === "PASS" ? "PASS" : q.status === "FAIL" ? "FAIL" : "NOT CHECKED";
    return { status, checkedAt: q.checked_at, checks: Array.isArray(q.checks) ? q.checks : [] };
  } catch {
    return { status: "NOT CHECKED", checks: [] };
  }
}

const SEVERITY_ORDER = ["DEAL-KILLER", "SIGNIFICANT", "NEEDS-SPECIALIST-VERIFICATION", "MITIGABLE"];
export function risksFrom(doc?: DocumentRec, max = 8): RiskItem[] {
  if (!doc) return [];
  const rows = csvObjects(doc.content).map((r) => ({
    id: r.risk_id, risk: r.risk, classification: r.classification, severity: r.severity, mitigation: r.mitigation,
  })).filter((r) => r.risk);
  const rank = (r: RiskItem) => {
    const i = SEVERITY_ORDER.indexOf((r.classification ?? "").toUpperCase());
    return i < 0 ? 9 : i;
  };
  return rows.sort((a, b) => rank(a) - rank(b)).slice(0, max);
}

export const SPECIALIST_DELIVERABLES = [
  { file: "findings.md", label: "Full assessment report" },
  { file: "sources.csv", label: "Source register" },
  { file: "assumptions.csv", label: "Assumption register" },
  { file: "risks.csv", label: "Risk register" },
];
export const DIRECTOR_DELIVERABLES = [
  { path: "outputs/00_executive_summary.md", label: "Executive summary" },
  { path: "outputs/01_feasibility_report.md", label: "Integrated feasibility report" },
  { path: "outputs/02_financial_scenarios.md", label: "Financial scenarios" },
  { path: "outputs/03_risk_register.csv", label: "Consolidated risk register" },
  { path: "outputs/04_recommendation.md", label: "Investment committee recommendation" },
  { path: "outputs/source_register.csv", label: "Source register" },
  { path: "outputs/assumption_register.csv", label: "Assumption register" },
  { path: "outputs/disagreement_log.csv", label: "Disagreement log" },
];

export function readiness(agent: string, present: Set<string>, isDirector: boolean): ReportReadiness {
  const required = isDirector
    ? DIRECTOR_DELIVERABLES.map((d) => ({ path: d.path, label: d.label, present: present.has(d.path) }))
    : SPECIALIST_DELIVERABLES.map((d) => {
      const path = `research/${agent}/${d.file}`;
      return { path, label: d.label, present: present.has(path) };
    });
  const n = required.filter((r) => r.present).length;
  const mainPath = isDirector ? "outputs/01_feasibility_report.md" : `research/${agent}/findings.md`;
  return { required, present: n, total: required.length, ready: n === required.length, mainPath: present.has(mainPath) ? mainPath : undefined };
}

/** Paths whose CONTENT the derivation needs (everything else is metadata only). */
export function needsContent(path: string): boolean {
  return path.endsWith(".csv") || path.endsWith("quality_check.json") || /\/findings\.md$/.test(path) ||
    /^outputs\/0[0-4]_[^/]+\.md$/.test(path);
}
