import { expect, test } from "@playwright/test";

const victim = "http://localhost:18080";
const attacker = "http://localhost:18081";

async function victimCommand(page: import("@playwright/test").Page, path: string, init?: RequestInit) {
  await page.goto(victim);
  return page.evaluate(async ({ path, init }) => {
    const response = await fetch(path, init);
    return { status: response.status, body: await response.json() };
  }, { path, init });
}

async function submitAttackerForm(page: import("@playwright/test").Page) {
  await page.goto(attacker);
  await page.getByRole("button", { name: "Отправить межсайтовый запрос" }).click();
  await expect.poll(() => page.frames().find((frame) => frame.name() === "csrf-result")?.url()).toContain("localhost:18080");
  expect(await page.locator("iframe").evaluate((frame) => {
    try { return Boolean((frame as HTMLIFrameElement).contentDocument?.body); } catch { return false; }
  })).toBe(false);
}

test("cross-origin form mutates vulnerable profile but synchronizer token blocks it", async ({ page }) => {
  await victimCommand(page, "/api/csrf/reset", { method: "POST" });
  await victimCommand(page, "/api/csrf/exercise/login", { method: "POST" });
  await victimCommand(page, "/api/csrf/mode", {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "vulnerable" })
  });
  await submitAttackerForm(page);
  const exploited = await victimCommand(page, "/api/csrf/exercise/profile");
  expect(exploited.body.profile.email).toBe("attacker-controlled@example.test");

  await victimCommand(page, "/api/csrf/reset", { method: "POST" });
  await victimCommand(page, "/api/csrf/exercise/login", { method: "POST" });
  await victimCommand(page, "/api/csrf/mode", {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "safe" })
  });
  await submitAttackerForm(page);
  const blocked = await victimCommand(page, "/api/csrf/exercise/profile");
  expect(blocked.body.profile.email).not.toBe("attacker-controlled@example.test");
});
