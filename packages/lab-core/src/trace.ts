import { randomUUID } from "node:crypto";
import type { LabEvent, LabId, LabMode } from "@local-lab/contracts";
import type { EventBus } from "./event-bus.js";

type TraceEvent = Omit<
  LabEvent,
  "id" | "timestamp" | "traceId" | "labId" | "mode"
>;

export interface TraceContext {
  traceId: string;
  mode: LabMode;
  emit(event: TraceEvent): LabEvent;
}

export function createTrace(labId: LabId, mode: LabMode, bus: EventBus): TraceContext {
  const traceId = randomUUID();

  return {
    traceId,
    mode,
    emit(event) {
      return bus.publish({ ...event, traceId, labId, mode });
    }
  };
}
