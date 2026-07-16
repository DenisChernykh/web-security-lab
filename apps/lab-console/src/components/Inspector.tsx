import { useRef, useState } from "react";
import { redact } from "@local-lab/lab-core/redact";
import type { ExperimentState } from "../lib/experiment-reducer.js";
import { SourceDiff } from "./SourceDiff.js";
import { ResponsePanel } from "./ResponsePanel.js";

type InspectorTab = "response" | "logs" | "diff";

const tabs: ReadonlyArray<{ id: InspectorTab; label: string }> = [
  { id: "response", label: "Ответ" },
  { id: "logs", label: "Логи" },
  { id: "diff", label: "Diff" }
];

interface InspectorProps {
  state: ExperimentState;
}

export function Inspector({ state }: InspectorProps) {
  const [tab, setTab] = useState<InspectorTab>("response");
  const tabRefs = useRef<Partial<Record<InspectorTab, HTMLButtonElement | null>>>({});
  const finalEvent = state.events.at(-1);
  const selectAdjacent = (current: InspectorTab, direction: 1 | -1) => {
    const index = tabs.findIndex(({ id }) => id === current);
    const next = tabs[(index + direction + tabs.length) % tabs.length]!.id;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <aside className="inspector" aria-label="Инспектор эксперимента">
      <div className="inspector-tabs" role="tablist" aria-label="Данные эксперимента">
        {tabs.map(({ id, label }) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            id={`tab-${id}`}
            tabIndex={tab === id ? 0 : -1}
            ref={(node) => { tabRefs.current[id] = node; }}
            key={id}
            onClick={() => setTab(id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") { event.preventDefault(); selectAdjacent(id, 1); }
              if (event.key === "ArrowLeft") { event.preventDefault(); selectAdjacent(id, -1); }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="inspector-panel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} key={tab} role="tabpanel">
        {tab === "response" ? (
          <><ResponsePanel state={state} />{finalEvent === undefined ? null : <p className="final-observation">{finalEvent.observation}</p>}</>
        ) : null}
        {tab === "logs" ? (
          state.events.length === 0 ? <p className="empty-state">Локальные события появятся после запуска.</p> : (
            <ol className="event-log">
              {state.events.map((event) => (
                <li className="log-entry" key={event.id}>
                  <time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleTimeString("ru-RU")}</time>
                  <strong>{event.source}</strong>
                  <small>trace {event.traceId}</small>
                  <p>{event.observation}</p>
                  <p>{event.explanation}</p>
                  {event.result === undefined ? null : <small>{event.result}</small>}
                  {event.data === undefined ? null : <pre><code>{JSON.stringify(redact(event.data), null, 2)}</code></pre>}
                </li>
              ))}
            </ol>
          )
        ) : null}
        {tab === "diff" ? <SourceDiff mode={state.mode} source={state.source} /> : null}
      </div>
    </aside>
  );
}
