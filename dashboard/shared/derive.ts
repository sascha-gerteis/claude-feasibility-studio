// Derives everything the dashboard displays from RECORDED events and ingested documents.
// Pure and deterministic: no clocks, timers or estimates. Given the same inputs it always
// returns the same state, and every status carries the reason (event/document) behind it.
import { csvObjects } from "./csv.js";
import type {
  AgentDef, AgentState, AgentStatus, CompareRow, Disagreement, DocumentMeta, DocumentRec, FeedItem,
  ResearchActivity, SessionInfo, SourceRef, StageKey, StageState, StageStatus, StudioEvent, StudyState,
  StudySummary, Task,
} from "./types.js";

export const DIRECTOR = "head-of-market-research";
export const SPECIALISTS = [
  "investment-banking", "project-technology", "syndications",
  "real-estate-hospitality", "ai-strategy", "environmental-technologies",
] as const;
export const AGENT_ORDER = [DIRECTOR, ...SPECIALISTS];

/** CLAUDE.md §5 cross-review matrix: reviewer -> targets. */
export const CROSS_REVIEW: Record<string, string[]> = {
  "investment-banking": ["real-estate-hospitality", "environmental-technologies"],
  "project-technology": ["ai-strategy", "environmental-technologies"],
  syndications: ["investment-banking", "project-technology"],
  "real-estate-hospitality": ["investment-banking", "syndications"],
  "ai-strategy": ["project-technology", "real-estate-hospitality"],
  "environmental-technologies": ["syndications", "ai-strategy"],
};

export const STAGES: { key: StageKey; label: string; evidence: string[] }[] = [
  { key: "document-analysis", label: "Document analysis", evidence: ["research/00_director/study_plan.md"] },
  {
    key: "independent-research", label: "Independent specialist research",
    evidence: SPECIALISTS.map((s) => `research/${s}/findings.md`),
  },
  {
    key: "cross-review", label: "Cross-agent review",
    evidence: Object.entries(CROSS_REVIEW).flatMap(([r, ts]) => ts.map((t) => `research/cross-review/${r}__on__${t}.md`)),
  },
  { key: "financial-validation", label: "Financial validation", evidence: ["outputs/02_financial_scenarios.md"] },
  {
    key: "final-report", label: "Final report preparation",
    evidence: ["outputs/00_executive_summary.md", "outputs/01_feasibility_report.md"],
  },
  { key: "ic-decision", label: "Investment committee decision", evidence: ["outputs/04_recommendation.md"] },
];

const FALLBACK_DEF = (name: string): AgentDef => ({ name, title: name, description: "", model: "", color: "", tools: "" });
const OPEN: Task["state"][] = ["assigned", "dispatched", "running"];
const FAILED: Task["state"][] = ["failed", "stopped", "interrupted"];

const by = <T>(f: (x: T) => string | undefined) => (a: T, b: T) => (f(a) ?? "").localeCompare(f(b) ?? "");
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? undefined : String(v));
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function sortEvents(events: StudioEvent[]): StudioEvent[] {
  return [...events].sort((a, b) => a.ts.localeCompare(b.ts) || (a.received_at ?? "").localeCompare(b.received_at ?? ""));
}

