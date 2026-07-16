import type { LabEvent } from "@local-lab/contracts";
import { describe, expect, it } from "vitest";
import { experimentReducer, initialExperimentState } from "./experiment-reducer.js";

describe("experimentReducer", () => {
  it("keeps a running experiment running when delayed health checking completes", () => {
    const running = experimentReducer(initialExperimentState, { type: "RUN_STARTED" });

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
      experimentReducer(initialExperimentState, { type: "RUN_STARTED" })
    );

    expect(experimentReducer(withEvents, {
      type: "RUN_SUCCEEDED",
      result: { traceId: "trace-1", outcome: "exploited", status: 200, body: {} }
    }).events).toEqual([matching]);
  });
});
