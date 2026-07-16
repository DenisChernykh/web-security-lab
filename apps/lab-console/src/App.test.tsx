import { fireEvent, render, screen } from "@testing-library/react";
import type { LabEvent } from "@local-lab/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

class MockEventSource {
  static latest: MockEventSource | undefined;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(_url: string) {
    MockEventSource.latest = this;
  }

  close(): void {}

  emit(event: LabEvent): void {
    this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent<string>);
  }
}

const sqlSource = {
  labId: "sql",
  vulnerable: "SELECT ... concatenated",
  safe: "SELECT ... WHERE email = ?"
};

describe("SQL console", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return Response.json({ status: "ok", labId: "sql" });
      }
      if (url.endsWith("/source")) {
        return Response.json(sqlSource);
      }
      if (url.endsWith("/mode")) {
        return Response.json({ mode: JSON.parse(String(init?.body)).mode });
      }
      if (url.endsWith("/exercise/login")) {
        const event: LabEvent = {
          id: "event-1",
          timestamp: "2026-07-16T00:00:00.000Z",
          traceId: "trace-sql-1",
          labId: "sql",
          mode: "vulnerable",
          stepId: "auth.decision",
          source: "auth",
          kind: "auth.decision",
          observation: "Условие SQL стало истинным для нескольких строк",
          explanation: "Фиксированная учебная атака обошла проверку пароля.",
          result: "exploited"
        };
        queueMicrotask(() => MockEventSource.latest?.emit(event));
        return Response.json({
          traceId: "trace-sql-1",
          outcome: "exploited",
          status: 200,
          body: { authenticated: true, user: { id: 1, email: "alice@example.test", display_name: "Alice" } }
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs the fixed SQL exercise and explains safe mode", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "SQL Injection" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Запустить локально" }));
    await screen.findByText("Условие SQL стало истинным для нескольких строк");
    fireEvent.click(screen.getByRole("button", { name: "Защищённая" }));
    expect(screen.getByText("Параметризованный запрос")).toBeTruthy();
  });
});
