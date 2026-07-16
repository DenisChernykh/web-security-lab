import { describe, expect, it } from "vitest";
import { createSqlLab } from "../../apps/sql-lab/src/app.js";
import { createXssLab } from "../../apps/xss-lab/src/app.js";
import { createIdorLab } from "../../apps/idor-lab/src/app.js";
import { createCsrfLab } from "../../apps/csrf-lab/src/app.js";

const labs = [
  ["sql", createSqlLab], ["xss", createXssLab], ["idor", createIdorLab], ["csrf", createCsrfLab]
] as const;

describe.each(labs)("%s shared HTTP contract", (labId, factory) => {
  it("supports health, closed modes, reset and allowlisted source", async () => {
    const lab = factory();
    try {
      expect((await lab.app.inject({ method: "GET", url: "/health" })).json()).toEqual({ status: "ok", labId });
      expect((await lab.app.inject({ method: "PUT", url: "/mode", payload: { mode: "safe" } })).json()).toEqual({ mode: "safe" });
      expect((await lab.app.inject({ method: "GET", url: "/mode" })).json()).toEqual({ mode: "safe" });
      expect((await lab.app.inject({ method: "PUT", url: "/mode", payload: { mode: "custom" } })).statusCode).toBe(400);
      const firstReset = (await lab.app.inject({ method: "POST", url: "/reset" })).json();
      const secondReset = (await lab.app.inject({ method: "POST", url: "/reset" })).json();
      expect(firstReset.reset).toBe(true);
      expect(firstReset.seed).toEqual(secondReset.seed);
      const source = (await lab.app.inject({ method: "GET", url: "/source" })).json();
      expect(source.labId).toBe(labId);
      expect(source.vulnerable.length).toBeGreaterThan(20);
      expect(source.safe.length).toBeGreaterThan(20);
      const traversal = await lab.app.inject({ method: "GET", url: "/source?path=/etc/passwd" });
      expect(traversal.statusCode).toBe(400);
      expect(traversal.body).not.toContain("root:");
    } finally {
      await lab.close();
    }
  });

  it("redacts secret event data before it reaches history", async () => {
    const lab = factory();
    try {
      const event = lab.bus.publish({
        traceId: "trace-contract", labId, mode: "vulnerable", stepId: "contract",
        source: "api", kind: "contract", observation: "redaction", explanation: "redaction",
        data: { password: "secret", token: "secret" }
      });
      expect(event.data).toEqual({ password: "[REDACTED]", token: "[REDACTED]" });
    } finally {
      await lab.close();
    }
  });
});
