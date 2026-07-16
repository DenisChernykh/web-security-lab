import { createSqlLab } from "./app.js";

const lab = createSqlLab();

async function close(): Promise<void> {
  await lab.close();
}

process.once("SIGTERM", () => {
  void close().then(() => process.exit(0));
});

await lab.app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
