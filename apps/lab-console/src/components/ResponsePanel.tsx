import { redact } from "@local-lab/lab-core/redact";
import type { ExperimentState } from "../lib/experiment-reducer.js";

const labels = { expected: "Ожидаемый результат", exploited: "Атака сработала", blocked: "Защита сработала" } as const;

export function ResponsePanel({ state }: { state: ExperimentState }) {
  if (state.result === undefined) return <p className="empty-state">Запустите фиксированный пример, чтобы увидеть ответ.</p>;
  return <div className="response-panel">
    <p>Trace ID: <code>{state.result.traceId}</code></p>
    <p>Результат: <strong>{labels[state.result.outcome]}</strong></p>
    <p>HTTP: {state.result.status}</p>
    <pre><code>{JSON.stringify(redact(state.result.body), null, 2)}</code></pre>
    {state.comparison.vulnerable !== undefined && state.comparison.safe !== undefined ? (
      <div className="result-comparison">
        <p>Сравнение одного {state.requestKind === "attack" ? "атакующего" : "нормального"} запроса: уязвимый — <strong>{labels[state.comparison.vulnerable.outcome]}</strong></p>
        <p>защищённый — <strong>{labels[state.comparison.safe.outcome]}</strong></p>
      </div>
    ) : null}
  </div>;
}
