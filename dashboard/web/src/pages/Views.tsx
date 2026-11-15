import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { plainTask, poseFor, statusLine } from "../../../shared/presentation";
import { Character } from "../components/Character";
import { DocumentView } from "../components/DocumentView";
import { QualityChip, ReportChip, StatusPill, VerdictPill } from "../components/Pills";
import { DownloadButton, ReportReader } from "../components/Reports";
import { useStudyCtx } from "../App";
import { AGENT_META } from "../lib/agents";
import { fmtTime } from "../lib/format";

function NotReady({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-[15px] text-muted">{children}</div>;
}

export function AgentsPage() {
  const { state } = useStudyCtx();
  const [, setParams] = useSearchParams();
  if (!state) return null;
  const validation = state.study.kind === "validation";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
        {state.agents.map((a) => (
          <li key={a.name}>
            <button type="button" onClick={() => setParams({ agent: a.name })} className="flex w-full flex-col gap-3 px-4 py-3 text-left hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50 sm:flex-row sm:items-center">
              <Character agent={a.name} pose={poseFor(a)} size={96} title={`${AGENT_META[a.name]?.role} — ${a.status}`} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{AGENT_META[a.name]?.role} <span className="font-normal text-muted">· {AGENT_META[a.name]?.perspective}</span></p>
                <p className="text-sm text-ink">{statusLine(a, validation)}</p>
                <p className="text-xs text-muted">Last activity {fmtTime(a.lastActivityAt)} · {a.completedTasks.length} task(s) finished · {a.outstandingTasks.length} outstanding</p>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                <StatusPill status={a.status} /><ReportChip r={a.assessment.report} /><QualityChip q={a.assessment.quality} />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FindingsPage() {
  const { state, slug } = useStudyCtx();
  const [, setParams] = useSearchParams();
  const [reading, setReading] = useState<{ path: string; title: string } | null>(null);
  if (!state) return null;
  const specialists = state.agents.slice(1);
  const any = specialists.some((a) => a.assessment.insight.summary || a.assessment.report.present);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Research findings</h1>
        <p className="text-sm text-muted">What each specialist concluded, in their own words, with the full report one click away.</p>
      </div>
      {!any && <NotReady>{state.study.kind === "validation" ? "This validation run produced no research findings — it only tested that the agents run and record events." : "No specialist reports have been written yet. Findings appear here as each specialist finishes."}</NotReady>}
      {any && (
        <div className="grid gap-4 lg:grid-cols-2">
          {specialists.map((a) => {
            const { insight, report, quality } = a.assessment;
            const meta = AGENT_META[a.name];
            return (
              <article key={a.name} className="flex flex-col rounded-xl border border-line bg-white p-4">
                <div className="flex items-start gap-3">
                  <Character agent={a.name} pose={poseFor(a)} size={88} title={meta?.role ?? a.name} />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-ink">{meta?.role}</h2>
                    <p className="text-xs text-muted">{meta?.perspective}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">{insight.verdict && <VerdictPill verdict={insight.verdict} />}<ReportChip r={report} /><QualityChip q={quality} /></div>
                  </div>
                </div>
                {insight.summary ? <p className="mt-3 text-[15px] leading-relaxed text-ink">{insight.summary}</p> : <p className="mt-3 text-sm text-muted">Not ready — {plainTask(a.currentTask) ? `currently: ${plainTask(a.currentTask)}` : "no report yet"}.</p>}
                {insight.keyFindings.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">{insight.keyFindings.slice(0, 4).map((f, i) => <li key={i}>{f}</li>)}</ul>}
                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  {report.mainPath && <button type="button" className="rounded-md bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-2" onClick={() => setReading({ path: report.mainPath!, title: `${meta?.role} — full report` })}>Read full report</button>}
                  {report.mainPath && <DownloadButton slug={slug} path={report.mainPath} />}
                  <button type="button" className="rounded-md px-3 py-1.5 text-sm font-medium text-accent hover:underline" onClick={() => setParams({ agent: a.name })}>Sources, risks & disagreements →</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {reading && <ReportReader slug={slug} path={reading.path} title={reading.title} onClose={() => setReading(null)} />}
    </div>
  );
}

const FINAL_DOCS: { path: string; label: string; note: string }[] = [
  { path: "outputs/00_executive_summary.md", label: "Executive summary", note: "One-page decision brief" },
  { path: "outputs/04_recommendation.md", label: "Investment committee recommendation", note: "Verdict, conditions and dissent" },
  { path: "outputs/01_feasibility_report.md", label: "Integrated feasibility report", note: "The full study" },
  { path: "outputs/02_financial_scenarios.md", label: "Financial scenarios", note: "Base, downside, upside and stress cases" },
  { path: "outputs/03_risk_register.csv", label: "Risk register", note: "Consolidated risks" },
  { path: "outputs/assumption_register.csv", label: "Assumption register", note: "Every model input and its evidence status" },
  { path: "outputs/source_register.csv", label: "Source register", note: "All cited sources" },
  { path: "outputs/disagreement_log.csv", label: "Disagreement log", note: "Cross-agent challenges and resolutions" },
];

export function FinalReportPage() {
  const { state, slug } = useStudyCtx();
  const [reading, setReading] = useState<{ path: string; title: string } | null>(null);
  if (!state) return null;
  const present = new Set(state.documents.map((d) => d.path));
  const director = state.agents[0];
  const v = state.verdict;
  const modelFiles = state.documents.filter((d) => d.path.startsWith("models/"));
  const any = FINAL_DOCS.some((d) => present.has(d.path));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Final report</h1>
        <p className="text-sm text-muted">The Head of Market Research's integrated conclusion and the investment committee recommendation.</p>
      </div>
      {!any ? (
        <NotReady>{state.study.kind === "validation" ? "This validation run has no final report — it was a test of the agent system, not a study." : "Not ready — the final report is written after all six specialist assessments and the cross-review are complete."}</NotReady>
      ) : (
        <>
          <section className="flex flex-col gap-4 rounded-xl border border-line bg-white p-5 sm:flex-row sm:items-center">
            <div className="shrink-0">
              {v.verdict ? <VerdictPill verdict={v.verdict} large /> : <span className="rounded-md bg-slate-100 px-4 py-2 text-lg font-semibold text-muted">Verdict not issued</span>}
            </div>
            <div className="min-w-0">
              {v.reliability && <p className="text-sm text-muted">Evidence reliability: <b className="text-ink">{v.reliability}</b></p>}
              {director.assessment.insight.summary && <p className="mt-1 text-[15px] leading-relaxed text-ink">{director.assessment.insight.summary}</p>}
              <p className="mt-2 flex flex-wrap gap-2"><QualityChip q={director.assessment.quality} /><ReportChip r={director.assessment.report} /></p>
            </div>
          </section>
          <section className="grid gap-3 md:grid-cols-2">
            {FINAL_DOCS.map((d) => (
              <div key={d.path} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${present.has(d.path) ? "border-line bg-white" : "border-dashed border-line bg-slate-50"}`}>
                <div className="min-w-0">
                  <p className="font-medium text-ink">{d.label}</p>
                  <p className="text-xs text-muted">{present.has(d.path) ? d.note : "Not ready"}</p>
                </div>
                {present.has(d.path) && (
                  <div className="flex shrink-0 gap-2">
                    <button type="button" className="rounded-md bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-2" onClick={() => setReading({ path: d.path, title: d.label })}>Open</button>
                    <DownloadButton slug={slug} path={d.path} label="" />
                  </div>
                )}
              </div>
            ))}
          </section>
          {present.has("outputs/00_executive_summary.md") && (
            <section className="overflow-hidden rounded-xl border border-line bg-white">
              <h2 className="border-b border-line px-5 py-3 text-[13px] font-semibold uppercase tracking-wider text-muted">Director's synthesis</h2>
              <DocumentView slug={slug} path="outputs/00_executive_summary.md" />
            </section>
          )}
          {modelFiles.length > 0 && (
            <section className="rounded-xl border border-line bg-white p-4">
              <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-muted">Financial model files</h2>
              <ul className="space-y-1.5">
                {modelFiles.map((d) => (
                  <li key={d.path} className="flex items-center justify-between gap-2 text-sm">
                    <button type="button" className="truncate text-left text-accent hover:underline" onClick={() => setReading({ path: d.path, title: d.path.split("/").slice(-1)[0] })}>{d.path.split("/").slice(-1)[0]}</button>
                    <DownloadButton slug={slug} path={d.path} label="" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {reading && <ReportReader slug={slug} path={reading.path} title={reading.title} onClose={() => setReading(null)} />}
    </div>
  );
}
