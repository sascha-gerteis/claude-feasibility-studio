import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { DocumentMeta } from "../../../shared/types";
import { DocumentView } from "../components/DocumentView";
import { Empty, Panel, VerdictBadge } from "../components/ui";
import { useStudyCtx } from "../App";
import { AGENT_META } from "../lib/agents";
import { fmtTime } from "../lib/format";

const SECTIONS: { title: string; note: string; match: (p: string) => boolean }[] = [
  { title: "Investment recommendation", note: "Verdict, conditions and executive summary", match: (p) => /^outputs\/0[04]_/.test(p) },
  { title: "Feasibility report", note: "Integrated final report", match: (p) => p.startsWith("outputs/01_") },
  { title: "Financial scenarios", note: "Scenario results and model files", match: (p) => p.startsWith("outputs/02_") || p.startsWith("models/") },
  { title: "Risk assessment", note: "Consolidated risk register", match: (p) => p.startsWith("outputs/03_") },
  { title: "Registers", note: "Sources, assumptions and disagreements", match: (p) => /^outputs\/(source_register|assumption_register|disagreement_log)/.test(p) },
  { title: "Other final outputs", note: "", match: (p) => p.startsWith("outputs/") },
  { title: "Specialist research", note: "Findings and workstream registers", match: (p) => /^research\/(?!00_director|cross-review)[a-z-]+\//.test(p) },
  { title: "Cross-reviews", note: "Challenge memos between specialists", match: (p) => p.startsWith("research/cross-review/") },
  { title: "Director working papers", note: "Plan, briefs, reconciliation, run log", match: (p) => p.startsWith("research/00_director/") },
];

export function ReportsPage() {
  const { state, slug } = useStudyCtx();
  const [params, setParams] = useSearchParams();
  const current = params.get("doc");

  const grouped = useMemo(() => {
    const used = new Set<string>();
    return SECTIONS.map((s) => {
      const docs = (state?.documents ?? []).filter((d) => !used.has(d.path) && s.match(d.path));
      docs.forEach((d) => used.add(d.path));
      return { ...s, docs };
    });
  }, [state]);
  if (!state) return null;

  const label = (d: DocumentMeta) => {
    const m = /^research\/([a-z-]+)\//.exec(d.path);
    const who = m && AGENT_META[m[1]] ? AGENT_META[m[1]].role : null;
    return { name: d.path.split("/").slice(-1)[0], who };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted">Documents recorded for <b className="text-ink">{state.study.name}</b>. Each shows the version stored by the server and when it was recorded.</p>
        </div>
        <div className="flex items-center gap-2 text-sm"><span className="text-muted">Recommendation</span><VerdictBadge verdict={state.verdict.verdict} /></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Panel title={`Documents (${state.documents.length})`}>
          {state.documents.length === 0 ? <Empty>No documents recorded for this study yet.</Empty> : (
            <div className="max-h-[78vh] overflow-y-auto">
              {grouped.filter((g) => g.docs.length).map((g) => (
                <div key={g.title} className="border-b border-line last:border-0">
                  <p className="bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</p>
                  <ul>
                    {g.docs.map((d) => {
                      const l = label(d);
                      return (
                        <li key={d.path}>
                          <button type="button" onClick={() => setParams({ doc: d.path })}
                            className={`w-full px-4 py-1.5 text-left text-[13px] hover:bg-slate-50 ${current === d.path ? "bg-blue-50" : ""}`}>
                            <span className="block truncate font-medium text-ink">{l.name}</span>
                            <span className="block truncate text-[11px] text-muted">{l.who ? `${l.who} · ` : ""}{fmtTime(d.updatedAt)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title={current ?? "Select a document"}>
          {current ? <DocumentView slug={slug} path={current} /> : <Empty>Select a document to read it.</Empty>}
        </Panel>
      </div>
    </div>
  );
}
