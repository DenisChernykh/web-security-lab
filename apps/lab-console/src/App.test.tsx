import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

type ModeBehavior = "success" | "deferred" | "failure";
type HealthBehavior = "success" | "deferred-failure";
type ExerciseBehavior = "success" | "deferred";

let modeBehavior: ModeBehavior;
let healthBehavior: HealthBehavior;
let exerciseBehavior: ExerciseBehavior;
let resolveModeRequest: ((response: Response) => void) | undefined;
let rejectHealthRequest: ((error: Error) => void) | undefined;
let exerciseRequests: number;
let exerciseRequestBody: unknown;
let modeRequests: number;

describe("SQL console", () => {
  beforeEach(() => {
    modeBehavior = "success";
    healthBehavior = "success";
    exerciseBehavior = "success";
    resolveModeRequest = undefined;
    rejectHealthRequest = undefined;
    exerciseRequests = 0;
    exerciseRequestBody = undefined;
    modeRequests = 0;
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        if (healthBehavior === "deferred-failure") {
          return new Promise<Response>((_resolve, reject) => {
            rejectHealthRequest = reject;
          });
        }
        return Response.json({ status: "ok", labId: "sql" });
      }
      if (url.endsWith("/source")) {
        return Response.json(sqlSource);
      }
      if (url.endsWith("/mode")) {
        if (init?.method !== "PUT") {
          return Response.json({ mode: "vulnerable" });
        }
        modeRequests += 1;
        if (modeBehavior === "deferred") {
          return new Promise<Response>((resolve) => {
            resolveModeRequest = resolve;
          });
        }
        if (modeBehavior === "failure") {
          throw new Error("mode unavailable");
        }
        return Response.json({ mode: JSON.parse(String(init?.body)).mode });
      }
      if (url.endsWith("/exercise/login")) {
        exerciseRequests += 1;
        exerciseRequestBody = JSON.parse(String(init?.body));
        if (exerciseBehavior === "deferred") {
          return new Promise<Response>(() => undefined);
        }
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
          body: {
            authenticated: true,
            session: "session-secret",
            user: { id: 1, email: "alice@example.test", display_name: "Alice" }
          }
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("redacts fixed request previews and response bodies while running the unchanged exercise", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "SQL Injection" })).toBeTruthy();
    expect(screen.getByText('{"email":"\' OR 1=1 -- ","password":"[REDACTED]"}')).toBeTruthy();
    expect(screen.queryByText(/"password":"demo"/)).toBeNull();
    await screen.findByText("Локальная лаборатория готова");
    fireEvent.click(screen.getByRole("button", { name: "Запустить локально" }));
    await screen.findByText("Условие SQL стало истинным для нескольких строк");
    expect(exerciseRequestBody).toEqual({ email: "' OR 1=1 -- ", password: "demo" });
    expect(screen.getByText(/"session": "\[REDACTED\]"/)).toBeTruthy();
    expect(screen.queryByText(/session-secret/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Защищённая" }));
    await screen.findByText("Параметризованный запрос");
  });

  it("does not run until the server confirms the selected mode", async () => {
    modeBehavior = "deferred";
    render(<App />);

    await screen.findByText("Локальная лаборатория готова");
    const safeButton = screen.getByRole("button", { name: "Защищённая" });
    const runButton = screen.getByRole("button", { name: "Запустить локально" }) as HTMLButtonElement;
    fireEvent.click(safeButton);

    expect(safeButton.getAttribute("aria-pressed")).toBe("false");
    expect(runButton.disabled).toBe(true);
    fireEvent.click(runButton);
    expect(exerciseRequests).toBe(0);

    await act(async () => {
      resolveModeRequest?.(Response.json({ mode: "safe" }));
    });

    await waitFor(() => expect(safeButton.getAttribute("aria-pressed")).toBe("true"));
    expect(runButton.disabled).toBe(false);
  });

  it("keeps the confirmed mode visible when setting a new mode fails", async () => {
    modeBehavior = "failure";
    render(<App />);

    await screen.findByText("Локальная лаборатория готова");
    const vulnerableButton = screen.getByRole("button", { name: "Уязвимая" });
    const safeButton = screen.getByRole("button", { name: "Защищённая" });
    fireEvent.click(safeButton);

    await screen.findByText("mode unavailable");
    expect(vulnerableButton.getAttribute("aria-pressed")).toBe("true");
    expect(safeButton.getAttribute("aria-pressed")).toBe("false");
  });

  it("does not allow a mode switch after an exercise starts", async () => {
    exerciseBehavior = "deferred";
    render(<App />);

    await screen.findByText("Локальная лаборатория готова");
    const runButton = screen.getByRole("button", { name: "Запустить локально" });
    const safeButton = screen.getByRole("button", { name: "Защищённая" }) as HTMLButtonElement;
    fireEvent.click(runButton);

    await screen.findByText("Выполняем фиксированный учебный запрос");
    expect(safeButton.disabled).toBe(true);
    fireEvent.click(safeButton);
    expect(modeRequests).toBe(0);
    expect(safeButton.getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps execution unavailable until a delayed health check rejects", async () => {
    healthBehavior = "deferred-failure";
    render(<App />);

    const runButton = screen.getByRole("button", { name: "Запустить локально" }) as HTMLButtonElement;
    expect(runButton.disabled).toBe(true);
    fireEvent.click(runButton);
    expect(exerciseRequests).toBe(0);

    await act(async () => {
      rejectHealthRequest?.(new Error("health unavailable"));
    });

    await screen.findByText("sql-lab: health unavailable");
    expect(runButton.disabled).toBe(true);
  });
});
