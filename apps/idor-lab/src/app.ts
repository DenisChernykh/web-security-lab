import cookie from "@fastify/cookie";
import { FIXED_EXERCISES, type ExerciseOutcome, type ExerciseResult } from "@local-lab/contracts";
import {
  EventBus,
  ModeStore,
  createSourceReader,
  createTrace,
  registerCommonRoutes
} from "@local-lab/lab-core";
import Fastify from "fastify";
import { type DocumentRow, IdorLabDatabase } from "./database.js";
import { safeRead } from "./handlers/safe.js";
import { vulnerableRead } from "./handlers/vulnerable.js";
import { IDOR_LESSON } from "./lesson.js";

export interface CreateIdorLabOptions {
  databasePath?: string;
}

interface SessionRequest {
  user: typeof FIXED_EXERCISES.idor.user;
}

const SESSION_COOKIE = "idor_session";
const ALICE = FIXED_EXERCISES.idor.user;
const ALLOWED_DOCUMENTS = new Set<string>(FIXED_EXERCISES.idor.documents);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);

const isSessionRequest = (value: unknown): value is SessionRequest =>
  isRecord(value) && hasExactKeys(value, ["user"]) && value.user === ALICE;

const isAllowedDocument = (documentId: string): boolean => ALLOWED_DOCUMENTS.has(documentId);

export function createIdorLab({ databasePath = ":memory:" }: CreateIdorLabOptions = {}) {
  const app = Fastify();
  const bus = new EventBus();
  const mode = new ModeStore();
  const database = new IdorLabDatabase(databasePath);

  void app.register(cookie);
  void registerCommonRoutes(app, {
    labId: "idor",
    mode,
    events: bus,
    reset: () => {
      database.reset();
      return database.connection.prepare("SELECT COUNT(*) AS count FROM documents").get();
    },
    readSource: createSourceReader(
      "idor",
      new URL("./handlers/vulnerable.ts", import.meta.url),
      new URL("./handlers/safe.ts", import.meta.url)
    )
  });

  app.post("/exercise/session", async (request, reply) => {
    if (!isSessionRequest(request.body)) {
      return reply.code(400).send({ error: "session is not an allowed exercise" });
    }

    reply.setCookie(SESSION_COOKIE, ALICE, {
      httpOnly: true,
      sameSite: "lax",
      path: "/api/idor"
    });
    return { session: "accepted" };
  });

  app.get("/exercise/documents/:id", async (request, reply) => {
    const userId = request.cookies[SESSION_COOKIE];
    if (userId !== ALICE) {
      return reply.code(401).send({ error: "session is required" });
    }

    const documentId = (request.params as { id?: unknown }).id;
    if (typeof documentId !== "string" || !isAllowedDocument(documentId)) {
      return reply.code(400).send({ error: "document is not an allowed exercise" });
    }

    if (Object.keys(request.query as Record<string, unknown>).length > 0) {
      return reply.code(400).send({ error: "document query parameters are not allowed" });
    }

    const trace = createTrace("idor", mode.get(), bus);
    trace.emit({
      stepId: "auth.session-accepted",
      source: "auth",
      kind: "auth.session-accepted",
      observation: IDOR_LESSON.session.observation,
      explanation: IDOR_LESSON.session.explanation,
      data: { userId }
    });

    const document = trace.mode === "vulnerable"
      ? vulnerableRead(database.connection, documentId, userId)
      : safeRead(database.connection, documentId, userId);
    const authorizationLesson = IDOR_LESSON.authorization[trace.mode];
    const outcome: ExerciseOutcome = document === undefined
      ? "blocked"
      : document.owner_id === userId ? "expected" : "exploited";
    trace.emit({
      stepId: "authorization.owner-check",
      source: "auth",
      kind: "authorization.owner-check",
      observation: authorizationLesson.observation,
      explanation: authorizationLesson.explanation,
      result: outcome,
      data: { documentId, documentFound: document !== undefined, ownerId: document?.owner_id ?? null }
    });

    const status = document === undefined ? 404 : 200;
    const result: ExerciseResult<{ document: DocumentRow | null }> = {
      traceId: trace.traceId,
      outcome,
      status,
      body: { document: document ?? null }
    };
    return reply.code(status).send(result);
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
