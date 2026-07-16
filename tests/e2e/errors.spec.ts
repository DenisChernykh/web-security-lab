import { expect, test } from "@playwright/test";

test("health failure is explicit", async ({ page }) => {
  await page.route("**/api/sql/health", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByText("Локальная лаборатория недоступна")).toBeVisible();
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
