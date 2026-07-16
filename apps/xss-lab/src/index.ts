import { createXssLab } from "./app.js";

const lab = createXssLab({ databasePath: process.env.DATABASE_PATH ?? ":memory:" });

async function close(): Promise<void> {
  await lab.close();
}

process.once("SIGTERM", () => {
  void close().then(() => process.exit(0));
});

await lab.app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
