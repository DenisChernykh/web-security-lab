import type { ExerciseOutcome, LabMode } from "@local-lab/contracts";

export const SQL_LESSON = {
  request: {
    observation: "Фиксированный учебный запрос принят.",
    explanation: "Лаборатория принимает только два заранее заданных варианта входа."
  },
  query: {
    vulnerable: {
      observation: "Пользовательский ввод склеен с SQL-командой.",
      explanation: "Апостроф из фиксированной атаки становится частью синтаксиса SQL."
    },
    safe: {
      observation: "SQL-команда и пользовательские данные переданы раздельно.",
      explanation: "Параметры остаются данными и не меняют синтаксис запроса."
    }
  },
  executed: {
    observation: "Запрос выполнен в локальной SQLite базе.",
    explanation: "Количество строк определяет результат аутентификации."
  }
} as const;

export function authDecision(mode: LabMode, outcome: ExerciseOutcome) {
  if (outcome === "expected") {
    return {
      observation: "Обычный вход подтверждён.",
      explanation: "Правильные фиксированные учётные данные нашли ровно одного пользователя."
    };
  }

  if (mode === "vulnerable") {
    return {
      observation: "Условие SQL стало истинным для нескольких строк.",
      explanation: "Конкатенация позволила фиксированной атаке обойти проверку пароля."
    };
  }

  return {
    observation: "Атака заблокирована параметризованным запросом.",
    explanation: "Фиксированное атакующее значение обработано как email, а не как SQL-код."
  };
}
