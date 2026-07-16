import { expect, test } from "@playwright/test";
import { FIXED_EXERCISES } from "@local-lab/contracts";

const attack = FIXED_EXERCISES.xss.attack;

test("stored XSS renders executable HTML only in vulnerable mode", async ({ request, page }) => {
  await request.post("/api/xss/reset");
  await request.put("/api/xss/mode", { data: { mode: "vulnerable" } });
  await page.goto("/");
  await page.getByRole("button", { name: "Stored XSS" }).click();
  await expect(page.getByText("Локальная лаборатория готова")).toBeVisible();

  await page.getByRole("button", { name: "Нормальный запрос" }).click();
  await page.getByRole("button", { name: "Запустить локально" }).click();
  await expect(page.locator(".response-panel > p").filter({ hasText: "Результат:" }).getByText("Ожидаемый результат")).toBeVisible();

  await page.getByRole("button", { name: "Локальная атака" }).click();
  await page.getByRole("button", { name: "Запустить локально" }).click();
  await expect(page.locator(".response-panel > p").filter({ hasText: "Результат:" }).getByText("Атака сработала")).toBeVisible();
  await expect(page.getByTitle("Изолированный XSS-предпросмотр")).toBeVisible();
  await page.getByRole("tab", { name: "Логи" }).click();
  await expect(page.getByText("Песочница браузера подтвердила выполнение учебного обработчика.")).toBeVisible();

  await page.getByRole("button", { name: "Защищённая" }).click();
  await page.getByRole("button", { name: "Запустить локально" }).click();
  await expect(page.frameLocator('iframe[title="Изолированный XSS-предпросмотр"]').locator("body")).toContainText("<img src=\"x\"");
  await page.waitForTimeout(300);
  await page.getByRole("tab", { name: "Логи" }).click();
  await expect(page.getByText("Песочница браузера подтвердила выполнение учебного обработчика.")).toHaveCount(0);
  await page.getByRole("tab", { name: "Ответ" }).click();
  await expect(page.locator(".response-panel > p").filter({ hasText: "Результат:" }).getByText("Защита сработала")).toBeVisible();
  await expect(page.getByText(/Сравнение одного атакующего запроса: уязвимый/)).toBeVisible();
  await expect(page.getByText(attack)).toHaveCount(0);
});
