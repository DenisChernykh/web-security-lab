import { expect, test } from "@playwright/test";
import { FIXED_EXERCISES } from "@local-lab/contracts";

const attack = FIXED_EXERCISES.xss.attack;

test("stored XSS renders executable HTML only in vulnerable mode", async ({ request, page }) => {
  await request.post("/api/xss/reset");
  await request.put("/api/xss/mode", { data: { mode: "vulnerable" } });
  const vulnerable = await request.post("/api/xss/exercise/comment", { data: { body: attack } });
  const vulnerableResult = await vulnerable.json();
  expect(await (await request.get(`/api/xss/render?traceId=${vulnerableResult.traceId}`)).text()).toContain("onerror=");
  await request.post("/api/xss/reset");
  await request.put("/api/xss/mode", { data: { mode: "safe" } });
  const safe = await request.post("/api/xss/exercise/comment", { data: { body: attack } });
  const safeResult = await safe.json();
  expect(await (await request.get(`/api/xss/render?traceId=${safeResult.traceId}`)).text()).toContain("&lt;img");

  await request.post("/api/xss/reset");
  await request.put("/api/xss/mode", { data: { mode: "vulnerable" } });
  await page.goto("/");
  await page.getByRole("button", { name: "Stored XSS" }).click();
  await expect(page.getByText("Локальная лаборатория готова")).toBeVisible();
  await page.getByRole("button", { name: "Запустить локально" }).click();
  await expect(page.getByTitle("Изолированный XSS-предпросмотр")).toBeVisible();
  await page.getByRole("tab", { name: "Логи" }).click();
  await expect(page.getByText("Песочница браузера подтвердила выполнение учебного обработчика.")).toBeVisible();
});
