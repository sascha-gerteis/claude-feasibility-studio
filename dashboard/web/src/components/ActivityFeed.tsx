import { useMemo, useState } from "react";
import type { FeedItem } from "../../../shared/types";
import { AGENT_META } from "../lib/agents";
import { fmtTime, utc } from "../lib/format";
import { Empty, Panel } from "./ui";

const KIND_STYLE: Record<FeedItem["kind"], string> = {
  start: "bg-blue-600", finish: "bg-emerald-600", error: "bg-rose-600", stop: "bg-rose-600", dispatch: "bg-indigo-500",
  assign: "bg-amber-500", write: "bg-slate-500", research: "bg-sky-500", session: "bg-slate-300",
};
const KIND_LABEL: Record<FeedItem["kind"], string> = {
  start: "Started", finish: "Finished", error: "Error", stop: "Stopped", dispatch: "Dispatched", assign: "Assigned",
  write: "Output", research: "Research", session: "Session",
};
const FILTERS: { key: string; label: string; kinds: FeedItem["kind"][] | null }[] = [
  { key: "all", label: "All", kinds: null },
  { key: "lifecycle", label: "Start / finish", kinds: ["start", "finish", "dispatch", "assign", "stop"] },
  { key: "errors", label: "Errors", kinds: ["error", "stop"] },
  { key: "outputs", label: "Outputs", kinds: ["write"] },
  { key: "research", label: "Research", kinds: ["research"] },
];

export const actorLabel = (a: string) => AGENT_META[a]?.role ?? (a === "orchestrator" ? "Orchestrator (main session)" : a);

export function ActivityFeed({ items, collapsedCount = 10, agentFilter }: { items: FeedItem[]; collapsedCount?: number; agentFilter?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState("all");
  const list = useMemo(() => {
    const kinds = FILTERS.find((f) => f.key === filter)?.kinds;
    return items.filter((i) => (!kinds || kinds.includes(i.kind)) && (!agentFilter || i.actor === agentFilter));
  }, [items, filter, agentFilter]);
  const shown = expanded ? list : list.slice(0, collapsedCount);

  return (
    <Panel
      title={`Activity feed (${list.length} recorded)`}
      actions={
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              className={`rounded px-2 py-0.5 text-[12px] ${filter === f.key ? "bg-navy text-white" : "text-muted hover:bg-slate-100"}`}>
              {f.label}
            </button>
          ))}
        </div>
      }
    >
      {shown.length === 0 ? (
        <Empty>No recorded events{filter !== "all" ? " of this type" : ""}.</Empty>
      ) : (
        <ol className={`divide-y divide-line ${expanded ? "max-h-[70vh] overflow-y-auto" : ""}`}>
          {shown.map((i) => (
            <li key={i.id} className="flex gap-3 px-4 py-2 text-[13px]">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_STYLE[i.kind]}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <time className="font-mono text-[12px] text-muted" title={utc(i.ts)}>{fmtTime(i.ts)}</time>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{KIND_LABEL[i.kind]}</span>
                  <span className="font-medium text-ink">{actorLabel(i.actor)}</span>
                </div>
                <p className="break-words text-ink">{i.message}</p>
                {i.detail && <p className="line-clamp-2 break-words text-[12px] text-muted">{i.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {list.length > collapsedCount && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="w-full border-t border-line py-2 text-[13px] font-medium text-accent hover:bg-slate-50">
          {expanded ? "Collapse" : `Show all ${list.length} events`}
        </button>
      )}
    </Panel>
  );
}
