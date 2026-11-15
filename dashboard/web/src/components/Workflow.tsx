import { useState } from "react";
import type { StageState } from "../../../shared/types";
import { Panel, StageBadge, VerdictBadge } from "./ui";

export function Workflow({ stages }: { stages: StageState[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Panel title="Research workflow">
      <ol className="grid grid-cols-1 divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0 xl:grid-cols-6">
        {stages.map((s, i) => {
          const have = s.evidence.filter((e) => e.present).length;
          const expanded = open === s.key;
          return (
            <li key={s.key} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-slate-50 text-xs font-semibold text-muted">{i + 1}</span>
                <h3 className="text-sm font-semibold leading-tight text-ink">{s.label}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StageBadge status={s.status} />
                {s.key === "ic-decision" && <VerdictBadge verdict={s.verdict} />}
              </div>
              <p className="text-[12px] leading-snug text-muted">{s.reason}</p>
              <dl className="grid grid-cols-4 gap-1 text-center text-[11px]">
                {(["assigned", "active", "completed", "failed"] as const).map((k) => (
                  <div key={k} className="rounded bg-slate-50 py-1">
                    <dd className={`text-sm font-semibold ${k === "failed" && s.tasks[k] ? "text-rose-700" : "text-ink"}`}>{s.tasks[k]}</dd>
                    <dt className="text-muted">{k === "assigned" ? "queued" : k}</dt>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : s.key)}
                className="self-start text-[12px] text-accent hover:underline"
                aria-expanded={expanded}
              >
                {have} of {s.evidence.length} expected deliverables recorded {expanded ? "▴" : "▾"}
              </button>
              {expanded && (
                <ul className="space-y-0.5 text-[11px]">
                  {s.evidence.map((e) => (
                    <li key={e.path} className={`font-mono ${e.present ? "text-emerald-700" : "text-muted"}`}>
                      {e.present ? "✓" : "·"} {e.path}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
