import { useSearchParams } from "react-router-dom";
import type { StudySummary } from "../../../shared/types";
import { ActivityFeed } from "../components/ActivityFeed";
import { DataMode } from "../components/DataMode";
import { Workflow } from "../components/Workflow";
import { useStudyCtx } from "../App";
import { fmtTime } from "../lib/format";
import { ReportsPage } from "./Reports";
import { StudiesPage } from "./Studies";

const TABS = [
  { key: "log", label: "Activity log" },
  { key: "stages", label: "Workflow evidence" },
  { key: "files", label: "Files" },
  { key: "sessions", label: "Sessions" },
  { key: "studies", label: "Studies & comparison" },
] as const;

export function TechnicalPage({ studies, onRefresh }: { studies: StudySummary[]; onRefresh: () => void }) {
  const ctx = useStudyCtx();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "log";
  const { state } = ctx;
  if (!state) return null;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Technical details</h1>
        <p className="text-sm text-muted">Raw recorded events, file names, sessions and evidence behind every status shown elsewhere.</p>
      </div>
      <DataMode state={state} stream={ctx.stream} loadedAt={ctx.loadedAt} />
      <div className="flex flex-wrap gap-1 border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} type="button" onClick={() => setParams({ tab: t.key })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t.key ? "border-navy text-navy" : "border-transparent text-muted hover:text-ink"}`}>{t.label}</button>
        ))}
      </div>
      {tab === "log" && <ActivityFeed items={state.feed} collapsedCount={25} />}
      {tab === "stages" && <Workflow stages={state.stages} />}
      {tab === "files" && <ReportsPage />}
      {tab === "sessions" && (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-muted"><tr><th className="px-4 py-2">Session</th><th className="px-2 py-2">Started</th><th className="px-2 py-2">Ended</th><th className="px-2 py-2">Last event</th><th className="px-2 py-2">Open</th></tr></thead>
            <tbody className="divide-y divide-line">
              {state.sessions.map((s) => <tr key={s.id}><td className="px-4 py-2 font-mono text-xs">{s.id}</td><td className="px-2 py-2">{fmtTime(s.startedAt)}</td><td className="px-2 py-2">{fmtTime(s.endedAt)}</td><td className="px-2 py-2">{fmtTime(s.lastEventAt)}</td><td className="px-2 py-2">{s.open ? "yes" : "no"}</td></tr>)}
              {state.sessions.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-muted">No sessions recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {tab === "studies" && <StudiesPage studies={studies} onRefresh={onRefresh} />}
    </div>
  );
}
