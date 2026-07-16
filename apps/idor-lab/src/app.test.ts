import { FIXED_EXERCISES } from "@local-lab/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIdorLab } from "./app.js";

const [ALICE_DOCUMENT, BOB_DOCUMENT] = FIXED_EXERCISES.idor.documents;

async function loginAsAlice(app: ReturnType<typeof createIdorLab>["app"]): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/exercise/session",
    payload: { user: FIXED_EXERCISES.idor.user }
  });

  expect(response.statusCode).toBe(200);
  const setCookie = response.headers["set-cookie"];
  return Array.isArray(setCookie) ? setCookie[0]! : setCookie!;
}

async function setMode(app: ReturnType<typeof createIdorLab>["app"], mode: "vulnerable" | "safe"): Promise<void> {
  await app.inject({ method: "PUT", url: "/mode", payload: { mode } });
}

describe("IDOR lab", () => {
  let lab: ReturnType<typeof createIdorLab>;

  beforeEach(() => {
    lab = createIdorLab();
  });

  afterEach(async () => {
    await lab.close();
  });

  it.each([
    ["vulnerable", ALICE_DOCUMENT, 200, "expected"],
    ["safe", ALICE_DOCUMENT, 200, "expected"],
    ["vulnerable", BOB_DOCUMENT, 200, "exploited"],
    ["safe", BOB_DOCUMENT, 404, "blocked"]
  ] as const)("%s access to %s", async (mode, documentId, status, outcome) => {
    const cookie = await loginAsAlice(lab.app);
    await setMode(lab.app, mode);
    const response = await lab.app.inject({
      method: "GET",
      url: `/exercise/documents/${documentId}`,
      headers: { cookie }
    });

    expect(response.statusCode).toBe(status);
    expect(response.json().outcome).toBe(outcome);
    expect(lab.bus.forTrace(response.json().traceId).map((event) => event.kind)).toContain("auth.session-accepted");
    expect(lab.bus.forTrace(response.json().traceId).map((event) => event.kind)).toContain("authorization.owner-check");
  });

  it("rejects a missing session without creating a trace", async () => {
    const response = await lab.app.inject({ method: "GET", url: `/exercise/documents/${ALICE_DOCUMENT}` });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "session is required" });
    expect(lab.bus.recent()).toHaveLength(0);
  });

  it("accepts only Alice's fixed session and sets the scoped secure cookie attributes", async () => {
    const accepted = await lab.app.inject({
      method: "POST",
      url: "/exercise/session",
      payload: { user: FIXED_EXERCISES.idor.user }
    });
    const rejected = await lab.app.inject({
      method: "POST",
      url: "/exercise/session",
      payload: { user: "bob" }
    });

    expect(accepted.statusCode).toBe(200);
    expect(accepted.headers["set-cookie"]).toEqual(expect.stringContaining("HttpOnly"));
    expect(accepted.headers["set-cookie"]).toEqual(expect.stringContaining("SameSite=Lax"));
    expect(accepted.headers["set-cookie"]).toEqual(expect.stringContaining("Path=/api/idor"));
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toEqual({ error: "session is not an allowed exercise" });
  });

  it("rejects every document outside the fixed allowlist without creating a trace", async () => {
    const cookie = await loginAsAlice(lab.app);
    const eventsBeforeRequest = lab.bus.recent().length;
    const response = await lab.app.inject({
      method: "GET",
      url: "/exercise/documents/not-an-exercise",
      headers: { cookie }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "document is not an allowed exercise" });
    expect(lab.bus.recent()).toHaveLength(eventsBeforeRequest);
  });

  it("resets the fixed seed state idempotently", async () => {
    await lab.app.inject({ method: "POST", url: "/reset" });
    await lab.app.inject({ method: "POST", url: "/reset" });
    const cookie = await loginAsAlice(lab.app);
    const response = await lab.app.inject({
      method: "GET",
      url: `/exercise/documents/${ALICE_DOCUMENT}`,
      headers: { cookie }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().body.document).toMatchObject({
      id: ALICE_DOCUMENT,
      owner_id: FIXED_EXERCISES.idor.user
    });
  });

  it("returns exactly the two registered read-handler sources", async () => {
    const source = await lab.app.inject({ method: "GET", url: "/source" });
    const rejected = await lab.app.inject({ method: "GET", url: "/source?path=../../etc/passwd" });

    expect(source.statusCode).toBe(200);
    expect(source.json()).toMatchObject({ labId: "idor" });
    expect(source.json().vulnerable).toContain("function vulnerableRead");
    expect(source.json().safe).toContain("function safeRead");
    expect(rejected.statusCode).toBe(400);
  });
});
