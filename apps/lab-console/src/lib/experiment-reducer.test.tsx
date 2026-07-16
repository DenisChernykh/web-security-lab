import type { LabEvent } from "@local-lab/contracts";
import { describe, expect, it } from "vitest";
import { experimentReducer, initialExperimentState } from "./experiment-reducer.js";

describe("experimentReducer", () => {
  it("does not let a delayed initialization failure replace an active experiment", () => {
    const ready = experimentReducer(initialExperimentState, { type: "HEALTH_READY" });
    const running = experimentReducer(ready, { type: "RUN_STARTED" });

    expect(experimentReducer(running, {
      type: "INITIALIZATION_FAILED",
      error: "health unavailable"
    })).toEqual(running);
  });

  it("ignores mode transitions while an experiment is running", () => {
    const ready = experimentReducer(initialExperimentState, { type: "HEALTH_READY" });
    const running = experimentReducer(ready, { type: "RUN_STARTED" });

    expect(experimentReducer(running, { type: "MODE_CHANGE_STARTED", mode: "safe" })).toEqual(running);
    expect(experimentReducer(running, { type: "MODE_CHANGED", mode: "safe" })).toEqual(running);
    expect(experimentReducer(running, {
      type: "MODE_CHANGE_FAILED",
      error: "mode unavailable"
    })).toEqual(running);
  });

  it("keeps a completed result truthful when a later mode request fails", () => {
    const ready = experimentReducer(initialExperimentState, { type: "HEALTH_READY" });
    const running = experimentReducer(ready, { type: "RUN_STARTED" });
    const complete = experimentReducer(running, {
      type: "RUN_SUCCEEDED",
      result: { traceId: "trace-1", outcome: "exploited", status: 200, body: { authenticated: true } }
    });
    const pendingModeChange = experimentReducer(complete, { type: "MODE_CHANGE_STARTED", mode: "safe" });

    expect(experimentReducer(pendingModeChange, {
      type: "MODE_CHANGE_FAILED",
      error: "mode unavailable"
    })).toMatchObject({
      status: "complete",
      mode: "vulnerable",
      result: { traceId: "trace-1", outcome: "exploited" },
      error: "mode unavailable"
    });
  });

  it("keeps a running experiment running when delayed health checking completes", () => {
    const ready = experimentReducer(initialExperimentState, { type: "HEALTH_READY" });
    const running = experimentReducer(ready, { type: "RUN_STARTED" });

    expect(experimentReducer(running, { type: "HEALTH_READY" }).status).toBe("running");
  });

  it("retains only events for the completed exercise trace", () => {
    const matching: LabEvent = {
      id: "matching", timestamp: "2026-07-16T00:00:00.000Z", traceId: "trace-1", labId: "sql",
      mode: "vulnerable", stepId: "auth.decision", source: "auth", kind: "auth.decision",
      observation: "Expected", explanation: "Expected"
    };
    const stale = { ...matching, id: "stale", traceId: "trace-0" };
    const withEvents = [matching, stale].reduce(
      (state, event) => experimentReducer(state, { type: "RUN_EVENT", event }),
      experimentReducer(experimentReducer(initialExperimentState, { type: "HEALTH_READY" }), { type: "RUN_STARTED" })
    );

    expect(experimentReducer(withEvents, {
      type: "RUN_SUCCEEDED",
      result: { traceId: "trace-1", outcome: "exploited", status: 200, body: {} }
    }).events).toEqual([matching]);
  });

  it("never compares results from different fixed request kinds", () => {
    const ready = experimentReducer(initialExperimentState, { type: "HEALTH_READY" });
    const vulnerableAttack = experimentReducer(
      experimentReducer(ready, { type: "RUN_STARTED" }),
      { type: "RUN_SUCCEEDED", result: { traceId: "attack", outcome: "exploited", status: 200, body: {} } }
    );
    const normalSelected = experimentReducer(vulnerableAttack, { type: "REQUEST_KIND_CHANGED", requestKind: "normal" });

    expect(normalSelected.requestKind).toBe("normal");
    expect(normalSelected.comparison).toEqual({});
    expect(normalSelected.result).toBeUndefined();
  });
});
