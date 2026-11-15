import { Link, useSearchParams } from "react-router-dom";
import type { AgentState, StudyState } from "../../../shared/types";
import { dataMode, poseFor, statusLine } from "../../../shared/presentation";
import { Character } from "../components/Character";
import { QualityChip, ReportChip, StatusPill, VerdictPill } from "../components/Pills";
import { useStudyCtx } from "../App";
import { AGENT_META } from "../lib/agents";
import { HOSTED } from "../lib/api";
import type { HostedState } from "../lib/artifactdb";
import { fmtTime } from "../lib/format";

const STAGE_SHORT: Record<string, string> = {
  "document-analysis": "Documents", "independent-research": "Specialist research", "cross-review": "Cross-review",
  "financial-validation": "Financial check", "final-report": "Final report", "ic-decision": "IC decision",
};

export function ModeBadges({ state, connected }: { state: StudyState; connected: boolean }) {
  const modes = dataMode(state, { hosted: HOSTED, connected });
  return (
    <div className="flex flex-wrap gap-2">
      {modes.map((m) => (
        <span key={m.key} title={m.detail}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tracking-wider ${
            m.key === "TEST DATA" ? "bg-violet-700 text-white" : m.key === "LIVE" ? "bg-blue-700 text-white" : m.key === "NOT LIVE" ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-800"}`}>
          {m.key === "LIVE" && <span className="status-dot-live h-1.5 w-1.5 rounded-full bg-white" aria-hidden />}{m.key}
        </span>
      ))}
    </div>
  );
}

function ProjectOverview({ state, connected }: { state: StudyState; connected: boolean }) {
  const sync = (state as HostedState).__sync;
  const verdict = state.verdict.verdict;
  const o = state.overview;
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-3">
          <ModeBadges state={state} connected={connected} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{state.study.kind === "validation" ? "Validation run" : "Current project"}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-ink [text-wrap:balance] sm:text-3xl">{state.study.name}</h1>
            {state.study.location && <p className="text-sm text-muted">{state.study.location}</p>}
          </div>
          <p className="text-sm text-muted">
            {HOSTED ? <>Last synced <b className="text-ink">{fmtTime(sync?.syncedAt)}</b> · covers activity up to {fmtTime(sync?.eventsThrough)}</>
              : <>Last recorded activity <b className="text-ink">{fmtTime(state.lastEventAt)}</b></>}
          </p>
          <ol className="flex flex-wrap gap-2" aria-label="Research stages">
            {state.stages.map((s) => {
              const have = s.evidence.filter((e) => e.present).length;
              const done = s.status === "Completed";
              return (
                <li key={s.key} title={s.reason}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] ${done ? "border-emerald-200 bg-emerald-50 text-emerald-900" : s.status === "Attention" ? "border-rose-200 bg-rose-50 text-rose-900" : s.status === "In progress" ? "border-blue-200 bg-blue-50 text-blue-900" : "border-line bg-slate-50 text-slate-600"}`}>
                  <span aria-hidden>{done ? "✓" : s.status === "Attention" ? "!" : s.status === "In progress" ? "●" : "○"}</span>
                  {STAGE_SHORT[s.key]} <span className="tabular-nums opacity-70">{have}/{s.evidence.length}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Agents working now" value={o.activeAgents} />
          <Stat label="Assessments complete" value={`${o.completedAssessments} of ${o.specialistsTotal}`} hint="Report written and quality-checked" />
          <Link to="?blockers=1" className={`rounded-lg border p-3 ${state.blockers.length ? "border-rose-200 bg-rose-50 hover:bg-rose-100" : "border-line bg-slate-50"}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Open blockers</p>
            <p className={`text-2xl font-semibold tabular-nums ${state.blockers.length ? "text-rose-800" : "text-ink"}`}>{state.blockers.length}</p>
          </Link>
          <div className="rounded-lg border border-line bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Recommendation</p>
            {verdict ? <div className="mt-1"><VerdictPill verdict={verdict} /></div> : <p className="mt-1 text-sm text-muted">Not issued yet</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-slate-50 p-3" title={hint}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

export function Station({ agent, validation, director = false }: { agent: AgentState; validation: boolean; director?: boolean }) {
  const [, setParams] = useSearchParams();
  const meta = AGENT_META[agent.name];
  const pose = poseFor(agent);
  const { report, quality, insight } = agent.assessment;
  const open = () => setParams({ agent: agent.name });
  return (
    <article className={`group relative flex flex-col rounded-xl border bg-white shadow-sm transition hover:shadow-md ${director ? "border-navy/25" : "border-line"} ${agent.status === "Working" ? "ring-2 ring-blue-200" : ""}`}>
      <button type="button" onClick={open} className="flex flex-1 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
        aria-label={`${meta?.role}: ${statusLine(agent, validation)}. Open details`}>
        <div className={`flex items-end justify-center rounded-t-xl ${director ? "bg-gradient-to-b from-slate-100 to-white" : "bg-gradient-to-b from-slate-50 to-white"} px-3 pt-3`}>
          <Character agent={agent.name} pose={pose} size={director ? 230 : 190} title={`${meta?.role} — ${agent.status}`} />
        </div>
        <div className="flex flex-1 flex-col gap-2 px-4 pb-3 pt-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className={`font-semibold leading-tight text-ink group-hover:text-accent ${director ? "text-xl" : "text-[16px]"}`}>{meta?.role}</h3>
              <p className="text-[12px] text-muted">{meta?.perspective}</p>
            </div>
            <StatusPill status={agent.status} />
          </div>
          <p className="text-[14px] leading-snug text-ink">{statusLine(agent, validation)}</p>
          {insight.summary && <p className="line-clamp-2 text-[13px] leading-snug text-muted">“{insight.summary}”</p>}
          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
            <ReportChip r={report} /><QualityChip q={quality} />{insight.verdict && <VerdictPill verdict={insight.verdict} />}
          </div>
          <p className="text-[12px] text-muted">Last activity {fmtTime(agent.lastActivityAt)}</p>
        </div>
      </button>
      <div className="border-t border-line px-4 py-2.5">
        <button type="button" onClick={open} className="text-sm font-semibold text-accent hover:underline">
          {report.mainPath ? "Open findings →" : "View details →"}
        </button>
      </div>
    </article>
  );
}

export function OfficePage() {
  const { state, stream } = useStudyCtx();
  if (!state) return null;
  const [director, ...specialists] = state.agents;
  const validation = state.study.kind === "validation";
  return (
    <div className="space-y-6">
      <ProjectOverview state={state} connected={stream === "connected"} />
      <section aria-label="Research office" className="space-y-4">
        <div className="mx-auto max-w-2xl">
          <Station agent={director} validation={validation} director />
          <p className="mt-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted">Directs and reviews the six specialists</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {specialists.map((a) => <Station key={a.name} agent={a} validation={validation} />)}
        </div>
      </section>
    </div>
  );
}
