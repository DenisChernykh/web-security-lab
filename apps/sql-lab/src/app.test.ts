import { FIXED_EXERCISES } from "@local-lab/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqlLab } from "./app.js";

const NORMAL_LOGIN = FIXED_EXERCISES.sql.normal;
const ATTACK_LOGIN = FIXED_EXERCISES.sql.attack;

describe("SQL injection lab", () => {
  let lab: ReturnType<typeof createSqlLab>;

  beforeEach(() => {
    lab = createSqlLab();
  });

  afterEach(async () => {
    await lab.close();
  });

  it.each([
    ["vulnerable", NORMAL_LOGIN, "expected", 200],
    ["safe", NORMAL_LOGIN, "expected", 200],
    ["vulnerable", ATTACK_LOGIN, "exploited", 200],
    ["safe", ATTACK_LOGIN, "blocked", 401]
  ] as const)("mode %s handles the fixed request", async (mode, payload, outcome, status) => {
    await lab.app.inject({ method: "PUT", url: "/mode", payload: { mode } });
    const response = await lab.app.inject({
      method: "POST",
      url: "/exercise/login",
      payload
    });

    expect(response.statusCode).toBe(status);
    expect(response.json().outcome).toBe(outcome);
    expect(lab.bus.forTrace(response.json().traceId).length).toBeGreaterThanOrEqual(4);
  });

  it("rejects an arbitrary login without executing a trace", async () => {
    const response = await lab.app.inject({
      method: "POST",
      url: "/exercise/login",
      payload: { email: "not-an-exercise@example.test", password: "anything" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "login request is not an allowed exercise" });
    expect(lab.bus.recent()).toHaveLength(0);
  });

  it("resets the SQLite seed state idempotently", async () => {
    await lab.app.inject({ method: "POST", url: "/reset" });
    await lab.app.inject({ method: "POST", url: "/reset" });
    const response = await lab.app.inject({
      method: "POST",
      url: "/exercise/login",
      payload: NORMAL_LOGIN
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().body).toEqual({
      authenticated: true,
      user: { id: 1, email: "alice@example.test", display_name: "Alice" }
    });
  });

  it("returns only the two registered handler sources", async () => {
    const source = await lab.app.inject({ method: "GET", url: "/source" });
    const rejected = await lab.app.inject({ method: "GET", url: "/source?path=../../etc/passwd" });

    expect(source.statusCode).toBe(200);
    expect(source.json()).toMatchObject({ labId: "sql" });
    expect(source.json().vulnerable).toContain("function vulnerableLogin");
    expect(source.json().safe).toContain("function safeLogin");
    expect(rejected.statusCode).toBe(400);
  });
});
