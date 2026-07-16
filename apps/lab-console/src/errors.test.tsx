import { describe, expect, it } from "vitest";
import { experimentReducer, initialExperimentState } from "./lib/experiment-reducer.js";

describe("honest partial states", () => {
  it("preserves an HTTP result when the event stream becomes incomplete", () => {
    const ready = experimentReducer(initialExperimentState, { type: "HEALTH_READY" });
    const running = experimentReducer(ready, { type: "RUN_STARTED" });
    const complete = experimentReducer(running, { type: "RUN_SUCCEEDED", result: {
      traceId: "trace", outcome: "blocked", status: 403, body: {}
    } });
    const partial = experimentReducer(complete, { type: "STREAM_INCOMPLETE" });
    expect(partial.status).toBe("stream-incomplete");
    expect(partial.result?.outcome).toBe("blocked");
  });

  it("separates exercise failures from infrastructure health failures", () => {
    const ready = experimentReducer(initialExperimentState, { type: "HEALTH_READY" });
    const running = experimentReducer(ready, { type: "RUN_STARTED" });
    expect(experimentReducer(running, { type: "RUN_FAILED", error: "bad request" }).status).toBe("exercise-error");
    expect(experimentReducer(initialExperimentState, { type: "INITIALIZATION_FAILED", error: "sql-lab" }).status)
      .toBe("infrastructure-error");
  });
});
