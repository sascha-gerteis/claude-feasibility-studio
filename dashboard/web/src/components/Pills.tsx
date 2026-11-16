import type { AgentStatus } from "../../../shared/types";
import type { QualityResult, ReportReadiness } from "../../../shared/insights";

const STATUS: Record<AgentStatus, { cls: string; dot: string; text: string }> = {
  Working: { cls: "bg-blue-50 text-blue-900 ring-blue-200", dot: "bg-blue-600", text: "Working" },
  Waiting: { cls: "bg-amber-50 text-amber-900 ring-amber-200", dot: "bg-amber-500", text: "Waiting" },
  Completed: { cls: "bg-emerald-50 text-emerald-900 ring-emerald-200", dot: "bg-emerald-600", text: "Task finished" },
  Error: { cls: "bg-rose-50 text-rose-900 ring-rose-200", dot: "bg-rose-600", text: "Problem" },
  Idle: { cls: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400", text: "Idle" },
};

export function StatusPill({ status }: { status: AgentStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />{s.text}
    </span>
  );
}

export function ReportChip({ r }: { r: ReportReadiness }) {
  const ready = r.ready;
  const cls = ready ? "bg-emerald-50 text-emerald-900 ring-emerald-200" : r.present ? "bg-sky-50 text-sky-900 ring-sky-200" : "bg-slate-50 text-slate-600 ring-slate-200";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>Report {ready ? "ready" : r.present ? `${r.present} of ${r.total} parts` : "not started"}</span>;
}

export function QualityChip({ q }: { q: QualityResult }) {
  if (q.status === "NOT CHECKED") return <span className="inline-flex rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">Not quality-checked</span>;
  return q.status === "PASS"
    ? <span className="inline-flex rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white">Quality ✓</span>
    : <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-800 ring-1 ring-inset ring-rose-200">Quality check failed</span>;
}

const VERDICT: Record<string, string> = {
  GO: "bg-emerald-700 text-white", "CONDITIONAL GO": "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600",
  DEFER: "bg-amber-50 text-amber-950 ring-1 ring-amber-500", "NO-GO": "bg-rose-700 text-white",
};
export function VerdictPill({ verdict, large = false }: { verdict: string; large?: boolean }) {
  return <span className={`inline-flex rounded-md font-bold tracking-wide ${large ? "px-4 py-2 text-xl" : "px-2 py-0.5 text-xs"} ${VERDICT[verdict] ?? "bg-slate-200"}`}>{verdict}</span>;
}