/** Rebuild the task ledger from lifecycle events. */
export function buildTasks(events: StudioEvent[]): Task[] {
  const tasks: Task[] = [];
  const byTool = new Map<string, Task>();
  const byRun = new Map<string, Task>();

  for (const e of events) {
    const d = e.data ?? {};
    switch (e.type) {
      case "task.assign": {
        tasks.push({
          id: e.id, agent: e.agent ?? "unknown", stage: (str(d.stage) as StageKey) ?? null,
          title: str(d.title) ?? "(untitled task)", state: "assigned", assignedAt: e.ts,
        });
        break;
      }
      case "task.dispatch": {
        const stage = (str(d.stage) as StageKey) ?? null;
        let t = tasks.find((x) => x.state === "assigned" && x.agent === e.agent && (!stage || !x.stage || x.stage === stage));
        if (!t) {
          t = { id: e.id, agent: e.agent ?? "unknown", stage, title: "", state: "dispatched" };
          tasks.push(t);
        }
        t.state = "dispatched";
        t.dispatchedAt = e.ts;
        t.sessionId = e.session_id;
        t.toolUseId = e.tool_use_id;
        t.stage = t.stage ?? stage;
        t.background = Boolean(d.background);
        t.title = t.title || str(d.description) || "(no description)";
        if (e.tool_use_id) byTool.set(e.tool_use_id, t);
        break;
      }
      case "agent.start": {
        // Background launches report agentId (task.result) ~10ms BEFORE SubagentStart; link by id first.
        const known = e.agent_run_id ? byRun.get(e.agent_run_id) : undefined;
        let t = known && known.state === "dispatched" ? known
          : tasks.find((x) => x.state === "dispatched" && !x.runId && x.agent === e.agent && x.sessionId === e.session_id);
        if (!t) {
          t = { id: e.id, agent: e.agent ?? "unknown", stage: null, title: "(started without a recorded dispatch)", state: "dispatched", sessionId: e.session_id };
          tasks.push(t);
        }
        t.state = "running";
        t.startedAt = e.ts;
        t.runId = e.agent_run_id;
        if (e.agent_run_id) byRun.set(e.agent_run_id, t);
        break;
      }
      case "task.result": {
        const t = e.tool_use_id ? byTool.get(e.tool_use_id) : undefined;
        if (!t) break;
        const rid = e.agent_run_id;
        if (rid && t.runId !== rid) {
          // The authoritative link is the agentId in the tool response; repair FIFO matching if needed.
          const other = byRun.get(rid);
          if (other && other !== t) {
            [other.runId, t.runId] = [t.runId, rid];
            [other.startedAt, t.startedAt] = [t.startedAt, other.startedAt];
            [other.state, t.state] = [t.state, other.state];
            if (other.runId) byRun.set(other.runId, other);
          } else {
            t.runId = rid;
          }
          byRun.set(rid, t);
        }
        t.model = str(d.model) ?? t.model;
        t.tokens = num(d.tokens) ?? t.tokens;
        t.durationMs = num(d.duration_ms) ?? t.durationMs;
        t.toolUses = num(d.tool_uses) ?? t.toolUses;
        if (str(d.result_excerpt)) t.resultExcerpt = str(d.result_excerpt);
        if (d.status === "completed" && OPEN.includes(t.state)) {
          t.state = "completed";
          t.endedAt = e.ts;
          t.startedAt = t.startedAt ?? t.dispatchedAt;
        }
        break;
      }
      case "agent.stop": {
        const t = e.agent_run_id ? byRun.get(e.agent_run_id) : undefined;
        if (!t || !OPEN.includes(t.state)) break;
        t.state = "completed";
        t.endedAt = e.ts;
        if (str(d.result_excerpt)) t.resultExcerpt = str(d.result_excerpt);
        break;
      }
      case "agent.killed": {
        const t = e.agent_run_id ? byRun.get(e.agent_run_id) : undefined;
        if (!t || !OPEN.includes(t.state)) break;
        t.state = "stopped";
        t.endedAt = e.ts;
        t.error = "Stopped by the orchestrator (TaskStop) before reporting completion";
        break;
      }
      case "task.failure": {
        const t = e.tool_use_id ? byTool.get(e.tool_use_id) : undefined;
        const target = t ?? { id: e.id, agent: e.agent ?? "unknown", stage: null, title: "(failed dispatch)", state: "dispatched" as const };
        if (!t) tasks.push(target);
        target.state = "failed";
        target.endedAt = e.ts;
        target.error = str(d.error) ?? "Agent tool call failed";
        break;
      }
      case "session.end": {
        for (const t of tasks) {
          if ((t.state === "running" || t.state === "dispatched") && t.sessionId === e.session_id) {
            t.state = "interrupted";
            t.endedAt = e.ts;
            t.error = "The orchestrating session ended before this agent reported completion";
          }
        }
        break;
      }
    }
  }
  return tasks;
}

