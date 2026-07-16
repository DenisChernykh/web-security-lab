import assert from "node:assert/strict";

const gatewayPort = process.env.LAB_GATEWAY_HOST_PORT ?? "8080";
const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;

const health = await fetch(`${gatewayUrl}/api/sql/health`).then((response) => response.json());
assert.deepEqual(health, { status: "ok", labId: "sql" });

const xssHealth = await fetch(`${gatewayUrl}/api/xss/health`).then((response) => response.json());
assert.deepEqual(xssHealth, { status: "ok", labId: "xss" });

const idorHealth = await fetch(`${gatewayUrl}/api/idor/health`).then((response) => response.json());
assert.deepEqual(idorHealth, { status: "ok", labId: "idor" });

const idorReset = await fetch(`${gatewayUrl}/api/idor/reset`, { method: "POST" });
assert.equal(idorReset.status, 200);
assert.deepEqual(await idorReset.json(), { reset: true });

const root = await fetch(`${gatewayUrl}/`);
assert.equal(root.status, 200);
assert.match(await root.text(), /LOCAL\/LAB/);
