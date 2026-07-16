import { useReducer } from "react";
import { Inspector } from "./components/Inspector.js";
import { ExperimentRunner } from "./components/ExperimentRunner.js";
import { ScenarioNav } from "./components/ScenarioNav.js";
import { scenarios } from "./content/scenarios.js";
import { experimentReducer, initialExperimentState } from "./lib/experiment-reducer.js";

export function App() {
  const [state, dispatch] = useReducer(experimentReducer, initialExperimentState);
  const scenario = scenarios.sql;

  return (
    <div className="app-shell">
      <header className="app-header">
        <span>Local Web Security Lab</span>
        <span>Только фиксированные локальные демонстрации</span>
      </header>
      <div className="workspace">
        <ScenarioNav scenario={scenario} />
        <ExperimentRunner labId="sql" scenario={scenario} state={state} dispatch={dispatch} />
        <Inspector state={state} />
      </div>
    </div>
  );
}