export function parseVerdict(doc?: DocumentRec): { verdict: string | null; reliability: string | null; source?: string } {
  if (!doc) return { verdict: null, reliability: null };
  const v = doc.content.match(/\*\*(?:Verdict|Recommendation):\*\*\s*([^\n]+)/i)?.[1]?.trim() ?? "";
  const r = doc.content.match(/\*\*(?:Reliability of evidence|Research reliability|Reliability):\*\*\s*([^\n]+)/i)?.[1]?.trim() ?? "";
  // Template placeholders list every option separated by "/" — those are not verdicts.
  const verdict = /^(CONDITIONAL GO|NO-GO|GO|DEFER)\b/i.exec(v.replace(/\*/g, ""))?.[1]?.toUpperCase() ?? null;
  const reliability = /^(HIGH|MODERATE|LOW)\b/i.exec(r.replace(/\*/g, ""))?.[1]?.toUpperCase() ?? null;
  return { verdict: v.includes(" / ") ? null : verdict, reliability: r.includes(" / ") ? null : reliability, source: doc.path };
}

function agentDocs(agent: string, docs: DocumentMeta[], writes: Map<string, Set<string>>): DocumentMeta[] {
  const prefix = agent === DIRECTOR ? ["research/00_director/", "outputs/"] : [`research/${agent}/`];
  const written = writes.get(agent) ?? new Set<string>();
  return docs
    .filter((d) => prefix.some((p) => d.path.startsWith(p)) || d.agent === agent || written.has(d.path))
    .sort(by((d) => d.path));
}

function sourcesFor(agent: string, docs: Map<string, DocumentRec>, activity: ResearchActivity[]): SourceRef[] {
  const out: SourceRef[] = [];
  const reg = docs.get(agent === DIRECTOR ? "outputs/source_register.csv" : `research/${agent}/sources.csv`);
  if (reg) {
    for (const r of csvObjects(reg.content)) {
      out.push({
        origin: "register", id: r.source_id, title: r.title, publisher: r.publisher,
        url: r.document_url_or_path, date: r.publication_date, quality: r.quality_tier,
      });
    }
  }
  for (const a of activity) {
    if (a.error) continue;
    if (a.tool === "WebFetch") out.push({ origin: "web-fetch", url: a.summary, ts: a.ts });
    if (a.tool === "WebSearch") out.push({ origin: "web-search", title: a.summary, ts: a.ts });
  }
  return out;
}

export function disagreementsFrom(docs: Map<string, DocumentRec>, paths: Iterable<string>): Disagreement[] {
  const out: Disagreement[] = [];
  const log = docs.get("outputs/disagreement_log.csv");
  if (log) {
    for (const r of csvObjects(log.content)) {
      out.push({
        origin: "disagreement-log", id: r.disagreement_id, raisedBy: r.raised_by, challenged: r.challenged_agent,
        topic: r.topic || r.challenge || r.original_claim, resolution: r.resolution, status: r.status || (r.residual_dissent ? "dissent" : undefined),
      });
    }
  }
  for (const path of paths) {
    const m = /^research\/cross-review\/([a-z-]+)__on__([a-z-]+)\.md$/.exec(path);
    if (m) out.push({ origin: "cross-review", raisedBy: m[1], challenged: m[2], topic: `Cross-review of ${m[2]} by ${m[1]}`, path });
  }
  return out;
}

