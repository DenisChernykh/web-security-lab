import { createCsrfAttacker } from "./app.js";

const victimPort = Number(process.env.VICTIM_HOST_PORT ?? "8080");
if (!Number.isSafeInteger(victimPort) || victimPort < 1 || victimPort > 65535) {
  throw new RangeError("VICTIM_HOST_PORT must be an integer from 1 to 65535");
}

const app = createCsrfAttacker({ victimPort });

process.once("SIGTERM", () => {
  void app.close().then(() => process.exit(0));
});

await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
