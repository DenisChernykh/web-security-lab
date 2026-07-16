import { expect, test } from "@playwright/test";

const attack = `<img src="x" alt="" onerror="parent.postMessage({type:'lab-xss',traceId:new URLSearchParams(location.search).get('traceId')},'*')">`;

test("stored XSS renders executable HTML only in vulnerable mode", async ({ request }) => {
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
});
