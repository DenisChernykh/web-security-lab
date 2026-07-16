import { defineConfig, devices } from "@playwright/test";

const gatewayPort = process.env.LAB_GATEWAY_HOST_PORT ?? "18080";
const attackerPort = process.env.LAB_ATTACKER_HOST_PORT ?? "18081";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  // Every journey deliberately changes the same four local lab instances.
  workers: 1,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: `http://127.0.0.1:${gatewayPort}`, trace: "on-first-retry", screenshot: "only-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "narrow", use: { ...devices["Desktop Chrome"], viewport: { width: 760, height: 900 } } }
  ],
  webServer: process.env.PW_SKIP_WEBSERVER ? undefined : {
    command: `LAB_GATEWAY_HOST_PORT=${gatewayPort} LAB_ATTACKER_HOST_PORT=${attackerPort} docker compose up --build`,
    url: `http://127.0.0.1:${gatewayPort}/healthz`, timeout: 240_000, reuseExistingServer: !process.env.CI
  }
});
