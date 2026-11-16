// Maps RECORDED state to what the office shows. Pure functions, unit-tested: a character can only
// animate "working" when a SubagentStart without a completion has been recorded for it.
import type { AgentState, StudyState, Task } from "./types.js";

export type Pose = "typing" | "reviewing" | "waiting" | "done" | "alert" | "idle";

const REVIEW_STAGES = new Set(["document-analysis", "cross-review", "final-report", "ic-decision"]);

export function poseFor(a: Pick<AgentState, "status" | "currentTask">): Pose {
  switch (a.status) {
    case "Working": {
      const t = a.currentTask;
      const reviewing = (t?.stage && REVIEW_STAGES.has(t.stage)) || /review|reconcil|check|challenge|synthes/i.test(t?.title ?? "");
      return reviewing ? "reviewing" : "typing";
    }
    case "Waiting": return "waiting";
    case "Error": return "alert";
    case "Completed": return "done";
    default: return "idle";
  }
}

/** Task title in plain English: no stage tags or tool syntax. */
export function plainTask(t?: Task | null): string | null {
  if (!t) return null;
  const s = (t.title || "")
    .replace(/\[(?:stage:[a-z-]+|S\d)\]\s*/gi, "")
    .replace(/^Smoke:\s*/i, "Validation check: ")
    .replace(/\s+/g, " ")
    .trim();
  return s || null;
}

export function statusLine(a: AgentState, validation: boolean): string {
  const task = plainTask(a.currentTask);
  switch (a.status) {
    case "Working": return task ? `Working on: ${task}` : "Working";
    case "Waiting": return task ? `Queued: ${task}` : "Waiting to start";
    case "Error": return "Stopped with a problem — see details";
    case "Completed":
      if (validation) return "Finished a validation task (not a feasibility report)";
      return a.assessment.complete ? "Assessment complete and quality-checked" : "Finished its latest task";
    default: return "Not started";
  }
}

export type DataModeKey = "TEST DATA" | "LIVE" | "SYNCED SNAPSHOT" | "STORED RECORD" | "NOT LIVE";
export interface DataModeInfo { key: DataModeKey; live: boolean; detail: string }

/**
 * LIVE only for the self-served dashboard with a connected stream AND an open recorded session.
 * The hosted page is never LIVE: it is a SYNCED SNAPSHOT as of its last sync.
 * Validation runs always carry TEST DATA (shown alongside the freshness detail).
 */
export function dataMode(state: Pick<StudyState, "study" | "sessions" | "recordingActive">, opts: { hosted: boolean; connected: boolean }): DataModeInfo[] {
  const out: DataModeInfo[] = [];
  if (state.study.kind === "validation") out.push({ key: "TEST DATA", live: false, detail: "Validation run of the agent system — not project research" });
  const open = state.sessions.some((s) => s.open) && state.recordingActive;
  if (!opts.connected) out.push({ key: "NOT LIVE", live: false, detail: "Connection to the data store is down; showing the last snapshot received" });
  else if (opts.hosted) out.push({ key: "SYNCED SNAPSHOT", live: false, detail: open ? "Study was running at the last sync; updates arrive at each sync" : "Stored record as of the last sync" });
  else if (open) out.push({ key: "LIVE", live: true, detail: "Receiving recorded agent events as they happen" });
  else out.push({ key: "STORED RECORD", live: false, detail: "No orchestration session is running; showing the stored record" });
  return out;
}
