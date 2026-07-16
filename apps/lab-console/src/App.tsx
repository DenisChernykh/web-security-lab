import { useReducer, useState } from "react";
import { Inspector } from "./components/Inspector.js";
import { ExperimentRunner } from "./components/ExperimentRunner.js";
import { ScenarioNav } from "./components/ScenarioNav.js";
import { scenarios, type ScenarioId } from "./content/scenarios.js";
import { experimentReducer, initialExperimentState } from "./lib/experiment-reducer.js";

export function App() {
  const [labId, setLabId] = useState<ScenarioId>("sql");
  return <LabWorkspace key={labId} labId={labId} onSelect={setLabId} />;
}

function LabWorkspace({ labId, onSelect }: { labId: ScenarioId; onSelect: (id: ScenarioId) => void }) {
  const [state, dispatch] = useReducer(experimentReducer, initialExperimentState);
  const scenario = scenarios[labId];

  return (
    <div className="app-shell">
      <header className="app-header">
        <span>Local Web Security Lab</span>
        <span>Только фиксированные локальные демонстрации</span>
      </header>
      <div className="workspace">
        <ScenarioNav scenario={scenario} activeId={labId} onSelect={onSelect} />
        <ExperimentRunner labId={labId} scenario={scenario} state={state} dispatch={dispatch} />
        <Inspector state={state} />
      </div>
    </div>
  );
}