function feedFrom(events: StudioEvent[], tasks: Task[]): FeedItem[] {
  const taskByRun = new Map(tasks.filter((t) => t.runId).map((t) => [t.runId!, t]));
  const items: FeedItem[] = [];
  for (const e of events) {
    const d = e.data ?? {};
    const actor = e.agent ?? "orchestrator";
    const t = e.agent_run_id ? taskByRun.get(e.agent_run_id) : undefined;
    const push = (kind: FeedItem["kind"], message: string, detail?: string) =>
      items.push({ id: e.id, ts: e.ts, kind, actor, message, detail });
    switch (e.type) {
      case "study.activate": push("session", "Recording activated for this study"); break;
      case "study.deactivate": push("session", "Recording deactivated"); break;
      case "session.start": push("session", `Orchestrating session started (${str(d.source) ?? "startup"})`, e.session_id); break;
      case "session.end": push("session", `Orchestrating session ended (${str(d.reason) ?? "unknown"})`, e.session_id); break;
      case "task.assign": push("assign", `Task assigned: ${str(d.title)}`, str(d.stage)); break;
      case "task.dispatch": push("dispatch", `Dispatched${d.background ? " (background)" : ""}: ${str(d.description)}`, str(d.stage) ?? undefined); break;
      case "agent.start": push("start", `Started${t ? `: ${t.title}` : ""}`, e.agent_run_id); break;
      case "agent.stop": push("finish", `Finished${t ? `: ${t.title}` : ""}`, str(d.result_excerpt)); break;
      case "agent.killed": items.push({ id: e.id, ts: e.ts, kind: "stop", actor: t?.agent ?? "orchestrator", message: "Stopped before completion (TaskStop)", detail: e.agent_run_id }); break;
      case "task.failure": push("error", "Agent call failed", str(d.error)); break;
      case "task.result":
        if (d.status === "completed" && !e.agent_run_id) push("finish", "Agent call returned");
        break;
      case "tool.error": push("error", `${str(d.tool)} failed`, `${str(d.summary) ?? ""} ${str(d.error) ?? ""}`.trim()); break;
      case "file.write": push("write", `Wrote ${str(d.path)}`); break;
      case "tool.use":
        if (d.tool === "WebSearch") push("research", `Web search: ${str(d.summary)}`);
        else if (d.tool === "WebFetch") push("research", `Fetched: ${str(d.summary)}`);
        break;
    }
  }
  return items.reverse();
}

