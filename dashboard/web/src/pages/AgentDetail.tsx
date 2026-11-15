import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ActivityFeed, actorLabel } from "../components/ActivityFeed";
import { DocumentView } from "../components/DocumentView";
import { Empty, Kv, Panel, StatusBadge, TaskStateLabel } from "../components/ui";
import { useStudyCtx } from "../App";
import { AGENT_META, STAGE_LABEL } from "../lib/agents";
import { fmtDuration, fmtTime, utc } from "../lib/format";

const TABS = ["Timeline", "Research", "Sources", "Outputs", "Errors", "Disagreements"] as const;

export function AgentDetailPage() {
  const { state, slug } = useStudyCtx();
  const { name = "" } = useParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Timeline");
  const agent = state?.agents.find((a) => a.name === name);
  if (!state || !agent) return <p className="text-sm text-muted">Agent not found.</p>;
  const meta = AGENT_META[agent.name];
  const tasks = state.tasks.filter((t) => t.agent === agent.name).slice().reverse();
  const badge: Record<string, number> = {
    Errors: agent.errors.length, Disagreements: agent.disagreements.length, Sources: agent.sources.length, Outputs: agent.deliverables.length,
  };

  return (
    <div className="space-y-4">
      <nav className="text-sm"><Link to={`/studies/${slug}`} className="text-accent hover:underline">← Command Center</Link></nav>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Panel>
          <div className="px-5 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">{meta?.perspective}</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-ink">{meta?.role ?? agent.title}</h1>
              <StatusBadge status={agent.status} />
            </div>
            <p className="font-mono text-[12px] text-muted">{agent.name} · model {agent.model || "—"}</p>
            <p className="mt-2 text-sm text-ink">{agent.description}</p>
            <p className="mt-3 rounded bg-slate-50 px-3 py-2 text-[13px] text-muted">
              <b className="text-ink">Status basis:</b> {agent.statusReason}
            </p>
          </div>
        </Panel>
        <Panel title="Summary">
          <dl className="space-y-1.5 px-4 py-3">
            <Kv k="Current task" v={agent.currentTask?.title ?? "None"} />
            <Kv k="Last activity" v={<span title={utc(agent.lastActivityAt)}>{fmtTime(agent.lastActivityAt)}</span>} />
            <Kv k="Recorded runs" v={agent.counts.runs} />
            <Kv k="Completed / outstanding / failed" v={`${agent.completedTasks.length} / ${agent.outstandingTasks.length} / ${agent.failedTasks.length}`} />
            <Kv k="Web searches / pages fetched" v={`${agent.counts.searches} / ${agent.counts.fetches}`} />
            <Kv k="Files written" v={agent.counts.writes} />
          </dl>
          {agent.reportPath && (
            <div className="border-t border-line px-4 py-2.5 text-sm">
              <Link to={`/studies/${slug}/reports?doc=${encodeURIComponent(agent.reportPath)}`} className="font-medium text-accent hover:underline">View full report →</Link>
            </div>
          )}
        </Panel>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t ? "border-navy text-navy" : "border-transparent text-muted hover:text-ink"}`}>
            {t}{badge[t] ? <span className="ml-1.5 rounded bg-slate-100 px-1.5 text-[11px] text-slate-700">{badge[t]}</span> : null}
          </button>
        ))}
      </div>

      {tab === "Timeline" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Task ledger">
            {tasks.length === 0 ? <Empty>No tasks recorded for this agent.</Empty> : (
              <ul className="divide-y divide-line">
                {tasks.map((t) => (
                  <li key={t.id} className="px-4 py-2.5 text-[13px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <TaskStateLabel state={t.state} />
                      {t.stage && <span className="rounded bg-slate-100 px-1.5 text-[11px]">{STAGE_LABEL[t.stage]}</span>}
                      {t.background && <span className="text-[11px] text-muted">background</span>}
                    </div>
                    <p className="font-medium text-ink">{t.title}</p>
                    <p className="text-[12px] text-muted">
                      {t.assignedAt && <>assigned {fmtTime(t.assignedAt)} · </>}
                      {t.dispatchedAt && <>dispatched {fmtTime(t.dispatchedAt)} · </>}
                      {t.startedAt && <>started {fmtTime(t.startedAt)} · </>}
                      {t.endedAt && <>ended {fmtTime(t.endedAt)}</>}
                      {t.durationMs != null && <> · {fmtDuration(t.durationMs)}</>}
                      {t.tokens != null && <> · {t.tokens.toLocaleString()} tokens</>}
                      {t.model && <> · {t.model}</>}
                    </p>
                    {t.error && <p className="text-[12px] text-rose-700">{t.error}</p>}
                    {t.resultExcerpt && <p className="mt-1 line-clamp-3 whitespace-pre-wrap rounded bg-slate-50 px-2 py-1 text-[12px] text-ink">{t.resultExcerpt}</p>}
                    {t.runId && <p className="font-mono text-[11px] text-muted">run {t.runId}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <ActivityFeed items={state.feed} agentFilter={agent.name} collapsedCount={15} />
        </div>
      )}

      {tab === "Research" && (
        agent.reportPath ? <Panel title={`Findings — ${agent.reportPath}`}><DocumentView slug={slug} path={agent.reportPath} /></Panel> : (
          <Panel title="Recorded research activity">
            {agent.activity.length === 0 ? <Empty>No findings document and no research activity recorded yet.</Empty> : null}
          </Panel>
        )
      )}
      {tab === "Research" && agent.activity.length > 0 && (
        <Panel title={`Recorded tool activity (${agent.activity.length})`}>
          <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto">
            {agent.activity.slice().reverse().map((a, i) => (
              <li key={i} className="flex gap-3 px-4 py-1.5 text-[12px]">
                <time className="w-32 shrink-0 font-mono text-muted">{fmtTime(a.ts)}</time>
                <span className={`w-20 shrink-0 font-semibold ${a.error ? "text-rose-700" : "text-ink"}`}>{a.tool}</span>
                <span className="break-all text-ink">{a.summary}{a.error && <span className="text-rose-700"> — {a.error}</span>}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {tab === "Sources" && (
        <Panel title="Source references">
          {agent.sources.length === 0 ? <Empty>No source register rows and no web research recorded for this agent.</Empty> : (
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50 text-left text-[12px] text-muted">
                <tr><th className="px-4 py-2">Origin</th><th className="px-2 py-2">ID</th><th className="px-2 py-2">Title / query</th><th className="px-2 py-2">Publisher</th><th className="px-2 py-2">Date</th><th className="px-2 py-2">URL / path</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {agent.sources.map((s, i) => (
                  <tr key={i}>
                    <td className="px-4 py-1.5 text-muted">{s.origin === "register" ? "Register" : s.origin === "web-fetch" ? "Fetched page" : "Web search"}</td>
                    <td className="px-2 py-1.5 font-mono text-[12px]">{s.id ?? ""}</td>
                    <td className="px-2 py-1.5">{s.title ?? ""}</td>
                    <td className="px-2 py-1.5">{s.publisher ?? ""}</td>
                    <td className="px-2 py-1.5">{s.date ?? fmtTime(s.ts)}</td>
                    <td className="max-w-[360px] break-all px-2 py-1.5">
                      {s.url && /^https?:\/\//.test(s.url) ? <a href={s.url} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">{s.url}</a> : s.url}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {tab === "Outputs" && (
        <Panel title="Completed outputs">
          {agent.deliverables.length === 0 ? <Empty>No outputs recorded.</Empty> : (
            <ul className="divide-y divide-line">
              {agent.deliverables.map((d) => (
                <li key={d.path} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-[13px]">
                  <Link className="font-mono text-accent hover:underline" to={`/studies/${slug}/reports?doc=${encodeURIComponent(d.path)}`}>{d.path}</Link>
                  <span className="text-[12px] text-muted">recorded {fmtTime(d.updatedAt)} · {d.versions} version{d.versions === 1 ? "" : "s"}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === "Errors" && (
        <Panel title="Errors and interrupted runs">
          {agent.errors.length === 0 ? <Empty>No errors recorded for this agent.</Empty> : (
            <ul className="divide-y divide-line">
              {agent.errors.slice().reverse().map((e, i) => (
                <li key={i} className="px-4 py-2 text-[13px]">
                  <time className="font-mono text-[12px] text-muted">{fmtTime(e.ts)}</time>
                  <p className="text-rose-800">{e.message}</p>
                  {e.runId && <p className="font-mono text-[11px] text-muted">run {e.runId}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === "Disagreements" && (
        <Panel title="Disagreements with other specialists">
          {agent.disagreements.length === 0 ? <Empty>No disagreements recorded in outputs/disagreement_log.csv or cross-review memos for this agent.</Empty> : (
            <ul className="divide-y divide-line">
              {agent.disagreements.map((d, i) => (
                <li key={i} className="px-4 py-2 text-[13px]">
                  <p className="text-[12px] text-muted">
                    {d.origin === "cross-review" ? "Cross-review memo" : `Disagreement log ${d.id ?? ""}`} · {actorLabel(d.raisedBy)} → {actorLabel(d.challenged)}
                    {d.status && <> · {d.status}</>}
                  </p>
                  <p className="text-ink">{d.topic}</p>
                  {d.resolution && <p className="text-[12px] text-muted">Resolution: {d.resolution}</p>}
                  {d.path && <Link className="text-[12px] text-accent hover:underline" to={`/studies/${slug}/reports?doc=${encodeURIComponent(d.path)}`}>Open memo</Link>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
