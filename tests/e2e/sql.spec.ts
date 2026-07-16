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
});
