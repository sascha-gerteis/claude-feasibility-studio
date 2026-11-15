import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CompareRow, StudySummary } from "../../../shared/types";
import { Empty, Panel, StageBadge, VerdictBadge } from "../components/ui";
import { STAGE_LABEL } from "../lib/agents";
import { api } from "../lib/api";
import { fmtDuration, fmtTime } from "../lib/format";

export function StudiesPage({ studies, onRefresh }: { studies: StudySummary[]; onRefresh: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [rows, setRows] = useState<CompareRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (selected.length < 2) { setRows(null); return; }
    api.compare(selected).then(setRows).catch((e: Error) => setErr(e.message));
  }, [selected]);

  const toggle = (slug: string) =>
    setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : s.length >= 4 ? s : [...s, slug]));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Studies</h1>
          <p className="text-sm text-muted">Every study recorded by this server. Select two to four to compare their recorded results.</p>
        </div>
        <button type="button" onClick={onRefresh} className="rounded border border-line bg-white px-3 py-1.5 text-sm hover:bg-slate-50">Reload list</button>
      </div>

      <Panel title={`Recorded studies (${studies.length})`}>
        {studies.length === 0 ? (
          <Empty>
            No studies recorded yet. Start one with <code className="font-mono">python3 scripts/studio/studio.py study start &lt;slug&gt; --name "…"</code>.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50 text-left text-[12px] text-muted">
                <tr>
                  <th className="w-10 px-4 py-2">Compare</th><th className="px-2 py-2">Study</th><th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Recording</th><th className="px-2 py-2">First event</th><th className="px-2 py-2">Last event</th>
                  <th className="px-2 py-2 text-right">Events</th><th className="px-2 py-2 text-right">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {studies.map((s) => (
                  <tr key={s.slug} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2">
                      <input type="checkbox" aria-label={`Compare ${s.name}`} checked={selected.includes(s.slug)} onChange={() => toggle(s.slug)} />
                    </td>
                    <td className="px-2 py-2">
                      <Link to={`/studies/${s.slug}`} className="font-medium text-accent hover:underline">{s.name}</Link>
                      <div className="font-mono text-[11px] text-muted">{s.slug}{s.location ? ` · ${s.location}` : ""}</div>
                    </td>
                    <td className="px-2 py-2">{s.kind === "validation" ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">Validation run</span> : "Feasibility study"}</td>
                    <td className="px-2 py-2">{s.active ? <span className="text-blue-800">Active</span> : <span className="text-muted">Inactive</span>}</td>
                    <td className="px-2 py-2">{fmtTime(s.firstEventAt)}</td>
                    <td className="px-2 py-2">{fmtTime(s.lastEventAt)}</td>
                    <td className="px-2 py-2 text-right">{s.eventCount}</td>
                    <td className="px-2 py-2 text-right">{s.documentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {err && <p className="text-sm text-rose-700">{err}</p>}
      {rows && rows.length >= 2 && <Compare rows={rows} />}
    </div>
  );
}

function Compare({ rows }: { rows: CompareRow[] }) {
  const na = <span className="text-muted">Not recorded</span>;
  const dict = (d: Record<string, number> | null) =>
    d ? Object.entries(d).map(([k, v]) => <div key={k}>{k}: <b>{v}</b></div>) : na;
  const lines: { label: string; render: (r: CompareRow) => React.ReactNode }[] = [
    { label: "Investment committee verdict", render: (r) => <VerdictBadge verdict={r.verdict} /> },
    { label: "Evidence reliability", render: (r) => r.reliability ?? na },
    { label: "Recorded period", render: (r) => `${fmtTime(r.firstEventAt)} → ${fmtTime(r.lastEventAt)}` },
    { label: "Agents with completed tasks", render: (r) => `${r.agentsExecuted} of 7` },
    { label: "Tasks completed / failed", render: (r) => `${r.tasksCompleted} / ${r.tasksFailed}` },
    { label: "Recorded agent runtime", render: (r) => fmtDuration(r.agentRuntimeMs) },
    { label: "Documents recorded", render: (r) => r.documents },
    { label: "Sources in register", render: (r) => r.sources ?? na },
    { label: "Assumptions by status", render: (r) => dict(r.assumptionsByStatus) },
    { label: "Risks by classification", render: (r) => dict(r.risksByClass) },
    { label: "Disagreements (unresolved)", render: (r) => (r.disagreements == null ? na : `${r.disagreements} (${r.unresolvedDisagreements ?? 0})`) },
    ...Object.keys(STAGE_LABEL).map((k) => ({ label: `Stage: ${STAGE_LABEL[k]}`, render: (r: CompareRow) => <StageBadge status={r.stages[k] ?? "Not started"} /> })),
  ];
  return (
    <Panel title="Comparison (from recorded events and final registers only)">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-2 text-[12px] text-muted">Measure</th>
              {rows.map((r) => <th key={r.slug} className="px-3 py-2 font-semibold">{r.name}{r.kind === "validation" && <span className="ml-1 text-[11px] font-normal text-muted">(validation)</span>}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((l) => (
              <tr key={l.label}>
                <td className="px-4 py-2 text-muted">{l.label}</td>
                {rows.map((r) => <td key={r.slug} className="px-3 py-2 align-top">{l.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
