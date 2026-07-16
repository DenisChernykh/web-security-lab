import type { ExperimentStatus } from "../lib/experiment-reducer.js";

interface LabStatusProps {
  status: ExperimentStatus;
  error?: string | undefined;
}

const statusText: Record<ExperimentStatus, string> = {
  checking: "Проверяем локальную лабораторию",
  ready: "Локальная лаборатория готова",
  running: "Выполняем фиксированный учебный запрос",
  complete: "Эксперимент завершён",
  "infrastructure-error": "Локальная лаборатория недоступна",
  "exercise-error": "Учебный запрос завершился ошибкой",
  "stream-incomplete": "Ответ получен, поток логов прерван"
};

export function LabStatus({ status, error }: LabStatusProps) {
  return (
    <div className={`lab-status ${status}`} role="status">
      <span>{statusText[status]}</span>
      {error === undefined ? null : <small>{error}</small>}
    </div>
  );
}
