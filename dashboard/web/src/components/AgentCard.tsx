import { Link } from "react-router-dom";
import type { AgentState } from "../../../shared/types";
import { AGENT_META, STAGE_LABEL } from "../lib/agents";
import { fmtTime, utc } from "../lib/format";
import { StatusBadge } from "./ui";

export function AgentCard({ agent, slug, prominent = false }: { agent: AgentState; slug: string; prominent?: boolean }) {
  const meta = AGENT_META[agent.name];
  const detail = `/studies/${slug}/agents/${agent.name}`;
  const reportLink = agent.reportPath ? `/studies/${slug}/reports?doc=${encodeURIComponent(agent.reportPath)}` : null;
  const findings = agent.deliverables.slice(0, prominent ? 6 : 4);

  return (
    <article
      className={`group flex flex-col rounded-md border bg-white transition hover:border-accent/60 hover:shadow-sm ${
        prominent ? "border-navy/30 border-t-4 border-t-navy" : "border-line"
      }`}
    >
      <Link to={detail} className="block px-4 pt-3 pb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Open ${meta?.role ?? agent.name}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{meta?.perspective}</p>
            <h3 className={`truncate font-semibold text-ink group-hover:text-accent ${prominent ? "text-lg" : "text-[15px]"}`}>{meta?.role ?? agent.title}</h3>
            <p className="font-mono text-[11px] text-muted">{agent.name}</p>
          </div>
          <StatusBadge status={agent.status} title={agent.statusReason} />
        </div>
        <p className="mt-1.5 line-clamp-2 text-[13px] text-muted">{meta?.focus ?? agent.description}</p>
      </Link>

      <div className="space-y-2 border-t border-line px-4 py-2.5 text-[13px]">
        <div>
          <span className="text-muted">Current task: </span>
          {agent.currentTask ? (
            <span className="text-ink">
              {agent.currentTask.stage && <span className="mr-1 rounded bg-slate-100 px-1.5 py-px text-[11px] text-slate-700">{STAGE_LABEL[agent.currentTask.stage]}</span>}
              {agent.currentTask.title}
            </span>
          ) : (
            <span className="text-muted">None recorded</span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span title={utc(agent.lastActivityAt)}><span className="text-muted">Last activity </span>{fmtTime(agent.lastActivityAt)}</span>
          <span><span className="text-muted">Completed </span><b className="font-semibold">{agent.completedTasks.length}</b></span>
          <span><span className="text-muted">Outstanding </span><b className="font-semibold">{agent.outstandingTasks.length}</b></span>
          {agent.failedTasks.length > 0 && <span className="text-rose-700"><span>Failed </span><b>{agent.failedTasks.length}</b></span>}
        </div>
        {(agent.counts.searches > 0 || agent.counts.fetches > 0) && (
          <div className="text-muted">Recorded research: {agent.counts.searches} web searches · {agent.counts.fetches} pages fetched</div>
        )}
      </div>

      <div className="flex-1 border-t border-line px-4 py-2.5">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Findings & deliverables</p>
        {findings.length ? (
          <ul className="space-y-0.5">
            {findings.map((d) => (
              <li key={d.path} className="truncate text-[13px]">
                <Link className="text-accent hover:underline" to={`/studies/${slug}/reports?doc=${encodeURIComponent(d.path)}`}>{d.path.split("/").slice(-1)[0]}</Link>
                <span className="ml-1.5 text-[11px] text-muted">{fmtTime(d.updatedAt)}</span>
              </li>
            ))}
            {agent.deliverables.length > findings.length && <li className="text-[12px] text-muted">+{agent.deliverables.length - findings.length} more</li>}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">No deliverables recorded yet</p>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-line px-4 py-2 text-[13px]">
        {reportLink ? (
          <Link to={reportLink} className="font-medium text-accent hover:underline">View full report →</Link>
        ) : (
          <span className="text-muted">Full report not yet recorded</span>
        )}
        <Link to={detail} className="text-muted hover:text-ink">Details</Link>
      </footer>
    </article>
  );
}
