import assert from "node:assert/strict";

function parseGatewayPort(value) {
  const portValue = value ?? "8080";

  if (!/^\d+$/.test(portValue)) {
    throw new TypeError("LAB_GATEWAY_HOST_PORT must be an integer from 1 to 65535");
  }

  const port = Number(portValue);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new RangeError("LAB_GATEWAY_HOST_PORT must be an integer from 1 to 65535");
  }

  return port;
}

const gatewayPort = parseGatewayPort(process.env.LAB_GATEWAY_HOST_PORT);
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
