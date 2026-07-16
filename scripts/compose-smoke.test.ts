import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const smokeScript = new URL("./compose-smoke.mjs", import.meta.url).href;

function runSmokeWithFetchGuard(port: string) {
  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `globalThis.fetch = (url) => {
        process.stderr.write(\`FETCH_GUARD:\${url}\\n\`);
        throw new Error("fetch must not be called");
      };
      await import(${JSON.stringify(smokeScript)});`
    ],
    {
      env: { ...process.env, LAB_GATEWAY_HOST_PORT: port },
      encoding: "utf8"
    }
  );
}

describe("compose smoke gateway port", () => {
  it("rejects a host-bearing gateway port before issuing a fetch", () => {
    const result = runSmokeWithFetchGuard("18080@example.test");
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toMatch(/LAB_GATEWAY_HOST_PORT.*integer.*1.*65535/i);
    expect(output).not.toContain("FETCH_GUARD:");
  });
});
