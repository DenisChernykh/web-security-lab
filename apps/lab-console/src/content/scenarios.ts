import { FIXED_EXERCISES } from "@local-lab/contracts";

export const scenarios = {
  sql: {
    title: "SQL Injection",
    summary: "Как пользовательский ввод становится частью SQL-команды",
    normalRequest: FIXED_EXERCISES.sql.normal,
    attackRequest: FIXED_EXERCISES.sql.attack,
    safePrinciple: "Параметризованный запрос",
    steps: ["Нормальный запрос", "Локальная атака", "Разбор", "Включить защиту", "Сравнить"]
  }
} as const;

export type ScenarioId = keyof typeof scenarios;
export type Scenario = (typeof scenarios)[ScenarioId];
