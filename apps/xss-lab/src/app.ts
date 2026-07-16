import { FIXED_EXERCISES, type ExerciseResult, type LabMode } from "@local-lab/contracts";
import {
  EventBus,
  ModeStore,
  createSourceReader,
  createTrace,
  redact,
  registerCommonRoutes
} from "@local-lab/lab-core";
import Fastify from "fastify";
import { type CommentRow, XssLabDatabase } from "./database.js";
import { safeRender } from "./handlers/safe.js";
import { vulnerableRender } from "./handlers/vulnerable.js";
import { XSS_LESSON, commentOutcome } from "./lesson.js";

export interface CreateXssLabOptions {
  databasePath?: string;
}

interface CommentRequest {
  body: string;
}

interface BrowserEventRequest {
  type: "lab-xss";
  traceId: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);

const isFixedComment = (value: unknown): value is CommentRequest => {
  if (!isRecord(value) || !hasExactKeys(value, ["body"]) || typeof value.body !== "string") {
    return false;
  }

  return value.body === FIXED_EXERCISES.xss.normal || value.body === FIXED_EXERCISES.xss.attack;
};

const isBrowserEvent = (value: unknown): value is BrowserEventRequest =>
  isRecord(value) &&
  hasExactKeys(value, ["type", "traceId"]) &&
  value.type === "lab-xss" &&
  typeof value.traceId === "string" &&
  UUID_PATTERN.test(value.traceId);

const isRenderQuery = (value: unknown): value is { traceId: string } =>
  isRecord(value) &&
  hasExactKeys(value, ["traceId"]) &&
  typeof value.traceId === "string" &&
  UUID_PATTERN.test(value.traceId);

const renderDocument = (content: string): string => `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Local XSS exercise</title></head>
  <body><main><h1>Stored comment preview</h1><ul>${content}</ul></main></body>
</html>`;

const eventData = (value: Record<string, unknown>): Record<string, unknown> =>
  redact(value) as Record<string, unknown>;

export function createXssLab({ databasePath = ":memory:" }: CreateXssLabOptions = {}) {
  const app = Fastify();
  const bus = new EventBus();
  const mode = new ModeStore();
  const database = new XssLabDatabase(databasePath);

  void registerCommonRoutes(app, {
    labId: "xss",
    mode,
    events: bus,
    reset: () => database.reset(),
    readSource: createSourceReader(
      "xss",
      new URL("./handlers/vulnerable.ts", import.meta.url),
      new URL("./handlers/safe.ts", import.meta.url)
    )
  });

  app.post("/exercise/comment", async (request, reply) => {
    if (!isFixedComment(request.body)) {
      return reply.code(400).send({ error: "comment is not an allowed exercise" });
    }

    const trace = createTrace("xss", mode.get(), bus);
    trace.emit({
      stepId: "request.received",
      source: "api",
      kind: "request.received",
      observation: XSS_LESSON.request.observation,
      explanation: XSS_LESSON.request.explanation,
      data: eventData({ body: request.body.body })
    });
    const comment = database.insert(request.body.body);
    trace.emit({
      stepId: "comment.stored",
      source: "database",
      kind: "comment.stored",
      observation: XSS_LESSON.stored.observation,
      explanation: XSS_LESSON.stored.explanation,
      data: eventData({ commentId: comment.id, body: comment.body })
    });
    trace.emit({
      stepId: "render.intent",
      source: "renderer",
      kind: "render.intent",
      observation: XSS_LESSON.renderIntent.observation,
      explanation: XSS_LESSON.renderIntent.explanation,
      data: eventData({ mode: trace.mode, commentId: comment.id })
    });

    const outcome = commentOutcome(trace.mode, request.body.body === FIXED_EXERCISES.xss.attack);
    const result: ExerciseResult<{ stored: boolean; comment: CommentRow }> = {
      traceId: trace.traceId,
      outcome,
      status: 200,
      body: { stored: true, comment }
    };
    return reply.code(200).send(result);
  });

  app.get("/render", async (request, reply) => {
    if (!isRenderQuery(request.query)) {
      return reply.code(400).send({ error: "render requires only an existing traceId" });
    }

    const traceEvents = bus.forTrace(request.query.traceId);
    if (traceEvents.length === 0) {
      return reply.code(404).send({ error: "trace not found" });
    }

    const traceMode: LabMode = traceEvents[0]!.mode;
    const comments = database.list();
    const rendered = traceMode === "vulnerable" ? vulnerableRender(comments) : safeRender(comments);
    return reply.type("text/html; charset=utf-8").send(renderDocument(rendered));
  });

  app.post("/exercise/browser-event", async (request, reply) => {
    if (!isBrowserEvent(request.body)) {
      return reply.code(400).send({ error: "browser event is not an allowed exercise" });
    }

    const traceEvents = bus.forTrace(request.body.traceId);
    const firstEvent = traceEvents[0];
    if (firstEvent === undefined) {
      return reply.code(404).send({ error: "trace not found" });
    }

    bus.publish({
      traceId: request.body.traceId,
      labId: "xss",
      mode: firstEvent.mode,
      stepId: "renderer.script-executed",
      source: "renderer",
      kind: "renderer.script-executed",
      observation: XSS_LESSON.browser.observation,
      explanation: XSS_LESSON.browser.explanation,
      data: eventData({ type: request.body.type })
    });
    return { acknowledged: true };
  });

  return {
    app,
    bus,
    async close(): Promise<void> {
      await app.close();
      database.close();
    }
  };
}
