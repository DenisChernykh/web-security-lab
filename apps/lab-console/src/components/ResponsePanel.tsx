import { redact } from "@local-lab/lab-core/redact";
import type { ExperimentState } from "../lib/experiment-reducer.js";

const labels = { expected: "Ожидаемый результат", exploited: "Атака сработала", blocked: "Защита сработала" } as const;

export function ResponsePanel({ state }: { state: ExperimentState }) {
  if (state.result === undefined) return <p className="empty-state">Запустите фиксированный пример, чтобы увидеть ответ.</p>;
  return <div className="response-panel">
    <p>Результат: <strong>{labels[state.result.outcome]}</strong></p>
    <p>HTTP: {state.result.status}</p>
    <pre><code>{JSON.stringify(redact(state.result.body), null, 2)}</code></pre>
  </div>;
}
