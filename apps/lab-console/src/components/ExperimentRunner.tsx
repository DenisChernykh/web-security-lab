import { useEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { LabId, LabMode } from "@local-lab/contracts";
import type { Scenario } from "../content/scenarios.js";
import {
  getHealth,
  getSource,
  runExercise,
  setMode,
  subscribeToEvents
} from "../lib/lab-api.js";
import type { ExperimentAction, ExperimentState } from "../lib/experiment-reducer.js";
import { LabStatus } from "./LabStatus.js";

interface ExperimentRunnerProps {
  labId: LabId;
  scenario: Scenario;
  state: ExperimentState;
  dispatch: Dispatch<ExperimentAction>;
}

const modeLabels: Record<LabMode, string> = {
  vulnerable: "Уязвимая",
  safe: "Защищённая"
};

export function ExperimentRunner({ labId, scenario, state, dispatch }: ExperimentRunnerProps) {
  const modeRef = useRef(state.mode);
  modeRef.current = state.mode;

  useEffect(() => {
    const controller = new AbortController();
    const unsubscribe = subscribeToEvents(
      labId,
      (event) => dispatch({ type: "RUN_EVENT", event }),
      () => dispatch({ type: "STREAM_INCOMPLETE" })
    );

    void Promise.all([getHealth(labId, controller.signal), getSource(labId)])
      .then(([, source]) => {
        dispatch({ type: "SOURCE_LOADED", source });
        dispatch({ type: "HEALTH_READY" });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "RUN_FAILED", error: error instanceof Error ? error.message : "Unknown error" });
        }
      });

    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [dispatch, labId]);

  const chooseMode = (mode: LabMode) => {
    if (mode === modeRef.current) {
      return;
    }
    dispatch({ type: "MODE_CHANGED", mode });
    void setMode(labId, mode).catch((error: unknown) => {
      dispatch({ type: "RUN_FAILED", error: error instanceof Error ? error.message : "Unknown error" });
    });
  };

  const run = async () => {
    dispatch({ type: "RUN_STARTED" });
    try {
      const result = await runExercise(labId, "/exercise/login", scenario.attackRequest);
      dispatch({ type: "RUN_SUCCEEDED", result });
    } catch (error) {
      dispatch({ type: "RUN_FAILED", error: error instanceof Error ? error.message : "Unknown error" });
    }
  };

  return (
    <main className="experiment">
      <LabStatus status={state.status} error={state.error} />
      <p className="eyebrow">Локальный урок</p>
      <h1>{scenario.title}</h1>
      <p className="summary">{scenario.summary}</p>

      <div className="mode-switch" aria-label="Режим лаборатории">
        {(Object.keys(modeLabels) as LabMode[]).map((mode) => (
          <button
            className={`mode-button ${mode === "safe" ? "safe" : ""}`}
            type="button"
            aria-pressed={state.mode === mode}
            key={mode}
            onClick={() => chooseMode(mode)}
          >
            {modeLabels[mode]}
          </button>
        ))}
      </div>

      <section className="request-preview" aria-labelledby="request-title">
        <h2 id="request-title">Фиксированный учебный запрос</h2>
        <code>{JSON.stringify(scenario.attackRequest)}</code>
        <p>Ввод нельзя изменить: этот урок выполняет только локальный пример.</p>
      </section>

      {state.mode === "safe" ? <p className="safe-principle">{scenario.safePrinciple}</p> : null}

      <button className="run-button" type="button" onClick={() => void run()} disabled={state.status === "running"}>
        Запустить локально
      </button>
      {state.status === "running" ? <div className="request-progress" aria-label="Запрос выполняется" /> : null}
    </main>
  );
}
