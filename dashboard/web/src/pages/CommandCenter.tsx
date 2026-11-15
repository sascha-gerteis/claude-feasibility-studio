import { Link } from "react-router-dom";
import { ActivityFeed } from "../components/ActivityFeed";
import { AgentCard } from "../components/AgentCard";
import { Kv, Panel, VerdictBadge } from "../components/ui";
import { Workflow } from "../components/Workflow";
import { useStudyCtx } from "../App";
import { fmtTime } from "../lib/format";

export function CommandCenter() {
  const { state, slug } = useStudyCtx();
  if (!state) return null;
  const [director, ...specialists] = state.agents;
  const counts = state.agents.reduce((m, a) => ({ ...m, [a.status]: (m[a.status] ?? 0) + 1 }), {} as Record<string, number>);
  const openSessions = state.sessions.filter((s) => s.open);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">
            {state.study.kind === "validation" ? "Validation run — not a feasibility study" : "Feasibility study"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{state.study.name}</h1>
          {state.study.location && <p className="text-sm text-muted">{state.study.location}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">Investment committee</span>
          <VerdictBadge verdict={state.verdict.verdict} />
          {state.verdict.reliability && <span className="text-sm text-muted">Reliability: <b className="text-ink">{state.verdict.reliability}</b></span>}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <AgentCard agent={director} slug={slug} prominent />
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {specialists.map((a) => <AgentCard key={a.name} agent={a} slug={slug} />)}
          </div>
        </div>
        <aside className="space-y-4">
          <Panel title="Study record">
            <dl className="space-y-1.5 px-4 py-3">
              <Kv k="Recording" v={state.recordingActive ? "Active" : "Not active"} />
              <Kv k="Open sessions" v={openSessions.length} />
              <Kv k="Sessions recorded" v={state.sessions.length} />
              <Kv k="First event" v={fmtTime(state.study.firstEventAt)} />
              <Kv k="Last event" v={fmtTime(state.lastEventAt)} />
              <Kv k="Events recorded" v={state.study.eventCount} />
              <Kv k="Documents recorded" v={<Link className="text-accent hover:underline" to={`/studies/${slug}/reports`}>{state.documents.length}</Link>} />
            </dl>
          </Panel>
          <Panel title="Agent status (recorded)">
            <dl className="space-y-1.5 px-4 py-3">
              {(["Working", "Waiting", "Completed", "Error", "Idle"] as const).map((s) => <Kv key={s} k={s} v={counts[s] ?? 0} />)}
            </dl>
          </Panel>
        </aside>
      </div>

      <Workflow stages={state.stages} />
      <ActivityFeed items={state.feed} />
    </div>
  );
}
