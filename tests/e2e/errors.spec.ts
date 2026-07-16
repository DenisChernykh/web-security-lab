import { expect, test } from "@playwright/test";

test("health failure is explicit", async ({ page }) => {
  await page.route("**/api/sql/health", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByText("Локальная лаборатория недоступна")).toBeVisible();
});

test("HTTP result survives an incomplete event stream", async ({ page, request }) => {
  await request.post("/api/sql/reset");
  await request.put("/api/sql/mode", { data: { mode: "vulnerable" } });
  await page.route("**/api/sql/events", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByText("Локальная лаборатория готова")).toBeVisible();
  await page.getByRole("button", { name: "Запустить локально" }).click();
  await expect(page.getByText("Ответ получен, поток логов прерван")).toBeVisible();
  await expect(page.getByText("Атака сработала")).toBeVisible();
});

test("narrow layout preserves nav, experiment and inspector order", async ({ page }) => {
  await page.goto("/");
  const tags = await page.locator(".workspace > *").evaluateAll((nodes) => nodes.map((node) => node.tagName));
  expect(tags).toEqual(["NAV", "MAIN", "ASIDE"]);
  await expect(page.locator(".scenario-nav")).toBeVisible();
  await expect(page.locator(".experiment")).toBeVisible();
  await page.locator(".inspector").scrollIntoViewIfNeeded();
  await expect(page.locator(".inspector")).toBeVisible();
});
