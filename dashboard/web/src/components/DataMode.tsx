import type { StudyState } from "../../../shared/types";
import { fmtTime, utc } from "../lib/format";
import type { StreamState } from "../lib/useStudy";

/**
 * States plainly whether what the user sees is live. "Live" requires BOTH an open connection to the
 * server's event stream AND a recorded orchestration session that has started and not ended.
 */
export function DataMode({ state, stream, loadedAt }: { state: StudyState | null; stream: StreamState; loadedAt: string | null }) {
  if (!state) return null;
  const openSessions = state.sessions.filter((s) => s.open);
  const last = state.lastEventAt;
  let tone = "border-slate-300 bg-slate-50 text-slate-800";
  let label = "";
  let text = "";
  if (stream !== "connected") {
    tone = "border-amber-300 bg-amber-50 text-amber-900";
    label = "NOT LIVE";
    text = `Event stream ${stream === "connecting" ? "reconnecting" : "disconnected"}. Showing the last verified snapshot, loaded ${fmtTime(loadedAt)}. Last recorded event: ${fmtTime(last)}.`;
  } else if (state.recordingActive && openSessions.length) {
    tone = "border-blue-300 bg-blue-50 text-blue-900";
    label = "LIVE";
    text = `Receiving recorded events from ${openSessions.length} open orchestration session${openSessions.length > 1 ? "s" : ""} (started ${fmtTime(openSessions[0].startedAt)}). Last recorded event: ${fmtTime(last)}.`;
  } else {
    label = "STREAM CONNECTED · NO ACTIVE SESSION";
    text = state.recordingActive
      ? `Recording is enabled but no orchestration session is currently open. Showing the last recorded state (last event ${fmtTime(last)}).`
      : `Recording is not active for this study. Showing the stored record (last event ${fmtTime(last)}).`;
  }
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-sm ${tone}`} role="status" title={utc(last)}>
      <span className="font-semibold tracking-wide">{label}</span>
      <span>{text}</span>
    </div>
  );
}
