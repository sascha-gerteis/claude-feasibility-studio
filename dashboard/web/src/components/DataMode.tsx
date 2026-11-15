import type { StudyState } from "../../../shared/types";
import { fmtTime, utc } from "../lib/format";
import type { StreamState } from "../lib/useStudy";
import { HOSTED } from "../lib/api";
import type { HostedState } from "../lib/artifactdb";

/**
 * States plainly whether what the user sees is live. "Live" requires BOTH an open connection to the
 * server's event stream AND a recorded orchestration session that has started and not ended.
 */
export function DataMode({ state, stream, loadedAt }: { state: StudyState | null; stream: StreamState; loadedAt: string | null }) {
  if (!state) return null;
  if (HOSTED) return <HostedMode state={state as HostedState} stream={stream} loadedAt={loadedAt} />;
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

/** Hosted (claude.ai artifact) variant: data arrives as snapshots synced by the orchestrating session. */
function HostedMode({ state, stream, loadedAt }: { state: HostedState; stream: StreamState; loadedAt: string | null }) {
  const sync = state.__sync;
  const open = state.sessions.filter((s) => s.open).length;
  let tone = "border-slate-300 bg-slate-50 text-slate-800";
  let label: string;
  let text: string;
  if (stream !== "connected") {
    tone = "border-amber-300 bg-amber-50 text-amber-900";
    label = "NOT LIVE";
    text = `The data store is not reachable right now. Showing the last snapshot received ${fmtTime(loadedAt)}.`;
  } else if (state.recordingActive && open) {
    tone = "border-blue-300 bg-blue-50 text-blue-900";
    label = "SYNCED · STUDY RUNNING";
    text = `Last sync ${fmtTime(sync?.syncedAt)}, covering recorded events through ${fmtTime(sync?.eventsThrough)}. An orchestration session was open at that sync. This page updates by itself at every sync; events recorded since then appear at the next one.`;
  } else {
    label = "STORED RECORD";
    text = `Synced ${fmtTime(sync?.syncedAt)}, covering recorded events through ${fmtTime(sync?.eventsThrough)}. No orchestration session was open at that sync.`;
  }
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-sm ${tone}`} role="status" title={utc(sync?.syncedAt)}>
      <span className="font-semibold tracking-wide">{label}</span>
      <span>{text}</span>
    </div>
  );
}
