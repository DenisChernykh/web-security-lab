import { FIXED_EXERCISES, type ExerciseOutcome, type ExerciseResult } from "@local-lab/contracts";
import {
  EventBus,
  ModeStore,
  createSourceReader,
  createTrace,
  registerCommonRoutes
} from "@local-lab/lab-core";
import Fastify from "fastify";
import { SqlLabDatabase } from "./database.js";
import { safeLogin } from "./handlers/safe.js";
import { type LoginRow, vulnerableLogin } from "./handlers/vulnerable.js";
import { SQL_LESSON, authDecision } from "./lesson.js";

export interface CreateSqlLabOptions {
  databasePath?: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

const hasOnlyLoginFields = (value: Record<string, unknown>): boolean =>
  Object.keys(value).length === 2 && "email" in value && "password" in value;

function isFixedLogin(value: unknown): value is LoginRequest {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const request = value as Record<string, unknown>;
  if (!hasOnlyLoginFields(request) || typeof request.email !== "string" || typeof request.password !== "string") {
    return false;
  }

  return (
    (request.email === FIXED_EXERCISES.sql.normal.email &&
      request.password === FIXED_EXERCISES.sql.normal.password) ||
    (request.email === FIXED_EXERCISES.sql.attack.email &&
      request.password === FIXED_EXERCISES.sql.attack.password)
  );
}

function isAttackLogin(request: LoginRequest): boolean {
  return request.email === FIXED_EXERCISES.sql.attack.email;
}

export function createSqlLab({ databasePath = ":memory:" }: CreateSqlLabOptions = {}) {
  const app = Fastify();
  const bus = new EventBus();
  const mode = new ModeStore();
  const database = new SqlLabDatabase(databasePath);

  void registerCommonRoutes(app, {
    labId: "sql",
    mode,
    events: bus,
    reset: () => {
      database.reset();
      return database.connection.prepare("SELECT COUNT(*) AS count FROM users").get();
    },
    readSource: createSourceReader(
      "sql",
      new URL("./handlers/vulnerable.ts", import.meta.url),
      new URL("./handlers/safe.ts", import.meta.url)
    )
  });

  app.post("/exercise/login", async (request, reply) => {
    if (!isFixedLogin(request.body)) {
      return reply.code(400).send({ error: "login request is not an allowed exercise" });
    }

    const trace = createTrace("sql", mode.get(), bus);
    trace.emit({
      stepId: "request.received",
      source: "api",
      kind: "request.received",
      observation: SQL_LESSON.request.observation,
      explanation: SQL_LESSON.request.explanation,
      data: { email: request.body.email, password: request.body.password }
    });

    const execution = trace.mode === "vulnerable"
      ? vulnerableLogin(database.connection, request.body.email, request.body.password)
      : safeLogin(database.connection, request.body.email, request.body.password);
    const queryLesson = SQL_LESSON.query[trace.mode];
    trace.emit({
      stepId: "query.constructed",
      source: "database",
      kind: "query.constructed",
      observation: queryLesson.observation,
      explanation: queryLesson.explanation,
      data: { query: execution.queryDisplay }
    });
    trace.emit({
      stepId: "query.executed",
      source: "database",
      kind: "query.executed",
      observation: SQL_LESSON.executed.observation,
      explanation: SQL_LESSON.executed.explanation,
      result: `${execution.rows.length} row(s)`,
      data: { rowCount: execution.rows.length }
    });

    const user = execution.rows[0] ?? null;
    const outcome: ExerciseOutcome = isAttackLogin(request.body)
      ? user === null ? "blocked" : "exploited"
      : "expected";
    const decision = authDecision(trace.mode, outcome);
    trace.emit({
      stepId: "auth.decision",
      source: "auth",
      kind: "auth.decision",
      observation: decision.observation,
      explanation: decision.explanation,
      result: outcome,
      data: { authenticated: user !== null, userId: user?.id ?? null }
    });

    const status = outcome === "blocked" ? 401 : 200;
    const result: ExerciseResult<{ authenticated: boolean; user: LoginRow | null }> = {
      traceId: trace.traceId,
      outcome,
      status,
      body: { authenticated: user !== null, user }
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
