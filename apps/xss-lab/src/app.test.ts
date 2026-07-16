import { FIXED_EXERCISES } from "@local-lab/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createXssLab } from "./app.js";

export const NORMAL_COMMENT = FIXED_EXERCISES.xss.normal;
export const ATTACK_COMMENT = FIXED_EXERCISES.xss.attack;

describe("stored XSS lab", () => {
  let lab: ReturnType<typeof createXssLab>;

  beforeEach(() => {
    lab = createXssLab();
  });

  afterEach(async () => {
    await lab.close();
  });

  it.each([
    ["vulnerable", NORMAL_COMMENT, "expected"],
    ["safe", NORMAL_COMMENT, "expected"],
    ["vulnerable", ATTACK_COMMENT, "exploited"],
    ["safe", ATTACK_COMMENT, "blocked"]
  ] as const)("stores the fixed %s comment in %s mode", async (mode, body, outcome) => {
    await lab.app.inject({ method: "PUT", url: "/mode", payload: { mode } });
    const response = await lab.app.inject({
      method: "POST",
      url: "/exercise/comment",
      payload: { body }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ outcome, body: { stored: true, comment: { body } } });
    expect(lab.bus.forTrace(response.json().traceId).map((event) => event.kind)).toEqual([
      "request.received",
      "comment.stored",
      "render.intent"
    ]);
  });

  it.each([
    ["vulnerable", "<img"],
    ["safe", "&lt;img"]
  ] as const)("renders the attack using %s output handling", async (mode, expectedSnippet) => {
    await lab.app.inject({ method: "PUT", url: "/mode", payload: { mode } });
    const comment = await lab.app.inject({
      method: "POST",
      url: "/exercise/comment",
      payload: { body: ATTACK_COMMENT }
    });
    const rendered = await lab.app.inject({
      method: "GET",
      url: `/render?traceId=${comment.json().traceId}`
    });

    expect(rendered.statusCode).toBe(200);
    expect(rendered.headers["content-type"]).toContain("text/html");
    expect(rendered.body).toContain("<!doctype html>");
    expect(rendered.body).toContain(expectedSnippet);
  });

  it("rejects content outside the fixed exercise set without creating a trace", async () => {
    const response = await lab.app.inject({
      method: "POST",
      url: "/exercise/comment",
      payload: { body: "<script>not an exercise</script>" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "comment is not an allowed exercise" });
    expect(lab.bus.recent()).toHaveLength(0);
  });

  it("rejects a comment request with extra fields", async () => {
    const response = await lab.app.inject({
      method: "POST",
      url: "/exercise/comment",
      payload: { body: NORMAL_COMMENT, script: "alert(1)" }
    });

    expect(response.statusCode).toBe(400);
    expect(lab.bus.recent()).toHaveLength(0);
  });

  it("only renders existing trace IDs and does not accept unrelated query keys", async () => {
    const comment = await lab.app.inject({
      method: "POST",
      url: "/exercise/comment",
      payload: { body: NORMAL_COMMENT }
    });

    const valid = await lab.app.inject({ method: "GET", url: `/render?traceId=${comment.json().traceId}` });
    const unknown = await lab.app.inject({
      method: "GET",
      url: "/render?traceId=00000000-0000-4000-8000-000000000001"
    });
    const extra = await lab.app.inject({
      method: "GET",
      url: `/render?traceId=${comment.json().traceId}&url=https://example.test`
    });

    expect(valid.statusCode).toBe(200);
    expect(unknown.statusCode).toBe(404);
    expect(extra.statusCode).toBe(400);
  });

  it("acknowledges only the fixed browser event for a stored trace", async () => {
    const comment = await lab.app.inject({
      method: "POST",
      url: "/exercise/comment",
      payload: { body: ATTACK_COMMENT }
    });
    const traceId = comment.json().traceId;
    const acknowledgement = await lab.app.inject({
      method: "POST",
      url: "/exercise/browser-event",
      payload: { type: "lab-xss", traceId }
    });
    const rejected = await lab.app.inject({
      method: "POST",
      url: "/exercise/browser-event",
      payload: { type: "lab-xss", traceId, url: "https://example.test" }
    });

    expect(acknowledgement.statusCode).toBe(200);
    expect(acknowledgement.json()).toEqual({ acknowledged: true });
    expect(lab.bus.forTrace(traceId).at(-1)?.kind).toBe("renderer.script-executed");
    expect(rejected.statusCode).toBe(400);
  });

  it("resets comments idempotently", async () => {
    await lab.app.inject({ method: "POST", url: "/exercise/comment", payload: { body: ATTACK_COMMENT } });
    await lab.app.inject({ method: "POST", url: "/reset" });
    await lab.app.inject({ method: "POST", url: "/reset" });
    const comment = await lab.app.inject({
      method: "POST",
      url: "/exercise/comment",
      payload: { body: NORMAL_COMMENT }
    });
    const rendered = await lab.app.inject({ method: "GET", url: `/render?traceId=${comment.json().traceId}` });

    expect(rendered.body).toContain(NORMAL_COMMENT);
    expect(rendered.body).not.toContain("<img");
  });

  it("returns exactly the two registered rendering sources", async () => {
    const source = await lab.app.inject({ method: "GET", url: "/source" });
    const rejected = await lab.app.inject({ method: "GET", url: "/source?path=../../etc/passwd" });

    expect(source.statusCode).toBe(200);
    expect(source.json()).toMatchObject({ labId: "xss" });
    expect(source.json().vulnerable).toContain("vulnerableRender");
    expect(source.json().safe).toContain("safeRender");
    expect(rejected.statusCode).toBe(400);
  });
});
