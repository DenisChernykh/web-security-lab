import { expect, test } from "@playwright/test";

test("Alice cannot read Bob document after owner scoping", async ({ request, page }) => {
  await request.post("/api/idor/reset");
  await request.post("/api/idor/exercise/session", { data: { user: "alice" } });
  await request.put("/api/idor/mode", { data: { mode: "vulnerable" } });
  expect((await (await request.get("/api/idor/exercise/documents/doc-bob")).json()).outcome).toBe("exploited");
  await request.put("/api/idor/mode", { data: { mode: "safe" } });
  const safe = await request.get("/api/idor/exercise/documents/doc-bob");
  expect(safe.status()).toBe(404);
  expect((await safe.json()).outcome).toBe("blocked");

  await request.put("/api/idor/mode", { data: { mode: "safe" } });
  await page.goto("/");
  await page.getByRole("button", { name: "IDOR" }).click();
  await expect(page.getByRole("button", { name: "Защищённая" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Запустить локально" }).click();
  await expect(page.getByText("Защита сработала")).toBeVisible();
  await page.getByRole("tab", { name: "Логи" }).click();
  await expect(page.getByText("Фиксированная учебная сессия Алисы принята.")).toBeVisible();
  await expect(page.getByText("Документ выбран по идентификатору и владельцу.")).toBeVisible();
});
