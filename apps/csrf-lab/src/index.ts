import { createCsrfLab } from "./app.js";

const attackerPort = Number(process.env.CSRF_ATTACKER_HOST_PORT ?? "8081");
if (!Number.isSafeInteger(attackerPort) || attackerPort < 1 || attackerPort > 65535) {
  throw new RangeError("CSRF_ATTACKER_HOST_PORT must be an integer from 1 to 65535");
}

const lab = createCsrfLab({ attackerPort });

process.once("SIGTERM", () => {
  void lab.close().then(() => process.exit(0));
});

await lab.app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