export function deriveStudy(
  study: StudySummary, rawEvents: StudioEvent[], docMetas: DocumentMeta[], docContents: DocumentRec[], defs: AgentDef[],
): StudyState {
  const events = sortEvents(rawEvents);
  const tasks = buildTasks(events);
  const docMap = new Map(docContents.map((d) => [d.path, d]));
  const present = new Set(docMetas.map((d) => d.path));
  const defMap = new Map(defs.map((d) => [d.name, d]));
  const disagreements = disagreementsFrom(docMap, present);

  // Sessions
  const sessions = new Map<string, SessionInfo>();
  for (const e of events) {
    if (!e.session_id) continue;
    const s = sessions.get(e.session_id) ?? { id: e.session_id, lastEventAt: e.ts, open: true };
    s.lastEventAt = e.ts;
    if (e.type === "session.start") { s.startedAt = s.startedAt ?? e.ts; s.open = true; s.endedAt = undefined; }
    if (e.type === "session.end") { s.endedAt = e.ts; s.open = false; }
    sessions.set(e.session_id, s);
  }
  let recordingActive = false;
  for (const e of events) {
    if (e.type === "study.activate") recordingActive = true;
    if (e.type === "study.deactivate") recordingActive = false;
  }

  // Per-agent activity
  const runAgent = new Map(tasks.filter((t) => t.runId).map((t) => [t.runId!, t.agent]));
  const activity = new Map<string, ResearchActivity[]>();
  const errors = new Map<string, { ts: string; message: string; runId?: string }[]>();
  const writes = new Map<string, Set<string>>();
  const lastAt = new Map<string, string>();
  for (const e of events) {
    const agent = e.agent ?? (e.agent_run_id ? runAgent.get(e.agent_run_id) : undefined) ?? "orchestrator";
    if (e.type !== "task.assign") lastAt.set(agent, e.ts);
    const d = e.data ?? {};
    if (e.type === "tool.use" || e.type === "tool.error") {
      const list = activity.get(agent) ?? [];
      list.push({ ts: e.ts, tool: str(d.tool) ?? "?", summary: str(d.summary) ?? "", error: str(d.error), runId: e.agent_run_id });
      activity.set(agent, list);
      if (e.type === "tool.error") {
        const l = errors.get(agent) ?? [];
        l.push({ ts: e.ts, message: `${str(d.tool)} failed: ${str(d.error) ?? ""}`, runId: e.agent_run_id });
        errors.set(agent, l);
      }
    }
    if (e.type === "file.write" && str(d.path)) {
      const s = writes.get(agent) ?? new Set<string>();
      s.add(str(d.path)!);
      writes.set(agent, s);
    }
  }

  const agents: AgentState[] = AGENT_ORDER.map((name) => {
    const def = defMap.get(name) ?? FALLBACK_DEF(name);
    const mine = tasks.filter((t) => t.agent === name);
    const running = mine.filter((t) => t.state === "running");
    const waiting = mine.filter((t) => t.state === "assigned" || t.state === "dispatched");
    const finished = mine.filter((t) => t.endedAt).sort(by((t) => t.endedAt));
    const last = finished[finished.length - 1];
    let status: AgentStatus = "Idle";
    let statusReason = "No recorded activity for this agent in this study";
    let statusSince: string | undefined;
    let currentTask: Task | undefined;
    if (running.length) {
      currentTask = running[running.length - 1];
      status = "Working";
      statusSince = currentTask.startedAt;
      statusReason = `SubagentStart recorded at ${currentTask.startedAt}; no completion event recorded yet`;
    } else if (waiting.length) {
      currentTask = waiting[0];
      status = "Waiting";
      statusSince = currentTask.dispatchedAt ?? currentTask.assignedAt;
      statusReason = currentTask.state === "dispatched"
        ? `Dispatched at ${currentTask.dispatchedAt}; agent start not yet recorded`
        : `Assigned at ${currentTask.assignedAt}; not yet dispatched`;
    } else if (last && FAILED.includes(last.state)) {
      status = "Error";
      statusSince = last.endedAt;
      statusReason = last.error ?? `Last task ended as ${last.state}`;
    } else if (last) {
      status = "Completed";
      statusSince = last.endedAt;
      statusReason = `Last task completed at ${last.endedAt}`;
    }
    const taskErrors = mine.filter((t) => FAILED.includes(t.state)).map((t) => ({ ts: t.endedAt!, message: `${t.title}: ${t.error ?? t.state}`, runId: t.runId }));
    const deliverables = agentDocs(name, docMetas, writes);
    const reportCandidates = name === DIRECTOR
      ? ["outputs/01_feasibility_report.md", "outputs/00_executive_summary.md", "research/00_director/study_plan.md"]
      : [`research/${name}/findings.md`];
    const act = (activity.get(name) ?? []).sort(by((a) => a.ts));
    return {
      ...def,
      status, statusReason, statusSince, currentTask,
      lastActivityAt: lastAt.get(name),
      completedTasks: mine.filter((t) => t.state === "completed"),
      outstandingTasks: mine.filter((t) => OPEN.includes(t.state)),
      failedTasks: mine.filter((t) => FAILED.includes(t.state)),
      deliverables,
      reportPath: reportCandidates.find((p) => present.has(p)),
      activity: act,
      errors: [...taskErrors, ...(errors.get(name) ?? [])].sort(by((x) => x.ts)),
      disagreements: disagreements.filter((x) => x.raisedBy === name || x.challenged === name),
      sources: sourcesFor(name, docMap, act),
      counts: {
        searches: act.filter((a) => a.tool === "WebSearch" && !a.error).length,
        fetches: act.filter((a) => a.tool === "WebFetch" && !a.error).length,
        writes: writes.get(name)?.size ?? 0,
        runs: mine.filter((t) => t.runId).length,
      },
    };
  });

  const verdict = parseVerdict(docMap.get("outputs/04_recommendation.md"));
  const stages: StageState[] = STAGES.map((s) => {
    const st = tasks.filter((t) => t.stage === s.key);
    const counts = {
      assigned: st.filter((t) => t.state === "assigned" || t.state === "dispatched").length,
      active: st.filter((t) => t.state === "running").length,
      completed: st.filter((t) => t.state === "completed").length,
      failed: st.filter((t) => FAILED.includes(t.state)).length,
    };
    // A failure is outstanding only if the same agent has no later completed task in this stage.
    const unresolvedFail = st.some((t) => FAILED.includes(t.state) &&
      !st.some((o) => o.agent === t.agent && o.state === "completed" && (o.endedAt ?? "") > (t.endedAt ?? "")));
    const evidence = s.evidence.map((p) => ({ path: p, present: present.has(p) }));
    const have = evidence.filter((x) => x.present).length;
    let status: StageStatus = "Not started";
    let reason = "No tasks or deliverables recorded for this stage";
    if (unresolvedFail) { status = "Attention"; reason = "A task in this stage failed or was stopped and has not been re-run successfully"; }
    else if (counts.active) { status = "In progress"; reason = `${counts.active} agent run(s) in progress`; }
    else if (counts.assigned) { status = "Waiting"; reason = `${counts.assigned} task(s) assigned or dispatched, not yet started`; }
    else if (have === evidence.length && (s.key !== "ic-decision" || verdict.verdict)) { status = "Completed"; reason = `All ${evidence.length} expected deliverable(s) recorded`; }
    else if (have || counts.completed) { status = "In progress"; reason = `${have} of ${evidence.length} expected deliverable(s) recorded`; }
    return { key: s.key, label: s.label, status, reason, tasks: counts, evidence, verdict: s.key === "ic-decision" ? verdict.verdict : undefined };
  });

  return {
    study,
    generatedAt: events.length ? events[events.length - 1].ts : study.createdAt,
    lastEventAt: events.length ? events[events.length - 1].ts : null,
    sessions: [...sessions.values()].sort(by((s) => s.startedAt ?? s.lastEventAt)),
    recordingActive,
    agents,
    orchestrator: { lastActivityAt: lastAt.get("orchestrator"), activity: (activity.get("orchestrator") ?? []).slice(-200) },
    stages,
    tasks,
    feed: feedFrom(events, tasks),
    verdict,
    documents: [...docMetas].sort(by((d) => d.path)),
  };
}

