import type { LabId, SourcePair } from "@local-lab/contracts";
import type { FastifyInstance } from "fastify";
import type { EventBus } from "./event-bus.js";
import type { ModeStore } from "./mode-store.js";

export interface CommonRouteDeps {
  labId: LabId;
  mode: ModeStore;
  events: EventBus;
  reset(): unknown | Promise<unknown>;
  readSource(): Promise<SourcePair>;
}

const MODE_ERROR = "mode must be vulnerable or safe";

const requestedMode = (body: unknown): unknown => {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  return "mode" in body ? body.mode : undefined;
};

export async function registerCommonRoutes(
  app: FastifyInstance,
  deps: CommonRouteDeps
): Promise<void> {
  app.get("/health", async () => ({ status: "ok", labId: deps.labId }));

  app.put("/mode", async (request, reply) => {
    try {
      return { mode: deps.mode.set(requestedMode(request.body)) };
    } catch (error) {
      if (error instanceof TypeError && error.message === MODE_ERROR) {
        return reply.code(400).send({ error: MODE_ERROR });
      }
      throw error;
    }
  });

  app.get("/mode", async () => ({ mode: deps.mode.get() }));

  app.post("/reset", async () => {
    const seed = await deps.reset();
    return seed === undefined ? { reset: true } : { reset: true, seed };
  });

  app.get("/source", async (request, reply) => {
    if (Object.keys(request.query as Record<string, unknown>).length > 0) {
      return reply.code(400).send({ error: "source query parameters are not allowed" });
    }

    return deps.readSource();
  });

  app.get("/events", (request, reply) => {
    reply.hijack();
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.flushHeaders();

    const send = (event: ReturnType<EventBus["publish"]>) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    for (const event of deps.events.recent()) {
      send(event);
    }
    const unsubscribe = deps.events.subscribe(send, false);
    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n");
    }, 15_000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
