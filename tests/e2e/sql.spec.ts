import { expect, test } from "@playwright/test";

test("SQL attack is exploited then blocked by parameterization", async ({ page, request }) => {
  await request.post("/api/sql/reset");
  await request.put("/api/sql/mode", { data: { mode: "vulnerable" } });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "SQL Injection" })).toBeVisible();
  await expect(page.getByText("Локальная лаборатория готова")).toBeVisible();

  await page.getByRole("button", { name: "Нормальный запрос" }).click();
  await page.getByRole("button", { name: "Запустить локально" }).click();
  await expect(page.locator(".response-panel > p").filter({ hasText: "Результат:" }).getByText("Ожидаемый результат")).toBeVisible();

  await page.getByRole("button", { name: "Локальная атака" }).click();
  await page.getByRole("button", { name: "Запустить локально" }).click();
  await expect(page.locator(".response-panel > p").filter({ hasText: "Результат:" }).getByText("Атака сработала")).toBeVisible();
  await page.getByRole("tab", { name: "Логи" }).click();
  await expect(page.getByText("Пользовательский ввод склеен с SQL-командой.")).toBeVisible();

  await page.getByRole("button", { name: "Защищённая" }).click();
  await page.getByRole("button", { name: "Запустить локально" }).click();
  await page.getByRole("tab", { name: "Ответ" }).click();
  await expect(page.locator(".response-panel > p").filter({ hasText: "Результат:" }).getByText("Защита сработала")).toBeVisible();
  await expect(page.getByText(/Сравнение одного атакующего запроса: уязвимый/)).toBeVisible();
  await page.getByRole("tab", { name: "Diff" }).click();
  await expect(page.getByRole("heading", { name: "Уязвимая" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Защищённая" })).toBeVisible();
});
