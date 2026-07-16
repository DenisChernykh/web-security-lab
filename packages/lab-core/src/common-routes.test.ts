import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { LabEvent } from "@local-lab/contracts";
import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect, it, vi } from "vitest";
import {
  EventBus,
  ModeStore,
  createSourceReader,
  registerCommonRoutes
} from "./index.js";

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

describe("registerCommonRoutes", () => {
  it("serves health, mode, reset, and fixed source routes", async () => {
    const app = Fastify();
    const reset = vi.fn();
    await registerCommonRoutes(app, {
      labId: "sql",
      mode: new ModeStore(),
      events: new EventBus(),
      reset,
      readSource: async () => ({ labId: "sql", vulnerable: "v-code", safe: "s-code" })
    });

    try {
      expect((await app.inject({ method: "GET", url: "/health" })).json()).toEqual({
        status: "ok",
        labId: "sql"
      });
      expect((await app.inject({ method: "PUT", url: "/mode", payload: { mode: "safe" } })).json())
        .toEqual({ mode: "safe" });
      expect((await app.inject({ method: "PUT", url: "/mode", payload: { mode: "custom" } })).statusCode)
        .toBe(400);
      expect((await app.inject({ method: "POST", url: "/reset" })).json()).toEqual({ reset: true });
      expect((await app.inject({ method: "GET", url: "/source" })).json()).toEqual({
        labId: "sql",
        vulnerable: "v-code",
        safe: "s-code"
      });
      expect(reset).toHaveBeenCalledOnce();
    } finally {
      await app.close();
    }
  });

  it("returns the mode validation message as a 400 response", async () => {
    const app = Fastify();
    await registerCommonRoutes(app, {
      labId: "sql",
      mode: new ModeStore(),
      events: new EventBus(),
      reset: () => undefined,
      readSource: async () => ({ labId: "sql", vulnerable: "v-code", safe: "s-code" })
    });

    try {
      const response = await app.inject({
        method: "PUT",
        url: "/mode",
        payload: { mode: "custom" }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "mode must be vulnerable or safe" });
    } finally {
      await app.close();
    }
  });

  it("rejects every non-empty source query before reading a file", async () => {
    const app = Fastify();
    const readSource = vi.fn(async () => ({
      labId: "sql" as const,
      vulnerable: "v-code",
      safe: "s-code"
    }));
    await registerCommonRoutes(app, {
      labId: "sql",
      mode: new ModeStore(),
      events: new EventBus(),
      reset: () => undefined,
      readSource
    });

    try {
      const response = await app.inject({ method: "GET", url: "/source?path=other.ts" });

      expect(response.statusCode).toBe(400);
      expect(readSource).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("replays and streams events as server-sent event messages", async () => {
    type CapturedHandler = (
      request: { raw: EventEmitter },
      reply: {
        hijack(): void;
        raw: {
          setHeader(name: string, value: string): void;
          flushHeaders(): void;
          write(chunk: string): void;
        };
      }
    ) => void;
    let eventsHandler: CapturedHandler | undefined;
    const fakeApp = {
      get(path: string, handler: CapturedHandler) {
        if (path === "/events") eventsHandler = handler;
        return this;
      },
      put() {
        return this;
      },
      post() {
        return this;
      }
    } as unknown as FastifyInstance;
    const events = new EventBus();
    await registerCommonRoutes(fakeApp, {
      labId: "sql",
      mode: new ModeStore(),
      events,
      reset: () => undefined,
      readSource: async () => ({ labId: "sql", vulnerable: "v-code", safe: "s-code" })
    });
    events.publish(makeEvent("replayed"));
    const rawRequest = new EventEmitter();
    const writes: string[] = [];
    const setHeader = vi.fn();
    const hijack = vi.fn();
    vi.useFakeTimers();

    try {
      expect(eventsHandler).toBeTypeOf("function");
      eventsHandler?.({ raw: rawRequest }, {
        hijack,
        raw: {
          setHeader,
          flushHeaders: vi.fn(),
          write: (chunk) => {
            writes.push(chunk);
          }
        }
      });
      events.publish(makeEvent("live"));
      vi.advanceTimersByTime(15_000);

      expect(hijack).toHaveBeenCalledOnce();
      expect(setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
      expect(writes.some((chunk) => chunk.includes('"kind":"replayed"'))).toBe(true);
      expect(writes.some((chunk) => chunk.includes('"kind":"live"'))).toBe(true);
      expect(writes).toContain(": heartbeat\n\n");

      const writesBeforeClose = writes.length;
      rawRequest.emit("close");
      events.publish(makeEvent("after-close"));
      vi.advanceTimersByTime(15_000);
      expect(writes).toHaveLength(writesBeforeClose);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("createSourceReader", () => {
  it("reads only the two file URLs closed over at creation", async () => {
    const directory = await mkdtemp(join(tmpdir(), "local-lab-source-"));
    const vulnerablePath = join(directory, "vulnerable.ts");
    const safePath = join(directory, "safe.ts");
    await writeFile(vulnerablePath, "vulnerable-code", "utf8");
    await writeFile(safePath, "safe-code", "utf8");

    try {
      const readSource = createSourceReader(
        "sql",
        pathToFileURL(vulnerablePath),
        pathToFileURL(safePath)
      );

      await expect(readSource()).resolves.toEqual({
        labId: "sql",
        vulnerable: "vulnerable-code",
        safe: "safe-code"
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
