import { describe, expect, it } from "vitest";
import { buildTasks, deriveStudy, parseVerdict } from "../shared/derive";
import { parseCsv } from "../shared/csv";
import type { DocumentMeta, DocumentRec, StudioEvent, StudySummary } from "../shared/types";

let n = 0;
const ev = (type: string, ts: string, f: Partial<StudioEvent> = {}): StudioEvent => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, study: "t", ts: `2026-11-15T10:${ts}Z`, type, session_id: "S1", ...f,
});
const study: StudySummary = { slug: "t", name: "Test", kind: "validation", createdAt: "2026-11-15T10:00:00Z", eventCount: 0, documentCount: 0, active: true };
const derive = (events: StudioEvent[], docs: DocumentRec[] = []) =>
  deriveStudy(study, events, docs.map(({ content: _c, ...m }) => m as DocumentMeta), docs, []);
const doc = (path: string, content = "x"): DocumentRec => ({ study: "t", path, sha256: "a".repeat(64), size: content.length, updatedAt: "2026-11-15T10:59:00Z", versions: 1, content });

describe("status derivation from recorded events", () => {
  it("is Idle with no events — never invents activity", () => {
    const s = derive([]);
    expect(s.agents).toHaveLength(7);
    expect(s.agents.every((a) => a.status === "Idle")).toBe(true);
    expect(s.stages.every((x) => x.status === "Not started")).toBe(true);
  });

  it("foreground run: dispatch -> start -> stop -> result (as captured from Claude Code)", () => {
    const events = [
      ev("session.start", "00:00"),
      ev("task.dispatch", "00:01", { agent: "ai-strategy", tool_use_id: "TU1", data: { description: "[stage:independent-research] AI research", stage: "independent-research" } }),
      ev("agent.start", "00:02", { agent: "ai-strategy", agent_run_id: "R1" }),
    ];
    let s = derive(events);
    const ai = () => s.agents.find((a) => a.name === "ai-strategy")!;
    expect(ai().status).toBe("Working");
    expect(ai().currentTask?.title).toContain("AI research");
    expect(s.stages.find((x) => x.key === "independent-research")!.status).toBe("In progress");

    events.push(ev("tool.use", "00:03", { agent: "ai-strategy", agent_run_id: "R1", data: { tool: "WebSearch", summary: "Thailand hotel AI adoption" } }));
    events.push(ev("file.write", "00:04", { agent: "ai-strategy", agent_run_id: "R1", data: { path: "research/ai-strategy/findings.md" } }));
    events.push(ev("agent.stop", "00:05", { agent: "ai-strategy", agent_run_id: "R1", data: { result_excerpt: "DONE" } }));
    events.push(ev("task.result", "00:06", { agent: "ai-strategy", tool_use_id: "TU1", agent_run_id: "R1", data: { status: "completed", tokens: 1000, duration_ms: 5000 } }));
    s = derive(events, [doc("research/ai-strategy/findings.md")]);
    expect(ai().status).toBe("Completed");
    expect(ai().completedTasks).toHaveLength(1);
    expect(ai().completedTasks[0].tokens).toBe(1000);
    expect(ai().counts.searches).toBe(1);
    expect(ai().reportPath).toBe("research/ai-strategy/findings.md");
    expect(ai().deliverables.map((d) => d.path)).toContain("research/ai-strategy/findings.md");
  });

  it("background run: result(async_launched) arrives before stop; stays Working until SubagentStop", () => {
    const events = [
      ev("task.dispatch", "01:00", { agent: "syndications", tool_use_id: "TU2", data: { description: "bg", background: true } }),
      ev("agent.start", "01:01", { agent: "syndications", agent_run_id: "R2" }),
      ev("task.result", "01:01", { agent: "syndications", tool_use_id: "TU2", agent_run_id: "R2", data: { status: "async_launched", async: true } }),
    ];
    expect(derive(events).agents.find((a) => a.name === "syndications")!.status).toBe("Working");
    events.push(ev("agent.stop", "01:09", { agent: "syndications", agent_run_id: "R2" }));
    expect(derive(events).agents.find((a) => a.name === "syndications")!.status).toBe("Completed");
  });

  it("background run where the async result (agentId) precedes SubagentStart — as recorded in the real smoke run", () => {
    const events = [
      ev("task.assign", "07:00", { agent: "investment-banking", data: { stage: "independent-research", title: "Assigned title" } }),
      ev("task.dispatch", "07:01.219", { agent: "investment-banking", tool_use_id: "TU7", data: { description: "bg", stage: "independent-research", background: true } }),
      ev("task.result", "07:01.305", { agent: "investment-banking", tool_use_id: "TU7", agent_run_id: "R7", data: { status: "async_launched" } }),
      ev("agent.start", "07:01.318", { agent: "investment-banking", agent_run_id: "R7" }),
    ];
    const tasks = buildTasks(events);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ title: "Assigned title", state: "running", runId: "R7" });
    const a = derive(events).agents.find((x) => x.name === "investment-banking")!;
    expect(a.status).toBe("Working");
    expect(a.outstandingTasks).toHaveLength(1);
  });

  it("killed background agent (no SubagentStop, only TaskStop) becomes Error, not Working forever", () => {
    const events = [
      ev("task.dispatch", "02:00", { agent: "project-technology", tool_use_id: "TU3", data: { description: "sleep", background: true } }),
      ev("agent.start", "02:01", { agent: "project-technology", agent_run_id: "R3" }),
      ev("task.result", "02:01", { tool_use_id: "TU3", agent_run_id: "R3", data: { status: "async_launched" } }),
      ev("agent.killed", "02:02", { agent_run_id: "R3" }),
    ];
    const a = derive(events).agents.find((x) => x.name === "project-technology")!;
    expect(a.status).toBe("Error");
    expect(a.statusReason).toMatch(/TaskStop/);
  });

  it("failed dispatch (PostToolUseFailure) is an Error with the recorded message", () => {
    const s = derive([
      ev("task.dispatch", "03:00", { agent: "investment-banking", tool_use_id: "TU4", data: { description: "x" } }),
      ev("task.failure", "03:01", { agent: "investment-banking", tool_use_id: "TU4", data: { error: "Agent type not found" } }),
    ]);
    const a = s.agents.find((x) => x.name === "investment-banking")!;
    expect(a.status).toBe("Error");
    expect(a.errors[0].message).toContain("Agent type not found");
  });

  it("session end while running marks the run interrupted", () => {
    const s = derive([
      ev("task.dispatch", "04:00", { agent: "real-estate-hospitality", tool_use_id: "TU5", data: { description: "x" } }),
      ev("agent.start", "04:01", { agent: "real-estate-hospitality", agent_run_id: "R5" }),
      ev("session.end", "04:02", { data: { reason: "other" } }),
    ]);
    const a = s.agents.find((x) => x.name === "real-estate-hospitality")!;
    expect(a.status).toBe("Error");
    expect(a.failedTasks[0].state).toBe("interrupted");
    expect(s.sessions[0].open).toBe(false);
  });

  it("assignments are outstanding (Waiting) until dispatched, then matched by agent and stage", () => {
    const events = [ev("task.assign", "05:00", { agent: "environmental-technologies", data: { stage: "cross-review", title: "Review syndications" } })];
    let a = derive(events).agents.find((x) => x.name === "environmental-technologies")!;
    expect(a.status).toBe("Waiting");
    expect(a.outstandingTasks).toHaveLength(1);
    events.push(ev("task.dispatch", "05:01", { agent: "environmental-technologies", tool_use_id: "TU6", data: { description: "[stage:cross-review] Review", stage: "cross-review" } }));
    events.push(ev("agent.start", "05:02", { agent: "environmental-technologies", agent_run_id: "R6" }));
    const tasks = buildTasks(events);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Review syndications");
    expect(tasks[0].state).toBe("running");
  });

  it("repairs FIFO linkage using the authoritative agentId from the tool response", () => {
    const tasks = buildTasks([
      ev("task.dispatch", "06:00", { agent: "ai-strategy", tool_use_id: "A", data: { description: "first" } }),
      ev("task.dispatch", "06:00", { agent: "ai-strategy", tool_use_id: "B", data: { description: "second" } }),
      ev("agent.start", "06:01", { agent: "ai-strategy", agent_run_id: "RB" }),
      ev("agent.start", "06:02", { agent: "ai-strategy", agent_run_id: "RA" }),
      ev("task.result", "06:03", { tool_use_id: "A", agent_run_id: "RA", data: { status: "async_launched" } }),
    ]);
    expect(tasks.find((t) => t.toolUseId === "A")!.runId).toBe("RA");
    expect(tasks.find((t) => t.toolUseId === "B")!.runId).toBe("RB");
  });

  it("IC decision stage completes only with a real verdict, not the template placeholder", () => {
    const tpl = doc("outputs/04_recommendation.md", "**Verdict:** GO / CONDITIONAL GO / DEFER / NO-GO\n**Reliability of evidence:** HIGH / MODERATE / LOW");
    expect(parseVerdict(tpl).verdict).toBeNull();
    const real = doc("outputs/04_recommendation.md", "**Verdict:** DEFER\n**Reliability of evidence:** LOW — single AI-drafted document");
    expect(parseVerdict(real)).toMatchObject({ verdict: "DEFER", reliability: "LOW" });
    expect(derive([], [real]).stages.find((s) => s.key === "ic-decision")!.status).toBe("Completed");
  });

  it("reads disagreements and sources from the registers", () => {
    const s = derive([], [
      doc("outputs/disagreement_log.csv", "disagreement_id,topic,raised_by,challenged_agent,resolution,residual_dissent\nD1,ADR,real-estate-hospitality,investment-banking,lowered,none\n"),
      doc("research/investment-banking/sources.csv", 'source_id,title,publisher,document_url_or_path\nS1,"Pattaya, H1",Colliers,https://example.org\n'),
      doc("research/cross-review/syndications__on__investment-banking.md"),
    ]);
    const ib = s.agents.find((a) => a.name === "investment-banking")!;
    expect(ib.disagreements).toHaveLength(2);
    expect(ib.sources[0]).toMatchObject({ id: "S1", title: "Pattaya, H1", publisher: "Colliers" });
  });
});

