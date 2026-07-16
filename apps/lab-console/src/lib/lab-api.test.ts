import { afterEach, describe, expect, it, vi } from "vitest";
import { getHealth } from "./lab-api.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("finite lab requests", () => {
  it("keeps the eight-second timeout when health also has an unmount signal", async () => {
    const timeout = new AbortController();
    const unmount = new AbortController();
    let requestSignal: AbortSignal | undefined;
    vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
      expect(milliseconds).toBe(8_000);
      return timeout.signal;
    });
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return Response.json({ status: "ok", labId: "sql" });
    }));

    await expect(getHealth("sql", unmount.signal)).resolves.toEqual({ status: "ok", labId: "sql" });
    expect(requestSignal).not.toBe(unmount.signal);
    timeout.abort(new DOMException("Timed out", "TimeoutError"));
    expect(requestSignal?.aborted).toBe(true);
  });
});
