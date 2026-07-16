import type { ExerciseResult, LabEvent, LabMode, SourcePair } from "@local-lab/contracts";

export type ExperimentStatus =
  | "checking"
  | "ready"
  | "running"
  | "complete"
  | "infrastructure-error"
  | "exercise-error"
  | "stream-incomplete";

export interface ExperimentState {
  status: ExperimentStatus;
  mode: LabMode;
  events: readonly LabEvent[];
  result?: ExerciseResult | undefined;
  source?: SourcePair | undefined;
  error?: string | undefined;
  modeChangePending?: LabMode | undefined;
}

export type ExperimentAction =
  | { type: "HEALTH_READY" }
  | { type: "INITIALIZATION_FAILED"; error: string }
  | { type: "SOURCE_LOADED"; source: SourcePair }
  | { type: "MODE_CHANGE_STARTED"; mode: LabMode }
  | { type: "MODE_CHANGED"; mode: LabMode }
  | { type: "MODE_CHANGE_FAILED"; error: string }
  | { type: "RUN_STARTED" }
  | { type: "RUN_EVENT"; event: LabEvent }
  | { type: "RUN_SUCCEEDED"; result: ExerciseResult }
  | { type: "RUN_FAILED"; error: string }
  | { type: "STREAM_INCOMPLETE" };

export const initialExperimentState: ExperimentState = {
  status: "checking",
  mode: "vulnerable",
  events: []
};

export function experimentReducer(state: ExperimentState, action: ExperimentAction): ExperimentState {
  switch (action.type) {
    case "HEALTH_READY":
      return state.status === "checking" ? { ...state, status: "ready", error: undefined } : state;
    case "INITIALIZATION_FAILED":
      return state.status === "checking"
        ? { ...state, status: "infrastructure-error", error: action.error }
        : state;
    case "SOURCE_LOADED":
      return { ...state, source: action.source };
    case "MODE_CHANGE_STARTED":
      return state.status !== "running" && state.modeChangePending === undefined
        ? { ...state, modeChangePending: action.mode, error: undefined }
        : state;
    case "MODE_CHANGED":
      return state.status !== "running" && state.modeChangePending !== undefined
        ? { ...state, mode: action.mode, modeChangePending: undefined, error: undefined }
        : state;
    case "MODE_CHANGE_FAILED":
      return state.status !== "running" && state.modeChangePending !== undefined
        ? { ...state, modeChangePending: undefined, error: action.error }
        : state;
    case "RUN_STARTED":
      return state.modeChangePending === undefined &&
        state.status !== "checking" &&
        state.status !== "running" &&
        state.status !== "infrastructure-error"
        ? { ...state, status: "running", events: [], result: undefined, error: undefined }
        : state;
    case "RUN_EVENT":
      if (state.result !== undefined && action.event.traceId !== state.result.traceId) {
        return state;
      }
      return { ...state, events: [...state.events, action.event] };
    case "RUN_SUCCEEDED":
      return state.status === "running" ? {
        ...state,
        status: "complete",
        result: action.result,
        events: state.events.filter((event) => event.traceId === action.result.traceId)
      } : state;
    case "RUN_FAILED":
      return state.status === "running"
        ? { ...state, status: "exercise-error", error: action.error }
        : state;
    case "STREAM_INCOMPLETE":
      return state.status === "complete" ? { ...state, status: "stream-incomplete" } : state;
  }
}
