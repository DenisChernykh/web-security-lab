import { scenarios, type Scenario, type ScenarioId } from "../content/scenarios.js";

interface ScenarioNavProps {
  scenario: Scenario;
  activeId: ScenarioId;
  onSelect: (id: ScenarioId) => void;
}

export function ScenarioNav({ scenario, activeId, onSelect }: ScenarioNavProps) {
  return (
    <nav className="scenario-nav" aria-label="Шаги урока">
      <p className="eyebrow">Сценарий</p>
      <div className="scenario-list" aria-label="Лаборатории">
        {(Object.entries(scenarios) as [ScenarioId, Scenario][]).map(([id, item]) => (
          <button type="button" key={id} aria-current={id === activeId ? "page" : undefined} onClick={() => onSelect(id)}>
            {item.title}
          </button>
        ))}
      </div>
      <strong>{scenario.title}: пять шагов</strong>
      <ol>
        {scenario.steps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}
      </ol>
    </nav>
  );
}
