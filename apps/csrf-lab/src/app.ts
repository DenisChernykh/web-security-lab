import cookie from "@fastify/cookie";
import { FIXED_EXERCISES, type ExerciseOutcome, type ExerciseResult } from "@local-lab/contracts";
import {
  EventBus,
  ModeStore,
  createSourceReader,
  createTrace,
  redact,
  registerCommonRoutes
} from "@local-lab/lab-core";
import Fastify from "fastify";
import { CsrfLabDatabase, type CsrfProfile } from "./database.js";
import { safeChangeEmail } from "./handlers/safe.js";
import { vulnerableChangeEmail } from "./handlers/vulnerable.js";
import { CSRF_LESSON } from "./lesson.js";

export interface CreateCsrfLabOptions {
  attackerPort?: number;
}

interface EmailChangeRequest {
  email: CsrfProfile["email"];
  csrfToken?: string;
}

const SESSION_COOKIE = "csrf_session";
const SESSION_VALUE = "local-csrf-session";
const VICTIM_ORIGIN = "http://localhost:8080";
const ALLOWED_EMAILS = new Set<CsrfProfile["email"]>([
  FIXED_EXERCISES.csrf.normalEmail,
  FIXED_EXERCISES.csrf.attackEmail
]);

const hasNoQuery = (query: unknown): boolean =>
  query !== null && typeof query === "object" && !Array.isArray(query) && Object.keys(query).length === 0;

const parseEmailChange = (value: unknown): EmailChangeRequest | undefined => {
  if (!(value instanceof URLSearchParams)) return undefined;

  const keys = [...value.keys()];
  if (!keys.every((key) => key === "email" || key === "csrfToken") ||
    keys.filter((key) => key === "email").length !== 1 ||
    keys.filter((key) => key === "csrfToken").length > 1) {
    return undefined;
  }

  const email = value.get("email");
  const csrfToken = value.get("csrfToken");
  if (email === null || !ALLOWED_EMAILS.has(email as EmailChangeRequest["email"]) || csrfToken === "") {
    return undefined;
  }

  return csrfToken === null
    ? { email: email as EmailChangeRequest["email"] }
    : { email: email as EmailChangeRequest["email"], csrfToken };
};

const eventData = (value: Record<string, unknown>): Record<string, unknown> =>
  redact(value) as Record<string, unknown>;

export function createCsrfLab({ attackerPort = 8081 }: CreateCsrfLabOptions = {}) {
  const app = Fastify();
  const attackerOrigin = `http://localhost:${attackerPort}`;
  const bus = new EventBus();
  const mode = new ModeStore();
  const database = new CsrfLabDatabase();

  void app.register(cookie);
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
    done(null, new URLSearchParams(body.toString()));
  });
  void registerCommonRoutes(app, {
    labId: "csrf",
    mode,
    events: bus,
    reset: () => database.reset(),
    readSource: createSourceReader(
      "csrf",
      new URL("./handlers/vulnerable.ts", import.meta.url),
      new URL("./handlers/safe.ts", import.meta.url)
    )
  });

  app.post("/exercise/login", async (request, reply) => {
    if (!hasNoQuery(request.query) || request.body !== undefined) {
      return reply.code(400).send({ error: "login does not accept request data" });
    }

    reply.setCookie(SESSION_COOKIE, SESSION_VALUE, {
      httpOnly: true,
      sameSite: "lax",
      path: "/api/csrf"
    });
    return { session: "accepted" };
  });

  app.get("/exercise/profile", async (request, reply) => {
    if (!hasNoQuery(request.query)) return reply.code(400).send({ error: "profile query parameters are not allowed" });
    if (request.cookies[SESSION_COOKIE] !== SESSION_VALUE) return reply.code(401).send({ error: "session is required" });
    return { profile: database.profile() };
  });

  app.get("/exercise/form", async (request, reply) => {
    if (!hasNoQuery(request.query)) return reply.code(400).send({ error: "form query parameters are not allowed" });
    if (request.cookies[SESSION_COOKIE] !== SESSION_VALUE) return reply.code(401).send({ error: "session is required" });
    return { csrfToken: database.session().csrfToken };
  });

  app.post("/exercise/email", async (request, reply) => {
    if (!hasNoQuery(request.query)) return reply.code(400).send({ error: "email query parameters are not allowed" });
    if (request.cookies[SESSION_COOKIE] !== SESSION_VALUE) return reply.code(401).send({ error: "session is required" });
    const change = parseEmailChange(request.body);
    if (change === undefined) return reply.code(400).send({ error: "email change is not an allowed exercise" });

    const trace = createTrace("csrf", mode.get(), bus);
    const origin = request.headers.origin === attackerOrigin ? "attacker" : "victim";
    trace.emit({
      stepId: "browser.origin-observed",
      source: "browser",
      kind: "browser.origin-observed",
      observation: CSRF_LESSON.origin.observation,
      explanation: CSRF_LESSON.origin.explanation,
      data: { origin }
    });
    trace.emit({
      stepId: "auth.session-cookie",
      source: "auth",
      kind: "auth.session-cookie",
      observation: CSRF_LESSON.session.observation,
      explanation: CSRF_LESSON.session.explanation,
      data: eventData({ session: "accepted", userId: database.session().userId })
    });
    const accepted = trace.mode === "vulnerable"
      ? vulnerableChangeEmail(database.session().csrfToken, change.csrfToken)
      : safeChangeEmail(database.session().csrfToken, change.csrfToken);
    const outcome: ExerciseOutcome = accepted ? (trace.mode === "vulnerable" ? "exploited" : "expected") : "blocked";
    const tokenLesson = CSRF_LESSON.token[trace.mode];
    trace.emit({
      stepId: "csrf.token-decision",
      source: "auth",
      kind: "csrf.token-decision",
      observation: tokenLesson.observation,
      explanation: tokenLesson.explanation,
      result: outcome,
      data: eventData({ csrfToken: change.csrfToken, tokenAccepted: accepted })
    });
    const profile = accepted ? database.changeEmail(change.email) : database.profile();
    trace.emit({
      stepId: "profile.email-mutated",
      source: "database",
      kind: "profile.email-mutated",
      observation: CSRF_LESSON.mutation.observation,
      explanation: CSRF_LESSON.mutation.explanation,
      result: outcome,
      data: eventData({ email: profile.email, mutated: accepted })
    });

    const status = accepted ? 200 : 403;
    const result: ExerciseResult<{ profile: Readonly<CsrfProfile>; changed: boolean }> = {
      traceId: trace.traceId,
      outcome,
      status,
      body: { profile, changed: accepted }
    };
    return reply.code(status).send(result);
  });

  return {
    app,
    bus,
    async close(): Promise<void> {
      await app.close();
    }
  };
}

export { VICTIM_ORIGIN };
