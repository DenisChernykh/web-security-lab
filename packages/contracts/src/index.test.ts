import { describe, expect, it } from "vitest";
import { FIXED_EXERCISES, LAB_IDS, REDACTED_KEYS, isLabMode } from "./index.js";

describe("lab contract", () => {
  it("keeps the public lab and mode allowlists closed", () => {
    expect(LAB_IDS).toEqual(["sql", "xss", "idor", "csrf"]);
    expect(isLabMode("vulnerable")).toBe(true);
    expect(isLabMode("safe")).toBe(true);
    expect(isLabMode("custom")).toBe(false);
  });

  it("defines every secret key that logs must redact", () => {
    expect(REDACTED_KEYS).toEqual([
      "authorization", "cookie", "csrfToken", "password", "session", "token"
    ]);
  });

  it("keeps every exercise input fixed and local", () => {
    expect(FIXED_EXERCISES.sql.attack.email).toBe("' OR 1=1 -- ");
    expect(FIXED_EXERCISES.xss.attack).toContain("parent.postMessage");
    expect(FIXED_EXERCISES.idor.documents).toEqual(["doc-alice", "doc-bob"]);
    expect(FIXED_EXERCISES.csrf.attackEmail).toBe("attacker-controlled@example.test");
  });
});
