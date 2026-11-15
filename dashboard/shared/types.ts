// Shared domain types for the Feasibility Studio dashboard (server + web).

export interface StudioEvent {
  id: string;
  study: string;
  ts: string; // ISO-8601 UTC, recorded by the hook at the moment the event happened
  type: string;
  session_id?: string;
  agent?: string;
  agent_run_id?: string;
  tool_use_id?: string;
  data?: Record<string, unknown>;
  received_at?: string;
}

export interface DocumentMeta {
  study: string;
  path: string;
  sha256: string;
  agent?: string | null;
  size: number;
  mtime?: string | null;
  updatedAt: string;
  versions: number;
}

export interface DocumentRec extends DocumentMeta {
  content: string;
}

export interface AgentDef {
  name: string;
  title: string;
  description: string;
  model: string;
  color: string;
  tools: string;
}

export interface StudySummary {
  slug: string;
  name: string;
  location?: string | null;
  kind: "study" | "validation";
  createdAt: string;
  firstEventAt?: string | null;
  lastEventAt?: string | null;
  eventCount: number;
  documentCount: number;
  active: boolean; // recording currently activated (study.activate without later study.deactivate)
}

export type TaskState = "assigned" | "dispatched" | "running" | "completed" | "failed" | "stopped" | "interrupted";
export type AgentStatus = "Idle" | "Working" | "Waiting" | "Completed" | "Error";
export type StageKey =
  | "document-analysis"
  | "independent-research"
  | "cross-review"
  | "financial-validation"
  | "final-report"
  | "ic-decision";
export type StageStatus = "Not started" | "Waiting" | "In progress" | "Completed" | "Attention";

export interface Task {
  id: string;
  agent: string;
  stage: StageKey | null;
  title: string;
  state: TaskState;
  sessionId?: string;
  toolUseId?: string;
  runId?: string;
  background?: boolean;
  assignedAt?: string;
  dispatchedAt?: string;
  startedAt?: string;
  endedAt?: string;
  error?: string;
  resultExcerpt?: string;
  model?: string;
  tokens?: number;
  durationMs?: number;
  toolUses?: number;
}

export interface ResearchActivity {
  ts: string;
  tool: string;
  summary: string;
  error?: string;
  runId?: string;
}

export interface SourceRef {
  origin: "register" | "web-fetch" | "web-search";
  id?: string;
  title?: string;
  publisher?: string;
  url?: string;
  date?: string;
  quality?: string;
  ts?: string;
}

export interface Disagreement {
  origin: "disagreement-log" | "cross-review";
  id?: string;
  raisedBy: string;
  challenged: string;
  topic: string;
  resolution?: string;
  status?: string;
  path?: string;
}

export interface AgentState extends AgentDef {
  status: AgentStatus;
  statusReason: string;
  statusSince?: string;
  currentTask?: Task;
  lastActivityAt?: string;
  completedTasks: Task[];
  outstandingTasks: Task[];
  failedTasks: Task[];
  deliverables: DocumentMeta[];
  reportPath?: string;
  activity: ResearchActivity[];
  errors: { ts: string; message: string; runId?: string }[];
  disagreements: Disagreement[];
  sources: SourceRef[];
  counts: { searches: number; fetches: number; writes: number; runs: number };
}

export interface StageState {
  key: StageKey;
  label: string;
  status: StageStatus;
  reason: string;
  tasks: { assigned: number; active: number; completed: number; failed: number };
  evidence: { path: string; present: boolean }[];
  verdict?: string | null;
}

export interface FeedItem {
  id: string;
  ts: string;
  kind: "start" | "finish" | "error" | "dispatch" | "assign" | "write" | "research" | "session" | "stop";
  actor: string;
  message: string;
  detail?: string;
}

export interface SessionInfo {
  id: string;
  startedAt?: string;
  endedAt?: string;
  lastEventAt: string;
  open: boolean;
}

export interface StudyState {
  study: StudySummary;
  generatedAt: string;
  lastEventAt: string | null;
  sessions: SessionInfo[];
  recordingActive: boolean;
  agents: AgentState[];
  orchestrator: { lastActivityAt?: string; activity: ResearchActivity[] };
  stages: StageState[];
  tasks: Task[];
  feed: FeedItem[];
  verdict: { verdict: string | null; reliability: string | null; source?: string };
  documents: DocumentMeta[];
}

export interface CompareRow {
  slug: string;
  name: string;
  kind: string;
  verdict: string | null;
  reliability: string | null;
  firstEventAt: string | null;
  lastEventAt: string | null;
  agentsExecuted: number;
  tasksCompleted: number;
  tasksFailed: number;
  agentRuntimeMs: number | null;
  documents: number;
  sources: number | null;
  assumptionsByStatus: Record<string, number> | null;
  risksByClass: Record<string, number> | null;
  disagreements: number | null;
  unresolvedDisagreements: number | null;
  stages: Record<string, StageStatus>;
}
