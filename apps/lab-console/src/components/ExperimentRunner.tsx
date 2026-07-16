import { useEffect, useState } from "react";
import type { Dispatch } from "react";
import type { LabId, LabMode } from "@local-lab/contracts";
import { redact } from "@local-lab/lab-core/redact";
import type { Scenario } from "../content/scenarios.js";
import {
  getHealth,
  getMode,
  getSource,
  resetLab,
  runFixedExercise,
  setMode,
  subscribeToEvents
} from "../lib/lab-api.js";
import type { ExperimentAction, ExperimentState } from "../lib/experiment-reducer.js";
import { LabStatus } from "./LabStatus.js";
import { XssPreview } from "./XssPreview.js";
import { CsrfExercise } from "./CsrfExercise.js";

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

function isRunnable(status: ExperimentState["status"]): boolean {
  return status === "ready" || status === "complete" || status === "stream-incomplete";
}

export function ExperimentRunner({ labId, scenario, state, dispatch }: ExperimentRunnerProps) {
  const [requestKind, setRequestKind] = useState<"normal" | "attack">("attack");
  const [resetPending, setResetPending] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const unsubscribe = subscribeToEvents(
      labId,
      (event) => dispatch({ type: "RUN_EVENT", event }),
      () => dispatch({ type: "STREAM_INCOMPLETE" })
    );

    void Promise.all([getHealth(labId, controller.signal), getSource(labId), getMode(labId)])
      .then(([, source, confirmedMode]) => {
        dispatch({ type: "SOURCE_LOADED", source });
        dispatch({ type: "MODE_SYNCED", mode: confirmedMode.mode });
        dispatch({ type: "HEALTH_READY" });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "INITIALIZATION_FAILED", error: error instanceof Error ? error.message : "Unknown error" });
        }
      });

    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [dispatch, labId]);

  const chooseMode = async (mode: LabMode) => {
    if (state.status === "running" || state.modeChangePending !== undefined || mode === state.mode) {
      return;
    }
    dispatch({ type: "MODE_CHANGE_STARTED", mode });
    try {
      const confirmed = await setMode(labId, mode);
      dispatch({ type: "MODE_CHANGED", mode: confirmed.mode });
    } catch (error) {
      dispatch({ type: "MODE_CHANGE_FAILED", error: error instanceof Error ? error.message : "Unknown error" });
    }
  };

  const run = async () => {
    if (!isRunnable(state.status) || state.modeChangePending !== undefined) {
      return;
    }
    dispatch({ type: "RUN_STARTED" });
    try {
      const input = requestKind === "normal" ? scenario.normalRequest : scenario.attackRequest;
      const result = await runFixedExercise(labId, input);
      dispatch({ type: "RUN_SUCCEEDED", result });
    } catch (error) {
      const message = error instanceof DOMException && error.name === "TimeoutError"
        ? "Превышено время ожидания 8 секунд"
        : error instanceof Error ? error.message : "Unknown error";
      dispatch({ type: "RUN_FAILED", error: message });
    }
  };

  const reset = async () => {
    setResetPending(true);
    try {
      await resetLab(labId);
      dispatch({ type: "RESET_SUCCEEDED" });
    } catch (error) {
      dispatch({ type: "RESET_FAILED", error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setResetPending(false);
    }
  };

  return (
    <main className="experiment">
      <LabStatus status={state.status} error={state.error} />
      <p className="eyebrow">Локальный урок</p>
      <h1>{scenario.title}</h1>
      <p className="summary">{scenario.summary}</p>
      <div className="lesson-copy">
        <p><strong>Что происходит:</strong> {scenario.whatHappens}</p>
        <p><strong>Почему работает:</strong> {scenario.whyItWorks}</p>
      </div>

      <div className="mode-switch" aria-label="Режим лаборатории">
        {(Object.keys(modeLabels) as LabMode[]).map((mode) => (
          <button
            className={`mode-button ${mode === "safe" ? "safe" : ""}`}
            type="button"
            aria-pressed={state.mode === mode}
            disabled={state.status === "running" || state.modeChangePending !== undefined}
            key={mode}
            onClick={() => void chooseMode(mode)}
          >
            {modeLabels[mode]}
          </button>
        ))}
      </div>

      <section className="request-preview" aria-labelledby="request-title">
        <h2 id="request-title">Фиксированный учебный запрос</h2>
        <div className="request-kind" aria-label="Учебный запрос">
          <button type="button" aria-pressed={requestKind === "normal"} onClick={() => setRequestKind("normal")}>Нормальный запрос</button>
          <button type="button" aria-pressed={requestKind === "attack"} onClick={() => setRequestKind("attack")}>Локальная атака</button>
        </div>
        <code>{JSON.stringify(redact(requestKind === "normal" ? scenario.normalRequest : scenario.attackRequest))}</code>
        <p>Ввод нельзя изменить: этот урок выполняет только локальный пример.</p>
      </section>

      {state.mode === "safe" ? <p className="safe-principle">{scenario.safePrinciple}</p> : null}

      {labId === "csrf" ? null : <button
        className="run-button"
        type="button"
        onClick={() => void run()}
        disabled={!isRunnable(state.status) || state.modeChangePending !== undefined}
      >
        Запустить локально
      </button>}
      <button className="reset-button" type="button" disabled={resetPending || state.status === "running"} onClick={() => void reset()}>Сбросить лабораторию</button>
      {state.status === "running" ? <div className="request-progress" aria-label="Запрос выполняется" /> : null}
      {labId === "xss" && state.result !== undefined ? <XssPreview traceId={state.result.traceId} /> : null}
      {labId === "csrf" ? <CsrfExercise mode={state.mode} /> : null}
    </main>
  );
}
