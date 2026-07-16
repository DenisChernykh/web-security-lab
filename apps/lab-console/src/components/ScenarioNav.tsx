import type { Scenario } from "../content/scenarios.js";

interface ScenarioNavProps {
  scenario: Scenario;
}

export function ScenarioNav({ scenario }: ScenarioNavProps) {
  return (
    <nav className="scenario-nav" aria-label="Шаги урока">
      <p className="eyebrow">Сценарий</p>
      <strong>{scenario.title}</strong>
      <ol>
        {scenario.steps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}
      </ol>
    </nav>
  );
}
