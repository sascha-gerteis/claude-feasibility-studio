import { describe, expect, it } from "vitest";
import { dataMode, plainTask, poseFor } from "../shared/presentation";
import type { Task } from "../shared/types";

const task = (over: Partial<Task>): Task => ({ id: "t", agent: "a", stage: null, title: "x", state: "running", ...over });

describe("event-to-animation mapping", () => {
  it("animates work only for a recorded running task", () => {
    expect(poseFor({ status: "Working", currentTask: task({ stage: "independent-research", title: "[stage:independent-research] Market demand" }) })).toBe("typing");
    expect(poseFor({ status: "Working", currentTask: task({ stage: "cross-review", title: "Review syndications" }) })).toBe("reviewing");
    expect(poseFor({ status: "Waiting", currentTask: task({ state: "assigned" }) })).toBe("waiting");
    expect(poseFor({ status: "Completed", currentTask: undefined })).toBe("done");
    expect(poseFor({ status: "Error", currentTask: undefined })).toBe("alert");
    expect(poseFor({ status: "Idle", currentTask: undefined })).toBe("idle");
  });

  it("writes tasks in plain English", () => {
    expect(plainTask(task({ title: "[stage:independent-research] Market demand and comparables" }))).toBe("Market demand and comparables");
    expect(plainTask(task({ title: "Smoke: confirm ai-strategy can write" }))).toBe("Validation check: confirm ai-strategy can write");
    expect(plainTask(undefined)).toBeNull();
  });
});

describe("data mode labels", () => {
  const base = { study: { kind: "study" }, sessions: [{ open: true }], recordingActive: true } as never;
  it("hosted pages are never LIVE", () => {
    expect(dataMode(base, { hosted: true, connected: true }).map((m) => m.key)).toEqual(["SYNCED SNAPSHOT"]);
  });
  it("self-served is LIVE only with an open recorded session and a connected stream", () => {
    expect(dataMode(base, { hosted: false, connected: true })[0]).toMatchObject({ key: "LIVE", live: true });
    expect(dataMode(base, { hosted: false, connected: false })[0].key).toBe("NOT LIVE");
    const ended = { study: { kind: "study" }, sessions: [{ open: false }], recordingActive: true } as never;
    expect(dataMode(ended, { hosted: false, connected: true })[0].key).toBe("STORED RECORD");
  });
  it("validation runs always carry TEST DATA", () => {
    const v = { study: { kind: "validation" }, sessions: [], recordingActive: false } as never;
    expect(dataMode(v, { hosted: true, connected: true }).map((m) => m.key)).toEqual(["TEST DATA", "SYNCED SNAPSHOT"]);
  });
});
