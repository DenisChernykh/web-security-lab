import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

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

for (const lab of ["sql", "xss", "idor", "csrf"]) {
  const first = await fetch(`${gatewayUrl}/api/${lab}/reset`, { method: "POST" }).then((response) => response.json());
  const second = await fetch(`${gatewayUrl}/api/${lab}/reset`, { method: "POST" }).then((response) => response.json());
  assert.deepEqual(second, first);
}

const root = await fetch(`${gatewayUrl}/`);
assert.equal(root.status, 200);
assert.match(await root.text(), /LOCAL\/LAB/);

const compose = spawnSync("docker", ["compose", "ps", "--format", "json"], { encoding: "utf8" });
assert.equal(compose.status, 0, compose.stderr);
const output = compose.stdout.trim();
const services = output.startsWith("[") ? JSON.parse(output) : output.split("\n").filter(Boolean).map((line) => JSON.parse(line));
const published = services.filter((service) => Array.isArray(service.Publishers) &&
  service.Publishers.some((publisher) => Number(publisher.PublishedPort) > 0));
assert.equal(published.length, 1);
assert.match(String(published[0].Service), /gateway/);
const hostPublishers = published[0].Publishers.filter((publisher) => Number(publisher.PublishedPort) > 0);
assert.equal(hostPublishers.length, 2);
for (const publisher of hostPublishers) {
  assert.equal(publisher.URL, "127.0.0.1");
  assert.ok(publisher.TargetPort === 8080 || publisher.TargetPort === 8081);
}

const egress = spawnSync("docker", ["compose", "exec", "-T", "sql-lab", "node", "-e",
  "fetch('http://1.1.1.1',{signal:AbortSignal.timeout(1200)}).then(()=>process.exit(1)).catch(()=>process.exit(0))"],
{ encoding: "utf8", timeout: 10_000 });
assert.equal(egress.status, 0, "sql-lab unexpectedly reached an external target");

console.log("Smoke: 4/4 labs healthy, 2 loopback ports, 0 successful egress checks");
