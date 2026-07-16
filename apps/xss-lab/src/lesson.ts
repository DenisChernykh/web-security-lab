import type { ExerciseOutcome, LabMode } from "@local-lab/contracts";

export const XSS_LESSON = {
  request: {
    observation: "Фиксированный учебный комментарий принят.",
    explanation: "Лаборатория хранит только обычный комментарий или заранее заданный безопасный демонстрационный пример."
  },
  stored: {
    observation: "Комментарий сохранён в локальной SQLite базе.",
    explanation: "Хранение само по себе не выполняет содержимое: значение становится опасным только в контексте HTML-вывода."
  },
  renderIntent: {
    observation: "Подготовлен локальный просмотр сохранённого комментария.",
    explanation: "Режим определит, будет ли значение вставлено как HTML или экранировано как текст."
  },
  browser: {
    observation: "Песочница браузера подтвердила выполнение учебного обработчика.",
    explanation: "Подтверждение содержит только фиксированный тип события и trace ID; скрипты, URL и другой ввод не принимаются."
  }
} as const;

export function commentOutcome(mode: LabMode, isAttack: boolean): ExerciseOutcome {
  if (!isAttack) {
    return "expected";
  }

  return mode === "vulnerable" ? "exploited" : "blocked";
}