describe("assessment completion is separate from task status", () => {
  it("a completed smoke task is NOT a completed assessment", () => {
    const s = derive([
      ev("task.dispatch", "08:00", { agent: "ai-strategy", tool_use_id: "Q1", data: { description: "smoke" } }),
      ev("agent.start", "08:01", { agent: "ai-strategy", agent_run_id: "QR1" }),
      ev("agent.stop", "08:02", { agent: "ai-strategy", agent_run_id: "QR1" }),
    ], [doc("research/ai-strategy/smoke_check.md")]);
    const a = s.agents.find((x) => x.name === "ai-strategy")!;
    expect(a.status).toBe("Completed");
    expect(a.assessment.report.ready).toBe(false);
    expect(a.assessment.complete).toBe(false);
    expect(s.overview.completedAssessments).toBe(0);
  });

  it("complete only when all deliverables exist AND the quality gate passed; a failed gate is a blocker", () => {
    const files = ["findings.md", "sources.csv", "assumptions.csv", "risks.csv"].map((f) => doc(`research/syndications/${f}`, "x"));
    const pass = doc("research/syndications/quality_check.json", '{"status":"PASS","checks":[]}');
    const fail = doc("research/syndications/quality_check.json", '{"status":"FAIL","checks":[{"name":"Report length","passed":false}]}');
    expect(derive([], files).agents.find((x) => x.name === "syndications")!.assessment.complete).toBe(false);
    const ok = derive([], [...files, pass]);
    expect(ok.agents.find((x) => x.name === "syndications")!.assessment.complete).toBe(true);
    expect(ok.overview.completedAssessments).toBe(1);
    const bad = derive([], [...files, fail]);
    expect(bad.blockers[0]).toMatchObject({ kind: "quality", agent: "syndications" });
  });
});

describe("csv", () => {
  it("handles quotes, commas and newlines", () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi"""\n"multi\nline",2\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"'], ["multi\nline", "2"]]);
  });
});
