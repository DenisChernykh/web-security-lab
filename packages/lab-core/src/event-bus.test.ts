import type { LabEvent } from "@local-lab/contracts";
import { describe, expect, it } from "vitest";
import { EventBus, ModeStore, createTrace, redact } from "./index.js";

const makeEvent = (kind: string): Omit<LabEvent, "id" | "timestamp"> => ({
  traceId: "trace-one",
  labId: "sql",
  mode: "vulnerable",
  stepId: "step-one",
  source: "api",
  kind,
  observation: "Observed",
  explanation: "Explained"
});

describe("EventBus", () => {
  it("bounds history and removes a subscriber", () => {
    const bus = new EventBus(2);
    const received: LabEvent[] = [];
    const unsubscribe = bus.subscribe((event) => received.push(event), false);

    bus.publish(makeEvent("one"));
    unsubscribe();
    bus.publish(makeEvent("two"));
    bus.publish(makeEvent("three"));

    expect(received.map((event) => event.kind)).toEqual(["one"]);
    expect(bus.recent().map((event) => event.kind)).toEqual(["two", "three"]);
  });

  it("replays recent events to a new subscriber by default", () => {
    const bus = new EventBus();
    bus.publish(makeEvent("one"));
    bus.publish(makeEvent("two"));
    const received: LabEvent[] = [];

    bus.subscribe((event) => received.push(event));

    expect(received.map((event) => event.kind)).toEqual(["one", "two"]);
  });

  it("filters recent events by trace ID", () => {
    const bus = new EventBus();
    bus.publish(makeEvent("one"));
    bus.publish({ ...makeEvent("two"), traceId: "trace-two" });

    expect(bus.forTrace("trace-one").map((event) => event.kind)).toEqual(["one"]);
  });

  it("redacts event data before storing and broadcasting", () => {
    const bus = new EventBus();
    const received: LabEvent[] = [];
    bus.subscribe((event) => received.push(event), false);

    const published = bus.publish({
      ...makeEvent("login"),
      data: { password: "secret", email: "alice@example.test" }
    });

    const expectedData = { password: "[REDACTED]", email: "alice@example.test" };
    expect(published.data).toEqual(expectedData);
    expect(bus.recent()[0]?.data).toEqual(expectedData);
    expect(received[0]?.data).toEqual(expectedData);
  });
});

describe("redact", () => {
  it("redacts nested secrets case-insensitively without mutating the input", () => {
    const input = {
      email: "alice@example.test",
      nested: { password: "secret", TOKEN: "abc" },
      attempts: [{ cookie: "sid=123", status: "failed" }]
    };

    expect(redact(input)).toEqual({
      email: "alice@example.test",
      nested: { password: "[REDACTED]", TOKEN: "[REDACTED]" },
      attempts: [{ cookie: "[REDACTED]", status: "failed" }]
    });
    expect(input.nested).toEqual({ password: "secret", TOKEN: "abc" });
  });
});

describe("ModeStore", () => {
  it("starts vulnerable and stores a valid mode", () => {
    const store = new ModeStore();

    expect(store.get()).toBe("vulnerable");
    expect(store.set("safe")).toBe("safe");
    expect(store.get()).toBe("safe");
  });

  it("rejects values outside the mode allowlist", () => {
    const store = new ModeStore();

    expect(() => store.set("custom")).toThrowError(
      new TypeError("mode must be vulnerable or safe")
    );
    expect(store.get()).toBe("vulnerable");
  });
});

describe("createTrace", () => {
  it("creates a stable trace context and emits populated events", () => {
    const bus = new EventBus();
    const trace = createTrace("sql", "safe", bus);

    const event = trace.emit({
      stepId: "query",
      source: "database",
      kind: "query.executed",
      observation: "One row returned",
      explanation: "The query used a parameter"
    });

    expect(trace.traceId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(trace.mode).toBe("safe");
    expect(event).toMatchObject({ traceId: trace.traceId, labId: "sql", mode: "safe" });
    expect(bus.forTrace(trace.traceId)).toEqual([event]);
  });
});
