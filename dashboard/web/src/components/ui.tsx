import type { ReactNode } from "react";
import type { AgentStatus, StageStatus, TaskState } from "../../../shared/types";

const STATUS_STYLE: Record<AgentStatus, string> = {
  Idle: "bg-slate-100 text-slate-600 ring-slate-300",
  Working: "bg-blue-50 text-blue-800 ring-blue-300",
  Waiting: "bg-amber-50 text-amber-800 ring-amber-300",
  Completed: "bg-emerald-50 text-emerald-800 ring-emerald-300",
  Error: "bg-rose-50 text-rose-800 ring-rose-300",
};
const DOT: Record<AgentStatus, string> = {
  Idle: "bg-slate-400", Working: "bg-blue-600", Waiting: "bg-amber-500", Completed: "bg-emerald-600", Error: "bg-rose-600",
};

export function StatusBadge({ status, title }: { status: AgentStatus; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} aria-hidden />
      {status}
    </span>
  );
}

const STAGE_STYLE: Record<StageStatus, string> = {
  "Not started": "bg-slate-100 text-slate-600 ring-slate-300",
  Waiting: "bg-amber-50 text-amber-800 ring-amber-300",
  "In progress": "bg-blue-50 text-blue-800 ring-blue-300",
  Completed: "bg-emerald-50 text-emerald-800 ring-emerald-300",
  Attention: "bg-rose-50 text-rose-800 ring-rose-300",
};
export function StageBadge({ status }: { status: StageStatus }) {
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STAGE_STYLE[status]}`}>{status}</span>;
}

const TASK_STYLE: Record<TaskState, string> = {
  assigned: "text-amber-700", dispatched: "text-amber-700", running: "text-blue-700", completed: "text-emerald-700",
  failed: "text-rose-700", stopped: "text-rose-700", interrupted: "text-rose-700",
};
export function TaskStateLabel({ state }: { state: TaskState }) {
  return <span className={`text-xs font-semibold uppercase tracking-wide ${TASK_STYLE[state]}`}>{state}</span>;
}

export const VERDICT_STYLE: Record<string, string> = {
  GO: "bg-emerald-700 text-white", "CONDITIONAL GO": "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600",
  DEFER: "bg-amber-50 text-amber-900 ring-1 ring-amber-500", "NO-GO": "bg-rose-700 text-white",
};
export function VerdictBadge({ verdict }: { verdict: string | null | undefined }) {
  if (!verdict) return <span className="text-xs text-muted">No verdict recorded</span>;
  return <span className={`inline-flex rounded px-2.5 py-1 text-xs font-bold tracking-wide ${VERDICT_STYLE[verdict] ?? "bg-slate-200"}`}>{verdict}</span>;
}

export function Panel({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border border-line bg-white shadow-[0_1px_0_rgba(16,24,40,0.03)] ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-sm text-muted">{children}</p>;
}

export function Kv({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  );
}