function countBy(rows: Record<string, string>[], key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = (r[key] || "UNSPECIFIED").toUpperCase();
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export function compareRow(state: StudyState, docs: Map<string, DocumentRec>): CompareRow {
  const src = docs.get("outputs/source_register.csv");
  const asm = docs.get("outputs/assumption_register.csv");
  const risk = docs.get("outputs/03_risk_register.csv");
  const dis = docs.get("outputs/disagreement_log.csv");
  const disRows = dis ? csvObjects(dis.content) : null;
  const runtimes = state.tasks.filter((t) => t.state === "completed").map((t) =>
    t.durationMs ?? (t.startedAt && t.endedAt ? Date.parse(t.endedAt) - Date.parse(t.startedAt) : undefined));
  const known = runtimes.filter((x): x is number => typeof x === "number" && x >= 0);
  return {
    slug: state.study.slug, name: state.study.name, kind: state.study.kind,
    verdict: state.verdict.verdict, reliability: state.verdict.reliability,
    firstEventAt: state.study.firstEventAt ?? null, lastEventAt: state.lastEventAt,
    agentsExecuted: state.agents.filter((a) => a.completedTasks.length > 0).length,
    tasksCompleted: state.tasks.filter((t) => t.state === "completed").length,
    tasksFailed: state.tasks.filter((t) => FAILED.includes(t.state)).length,
    agentRuntimeMs: known.length ? known.reduce((a, b) => a + b, 0) : null,
    documents: state.documents.length,
    sources: src ? csvObjects(src.content).length : null,
    assumptionsByStatus: asm ? countBy(csvObjects(asm.content), "status") : null,
    risksByClass: risk ? countBy(csvObjects(risk.content), "classification") : null,
    disagreements: disRows ? disRows.length : null,
    unresolvedDisagreements: disRows ? disRows.filter((r) => (r.residual_dissent && r.residual_dissent.toLowerCase() !== "none") || /open|unresolved/i.test(r.status ?? "")).length : null,
    stages: Object.fromEntries(state.stages.map((s) => [s.key, s.status])),
  };
}
