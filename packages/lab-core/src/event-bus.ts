import { randomUUID } from "node:crypto";
import type { LabEvent } from "@local-lab/contracts";
import { redact } from "./redact.js";

type EventInput = Omit<LabEvent, "id" | "timestamp">;
type Listener = (event: LabEvent) => void;

export class EventBus {
  readonly #history: LabEvent[] = [];
  readonly #listeners = new Set<Listener>();

  constructor(private readonly maxHistory = 200) {}

  publish(event: EventInput): LabEvent {
    const published: LabEvent = {
      ...event,
      ...(event.data === undefined
        ? {}
        : { data: redact(event.data) as Record<string, unknown> }),
      id: randomUUID(),
      timestamp: new Date().toISOString()
    };

    this.#history.push(published);
    if (this.#history.length > this.maxHistory) {
      this.#history.splice(0, this.#history.length - this.maxHistory);
    }

    for (const listener of this.#listeners) {
      listener(published);
    }

    return published;
  }

  recent(): readonly LabEvent[] {
    return [...this.#history];
  }

  forTrace(traceId: string): readonly LabEvent[] {
    return this.#history.filter((event) => event.traceId === traceId);
  }

  subscribe(listener: Listener, replay = true): () => void {
    if (replay) {
      for (const event of this.#history) {
        listener(event);
      }
    }

    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
