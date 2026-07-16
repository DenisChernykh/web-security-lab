import { FIXED_EXERCISES } from "@local-lab/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCsrfLab } from "./app.js";

type CsrfApp = ReturnType<typeof createCsrfLab>["app"];

async function login(app: CsrfApp): Promise<string> {
  const response = await app.inject({ method: "POST", url: "/exercise/login" });

  expect(response.statusCode).toBe(200);
  const setCookie = response.headers["set-cookie"];
  return Array.isArray(setCookie) ? setCookie[0]! : setCookie!;
}

async function submitEmailChange({
  app,
  mode,
  includeToken
}: {
  app: CsrfApp;
  mode: "vulnerable" | "safe";
  includeToken: boolean;
}) {
  await app.inject({ method: "PUT", url: "/mode", payload: { mode } });
  const cookie = await login(app);
  let token: string | undefined;

  if (includeToken) {
    const form = await app.inject({ method: "GET", url: "/exercise/form", headers: { cookie } });
    expect(form.statusCode).toBe(200);
    token = form.json().csrfToken;
  }

  const body = new URLSearchParams({
    email: FIXED_EXERCISES.csrf.attackEmail,
    ...(token === undefined ? {} : { csrfToken: token })
  }).toString();
  return app.inject({
    method: "POST",
    url: "/exercise/email",
    headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
    payload: body
  });
}

describe("CSRF victim lab", () => {
  let lab: ReturnType<typeof createCsrfLab>;

  beforeEach(() => {
    lab = createCsrfLab();
  });

  afterEach(async () => {
    await lab.close();
  });

  it("sets an HttpOnly Lax CSRF session cookie", async () => {
    const cookie = await login(lab.app);

    expect(cookie).toContain("csrf_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/api/csrf");
  });

  it.each([
    ["vulnerable", false, 200, "exploited"],
    ["safe", false, 403, "blocked"],
    ["safe", true, 200, "expected"]
  ] as const)("%s mode checks synchronizer token", async (mode, includeToken, status, outcome) => {
    const response = await submitEmailChange({ app: lab.app, mode, includeToken });

    expect(response.statusCode).toBe(status);
    expect(response.json().outcome).toBe(outcome);
    const events = lab.bus.forTrace(response.json().traceId);
    expect(events.map((event) => event.kind)).toEqual([
      "browser.origin-observed",
      "auth.session-cookie",
      "csrf.token-decision",
      "profile.email-mutated"
    ]);
    expect(events.find((event) => event.kind === "csrf.token-decision")?.data).toMatchObject({
      csrfToken: "[REDACTED]"
    });
  });

  it("rejects arbitrary email values and form fields without a trace", async () => {
    const cookie = await login(lab.app);
    const before = lab.bus.recent().length;
    const response = await lab.app.inject({
      method: "POST",
      url: "/exercise/email",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      payload: "email=not-an-exercise%40example.test&next=https%3A%2F%2Fevil.test"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "email change is not an allowed exercise" });
    expect(lab.bus.recent()).toHaveLength(before);
  });
});
