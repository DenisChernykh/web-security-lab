import { describe, expect, it } from "vitest";
import { createCsrfAttacker } from "./app.js";

describe("CSRF attacker origin", () => {
  it("serves a fixed cross-origin form that cannot inspect the victim response", async () => {
    const attacker = createCsrfAttacker();
    try {
      const response = await attacker.inject({ method: "GET", url: "/" });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/html");
      expect(response.body).toContain('data-victim-port="8080"');
      expect(response.body).toContain('location.hostname');
      expect(response.body).toContain('name="email" value="attacker-controlled@example.test"');
      expect(response.body).not.toContain('name="csrfToken"');
      expect(response.body).not.toMatch(/\bfetch\s*\(|\bXMLHttpRequest\b/);
    } finally {
      await attacker.close();
    }
  });

  it("reports a fixed health response", async () => {
    const attacker = createCsrfAttacker();
    try {
      const response = await attacker.inject({ method: "GET", url: "/health" });
      expect(response.json()).toEqual({ status: "ok", service: "csrf-attacker" });
    } finally {
      await attacker.close();
    }
  });

  it("can use a configured numeric victim port without accepting a target URL", async () => {
    const attacker = createCsrfAttacker({ victimPort: 18080 });
    try {
      const response = await attacker.inject({ method: "GET", url: "/" });
      expect(response.body).toContain('data-victim-port="18080"');
    } finally {
      await attacker.close();
    }
  });
});
