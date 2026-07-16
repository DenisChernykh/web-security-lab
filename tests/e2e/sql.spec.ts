import { expect, test } from "@playwright/test";

test("SQL attack is exploited then blocked by parameterization", async ({ page, request }) => {
  await request.post("/api/sql/reset");
  await request.put("/api/sql/mode", { data: { mode: "vulnerable" } });
  const vulnerable = await request.post("/api/sql/exercise/login", { data: { email: "' OR 1=1 -- ", password: "demo" } });
  expect((await vulnerable.json()).outcome).toBe("exploited");
  await request.put("/api/sql/mode", { data: { mode: "safe" } });
  const safe = await request.post("/api/sql/exercise/login", { data: { email: "' OR 1=1 -- ", password: "demo" } });
  expect((await safe.json()).outcome).toBe("blocked");
  expect((await (await request.get("/api/sql/source")).json()).safe).toContain("?");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "SQL Injection" })).toBeVisible();
  await expect(page.getByText("Локальная лаборатория готова")).toBeVisible();
  await page.getByRole("button", { name: "Уязвимая" }).click();
  await page.getByRole("button", { name: "Запустить локально" }).click();
  await expect(page.getByText("Атака сработала")).toBeVisible();
  await page.getByRole("button", { name: "Защищённая" }).click();
  await page.getByRole("button", { name: "Запустить локально" }).click();
  await expect(page.locator(".response-panel > p").filter({ hasText: "Результат:" }).getByText("Защита сработала")).toBeVisible();
  await expect(page.getByText(/Сравнение: уязвимый/)).toBeVisible();
  await page.getByRole("tab", { name: "Diff" }).click();
  await expect(page.getByRole("heading", { name: "Уязвимая" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Защищённая" })).toBeVisible();
});
