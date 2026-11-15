import { useState } from "react";
import type { AgentState, StudyState } from "../../../shared/types";
import { plainTask, poseFor, statusLine } from "../../../shared/presentation";
import { AGENT_META } from "../lib/agents";
import { fmtDuration, fmtTime } from "../lib/format";
import { Character } from "./Character";
import { DownloadButton, Dialog, ReportReader } from "./Reports";
import { QualityChip, ReportChip, StatusPill, VerdictPill } from "./Pills";

const name = (a: string) => AGENT_META[a]?.role ?? (a === "orchestrator" ? "Orchestrator" : a);

function Block({ title, children, empty }: { title: string; children?: React.ReactNode; empty?: string | false }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {empty ? <p className="text-sm text-muted">{empty}</p> : children}
    </section>
  );
}

export function AgentDrawer({ agent, state, slug, onClose }: { agent: AgentState; state: StudyState; slug: string; onClose: () => void }) {
  const [reading, setReading] = useState(false);
  const [tech, setTech] = useState(false);
  const meta = AGENT_META[agent.name];
  const validation = state.study.kind === "validation";
  const { report, quality, insight, risks } = agent.assessment;
  const registered = agent.sources.filter((s) => s.origin === "register");
  const tiers = registered.reduce<Record<string, number>>((m, s) => { const k = s.quality ? `Tier ${s.quality}` : "Unrated"; m[k] = (m[k] ?? 0) + 1; return m; }, {});
  const task = plainTask(agent.currentTask);

  return (
    <Dialog title={meta?.role ?? agent.title} onClose={onClose}
      actions={report.mainPath ? <DownloadButton slug={slug} path={report.mainPath} label="Download report" /> : undefined}>
      <div className="space-y-4 p-5">
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-white p-4 sm:flex-row sm:items-center">
          <Character agent={agent.name} pose={poseFor(agent)} size={150} title={`${meta?.role}: ${agent.status}`} />
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{meta?.perspective} · {meta?.focus}</p>
            <div className="flex flex-wrap gap-2"><StatusPill status={agent.status} /><ReportChip r={report} /><QualityChip q={quality} /></div>
            <p className="text-[15px] text-ink">{statusLine(agent, validation)}</p>
            {agent.lastActivityAt && <p className="text-sm text-muted">Last activity {fmtTime(agent.lastActivityAt)}</p>}
            {report.mainPath && (
              <button type="button" onClick={() => setReading(true)} className="rounded-md bg-navy px-3.5 py-2 text-sm font-semibold text-white hover:bg-navy-2">
                Read full report
              </button>
            )}
          </div>
        </div>

        <Block title="What it is researching now" empty={!task && (agent.status === "Completed" ? "No task in progress — its latest task has finished." : "Nothing in progress.")}>
          <p className="text-[15px] text-ink">{task}</p>
          {agent.currentTask?.startedAt && <p className="mt-1 text-sm text-muted">Started {fmtTime(agent.currentTask.startedAt)}</p>}
        </Block>

        <Block title="Executive takeaway" empty={!insight.summary && (validation ? "This is a validation run — there is no research report." : "Not ready — the full report has not been written yet.")}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {insight.verdict && <VerdictPill verdict={insight.verdict} />}
            {insight.confidence && <span className="text-sm text-muted">Confidence: <b className="text-ink">{insight.confidence}</b></span>}
          </div>
          <p className="text-[15px] leading-relaxed text-ink">{insight.summary}</p>
        </Block>

        <Block title="Main findings" empty={insight.keyFindings.length === 0 && "Not ready — no findings recorded yet."}>
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink">{insight.keyFindings.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </Block>

        <Block title="Evidence and sources" empty={agent.sources.length === 0 && "No sources recorded yet."}>
          {registered.length > 0 && (
            <p className="mb-2 text-sm text-muted">{registered.length} registered sources · {Object.entries(tiers).map(([k, v]) => `${k}: ${v}`).join(" · ")} <span className="text-xs">(Tier 1 = official statistics; 5 = unverified)</span></p>
          )}
          <ul className="space-y-1.5 text-sm">
            {registered.slice(0, 10).map((s, i) => (
              <li key={i} className="text-ink">
                {s.url && /^https?:\/\//.test(s.url) ? <a className="text-accent hover:underline" href={s.url} target="_blank" rel="noreferrer noopener">{s.title || s.url}</a> : (s.title || s.url)}
                {s.publisher && <span className="text-muted"> — {s.publisher}</span>}{s.date && <span className="text-muted">, {s.date}</span>}
              </li>
            ))}
          </ul>
          {registered.length === 0 && <p className="text-sm text-muted">{agent.counts.searches} web searches and {agent.counts.fetches} pages fetched were recorded; no source register yet.</p>}
        </Block>

        <Block title="Risks" empty={risks.length === 0 && "No risk register recorded yet."}>
          <ul className="space-y-2 text-sm">
            {risks.map((r, i) => (
              <li key={i} className="rounded border border-line px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {r.classification && <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${/DEAL/i.test(r.classification) ? "bg-rose-100 text-rose-800" : /SIGNIF/i.test(r.classification) ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{r.classification}</span>}
                  <span className="text-ink">{r.risk}</span>
                </div>
                {r.mitigation && <p className="mt-1 text-muted">Mitigation: {r.mitigation}</p>}
              </li>
            ))}
          </ul>
        </Block>

        <Block title="Disagreements with other specialists" empty={agent.disagreements.length === 0 && "None recorded."}>
          <ul className="space-y-1.5 text-sm">
            {agent.disagreements.map((d, i) => (
              <li key={i} className="text-ink">
                <b>{name(d.raisedBy)}</b> challenged <b>{name(d.challenged)}</b>: {d.topic}
                {d.resolution && <span className="text-muted"> — Resolution: {d.resolution}</span>}
              </li>
            ))}
          </ul>
        </Block>

        <Block title="Report completion">
          <ul className="space-y-1 text-sm">
            {report.required.map((r) => <li key={r.path} className={r.present ? "text-emerald-800" : "text-muted"}>{r.present ? "✓" : "○"} {r.label}</li>)}
          </ul>
          <p className="mt-3 text-sm text-ink">
            Quality check: <b>{quality.status === "NOT CHECKED" ? "not run yet" : quality.status === "PASS" ? "passed" : "failed"}</b>
            {quality.checkedAt && <span className="text-muted"> ({fmtTime(quality.checkedAt)})</span>}
          </p>
          {quality.checks.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-[13px]">
              {quality.checks.map((c, i) => <li key={i} className={c.passed ? "text-emerald-800" : "text-rose-700"}>{c.passed ? "✓" : "✗"} {c.name}{c.detail ? <span className="text-muted"> — {c.detail}</span> : null}</li>)}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">The automated check verifies structure, citations and registers, not whether conclusions are right.</p>
        </Block>

        <div className="rounded-lg border border-dashed border-line bg-white">
          <button type="button" className="w-full px-4 py-2.5 text-left text-sm font-medium text-muted hover:text-ink" aria-expanded={tech} onClick={() => setTech(!tech)}>
            {tech ? "▾" : "▸"} Technical details
          </button>
          {tech && (
            <div className="space-y-3 border-t border-line px-4 py-3 text-[12px]">
              <p className="text-muted">Status basis: {agent.statusReason}</p>
              <div>
                <p className="font-semibold text-ink">Task runs</p>
                {[...agent.completedTasks, ...agent.outstandingTasks, ...agent.failedTasks].map((t) => (
                  <p key={t.id} className="font-mono text-muted">{t.state.toUpperCase()} · {t.title} · started {fmtTime(t.startedAt)} · ended {fmtTime(t.endedAt)} · {fmtDuration(t.durationMs)} · run {t.runId ?? "—"}</p>
                ))}
              </div>
              <div>
                <p className="font-semibold text-ink">Files</p>
                {agent.deliverables.map((d) => <p key={d.path} className="font-mono text-muted">{d.path} · {fmtTime(d.updatedAt)} · {d.versions} version(s)</p>)}
              </div>
              <div>
                <p className="font-semibold text-ink">Recorded tool activity ({agent.activity.length})</p>
                {agent.activity.slice(-40).reverse().map((a, i) => <p key={i} className="break-all font-mono text-muted">{fmtTime(a.ts)} {a.tool} {a.summary}{a.error ? ` — ${a.error}` : ""}</p>)}
              </div>
            </div>
          )}
        </div>
      </div>
      {reading && report.mainPath && <ReportReader slug={slug} path={report.mainPath} title={`${meta?.role} — full report`} onClose={() => setReading(false)} />}
    </Dialog>
  );
}
