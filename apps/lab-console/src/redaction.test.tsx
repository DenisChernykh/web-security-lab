import { redact } from "@local-lab/lab-core/redact";
import { describe, expect, it } from "vitest";

describe("console event redaction", () => {
  it("uses the shared redaction boundary for event data", () => {
    expect(redact({ email: "alice@example.test", nested: { password: "secret" } })).toEqual({
      email: "alice@example.test",
      nested: { password: "[REDACTED]" }
    });
  });
});
