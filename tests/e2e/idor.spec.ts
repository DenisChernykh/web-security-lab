import { expect, test } from "@playwright/test";

test("Alice cannot read Bob document after owner scoping", async ({ request, page }) => {
  await request.post("/api/idor/reset");
  await request.put("/api/idor/mode", { data: { mode: "vulnerable" } });
  await page.goto("/");
  await page.getByRole("button", { name: "IDOR" }).click();
  await expect(page.getByText("Локальная лаборатория готова")).toBeVisible();

  await page.getByRole("button", { name: "Нормальный запрос" }).click();
  await page.getByRole("button", { name: "Запустить локально" }).click();
  await expect(page.locator(".response-panel > p").filter({ hasText: "Результат:" }).getByText("Ожидаемый результат")).toBeVisible();

  await page.getByRole("button", { name: "Локальная атака" }).click();
  await page.getByRole("button", { name: "Запустить локально" }).click();
  await expect(page.locator(".response-panel > p").filter({ hasText: "Результат:" }).getByText("Атака сработала")).toBeVisible();
  await page.getByRole("tab", { name: "Логи" }).click();
  await expect(page.getByText("Фиксированная учебная сессия Алисы принята.")).toBeVisible();
  await expect(page.getByText("Документ выбран только по идентификатору.")).toBeVisible();

  await page.getByRole("button", { name: "Защищённая" }).click();
  await page.getByRole("button", { name: "Запустить локально" }).click();
  await page.getByRole("tab", { name: "Ответ" }).click();
  await expect(page.locator(".response-panel > p").filter({ hasText: "Результат:" }).getByText("Защита сработала")).toBeVisible();
  await page.getByRole("tab", { name: "Логи" }).click();
  await expect(page.getByText("Фиксированная учебная сессия Алисы принята.")).toBeVisible();
  await expect(page.getByText("Документ выбран по идентификатору и владельцу.")).toBeVisible();
  await page.getByRole("tab", { name: "Ответ" }).click();
  await expect(page.getByText(/Сравнение одного атакующего запроса: уязвимый/)).toBeVisible();
});
