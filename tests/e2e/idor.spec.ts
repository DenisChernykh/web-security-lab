import { expect, test } from "@playwright/test";

test("Alice cannot read Bob document after owner scoping", async ({ request }) => {
  await request.post("/api/idor/reset");
  await request.post("/api/idor/exercise/session", { data: { user: "alice" } });
  await request.put("/api/idor/mode", { data: { mode: "vulnerable" } });
  expect((await (await request.get("/api/idor/exercise/documents/doc-bob")).json()).outcome).toBe("exploited");
  await request.put("/api/idor/mode", { data: { mode: "safe" } });
  const safe = await request.get("/api/idor/exercise/documents/doc-bob");
  expect(safe.status()).toBe(404);
  expect((await safe.json()).outcome).toBe("blocked");
});
