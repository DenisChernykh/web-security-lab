import assert from "node:assert/strict";

function parsePort(value, variable, fallback) {
  const portValue = value ?? fallback;

  if (!/^\d+$/.test(portValue)) {
    throw new TypeError(`${variable} must be an integer from 1 to 65535`);
  }

  const port = Number(portValue);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new RangeError(`${variable} must be an integer from 1 to 65535`);
  }

  return port;
}

const gatewayPort = parsePort(process.env.LAB_GATEWAY_HOST_PORT, "LAB_GATEWAY_HOST_PORT", "8080");
const attackerPort = parsePort(process.env.LAB_ATTACKER_HOST_PORT, "LAB_ATTACKER_HOST_PORT", "8081");
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

const csrfHealth = await fetch(`${gatewayUrl}/api/csrf/health`).then((response) => response.json());
assert.deepEqual(csrfHealth, { status: "ok", labId: "csrf" });

const csrfAttackerHealth = await fetch(`http://127.0.0.1:${attackerPort}/health`).then((response) => response.json());
assert.deepEqual(csrfAttackerHealth, { status: "ok", service: "csrf-attacker" });

const root = await fetch(`${gatewayUrl}/`);
assert.equal(root.status, 200);
assert.match(await root.text(), /LOCAL\/LAB/);
