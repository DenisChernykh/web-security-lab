import { expect, test } from "@playwright/test";

const victim = `http://localhost:${process.env.LAB_GATEWAY_HOST_PORT ?? "18080"}`;
const attacker = `http://localhost:${process.env.LAB_ATTACKER_HOST_PORT ?? "18081"}`;

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
  await expect.poll(() => page.frames().find((frame) => frame.name() === "csrf-result")?.url())
    .toContain(`localhost:${process.env.LAB_GATEWAY_HOST_PORT ?? "18080"}`);
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

test("console completes normal, vulnerable and protected CSRF journeys", async ({ page, request }) => {
  await request.post("/api/csrf/reset");
  await request.put("/api/csrf/mode", { data: { mode: "vulnerable" } });
  await page.goto("/");
  await page.getByRole("button", { name: "CSRF" }).click();
  await expect(page.getByText("Локальная лаборатория готова")).toBeVisible();

  await page.getByRole("button", { name: "Отправить легитимную форму с токеном" }).click();
  await expect(page.locator(".response-panel > p").filter({ hasText: "Результат:" }).getByText("Ожидаемый результат")).toBeVisible();

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Открыть межсайтовую атаку" }).click();
  const popup = await popupPromise;
  await popup.waitForURL(new RegExp(`^http://127\\.0\\.0\\.1:${process.env.LAB_ATTACKER_HOST_PORT ?? "18081"}/`));
  await popup.getByRole("button", { name: "Отправить межсайтовый запрос" }).click();
  await expect.poll(() => popup.frames().find((frame) => frame.name() === "csrf-result")?.url()).toContain("127.0.0.1");
  expect(await popup.locator("iframe").evaluate((frame) => {
    try { return Boolean((frame as HTMLIFrameElement).contentDocument?.body); } catch { return false; }
  })).toBe(false);

  await page.getByRole("button", { name: "Проверить профиль после атаки" }).click();
  await expect(page.locator(".csrf-surface > p").filter({ hasText: "Текущий email:" }).getByText("attacker-controlled@example.test", { exact: true })).toBeVisible();
  await expect(page.locator(".response-panel > p").filter({ hasText: "Результат:" }).getByText("Атака сработала")).toBeVisible();
  await page.getByRole("tab", { name: "Логи" }).click();
  await expect(page.getByText("Браузер отправил запрос к локальному сайту-жертве.")).toBeVisible();
  await expect(page.getByText("Сервер изменяет профиль без проверки synchronizer token.")).toBeVisible();
  await popup.close();

  await page.getByRole("button", { name: "Защищённая" }).click();
  const safePopupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Открыть межсайтовую атаку" }).click();
  const safePopup = await safePopupPromise;
  await safePopup.waitForURL(new RegExp(`^http://127\\.0\\.0\\.1:${process.env.LAB_ATTACKER_HOST_PORT ?? "18081"}/`));
  await safePopup.getByRole("button", { name: "Отправить межсайтовый запрос" }).click();
  await expect.poll(() => safePopup.frames().find((frame) => frame.name() === "csrf-result")?.url()).toContain("127.0.0.1");
  await page.getByRole("button", { name: "Проверить профиль после атаки" }).click();
  await page.getByRole("tab", { name: "Ответ" }).click();
  await expect(page.locator(".response-panel > p").filter({ hasText: "Результат:" }).getByText("Защита сработала")).toBeVisible();
  await expect(page.locator(".response-panel")).toContainText('"changed": false');
  await expect(page.getByText(/Сравнение одного атакующего запроса: уязвимый/)).toBeVisible();
  await expect(page.locator(".csrf-surface > p").filter({ hasText: "Текущий email:" }).getByText("attacker-controlled@example.test", { exact: true })).toBeVisible();
  await safePopup.close();

  await page.getByRole("button", { name: "Сбросить лабораторию" }).click();
  await expect(page.locator(".csrf-surface > p").filter({ hasText: "Текущий email:" })).toHaveCount(0);

  const staleResultPopupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Открыть межсайтовую атаку" }).click();
  const staleResultPopup = await staleResultPopupPromise;
  await staleResultPopup.waitForURL(new RegExp(`^http://127\\.0\\.0\\.1:${process.env.LAB_ATTACKER_HOST_PORT ?? "18081"}/`));
  await staleResultPopup.getByRole("button", { name: "Отправить межсайтовый запрос" }).click();
  await expect.poll(() => staleResultPopup.frames().find((frame) => frame.name() === "csrf-result")?.url()).toContain("127.0.0.1");
  await page.getByRole("button", { name: "Проверить профиль после атаки" }).click();
  await expect(page.locator(".response-panel > p").filter({ hasText: "Результат:" }).getByText("Защита сработала")).toBeVisible();
  await staleResultPopup.close();

  await page.reload();
  await page.getByRole("button", { name: "CSRF" }).click();
  await expect(page.getByText("Локальная лаборатория готова")).toBeVisible();
  const noSubmitPopupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Открыть межсайтовую атаку" }).click();
  const noSubmitPopup = await noSubmitPopupPromise;
  await noSubmitPopup.waitForURL(new RegExp(`^http://127\\.0\\.0\\.1:${process.env.LAB_ATTACKER_HOST_PORT ?? "18081"}/`));
  await page.getByRole("button", { name: "Проверить профиль после атаки" }).click();
  await expect(page.getByText("Сначала отправьте фиксированную форму в окне атакующего.")).toBeVisible();
  await expect(page.locator(".response-panel")).toHaveCount(0);
  await noSubmitPopup.close();
});
