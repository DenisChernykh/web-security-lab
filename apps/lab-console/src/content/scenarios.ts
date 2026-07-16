import { FIXED_EXERCISES } from "@local-lab/contracts";

export const scenarios = {
  sql: {
    title: "SQL Injection",
    summary: "Как пользовательский ввод становится частью SQL-команды",
    normalRequest: FIXED_EXERCISES.sql.normal,
    attackRequest: FIXED_EXERCISES.sql.attack,
    whatHappens: "Строка входа меняет смысл SQL и условие становится истинным для чужой записи.",
    whyItWorks: "Команда и данные становятся неразличимы при конкатенации строк.",
    safePrinciple: "Параметризованный запрос",
    steps: ["Нормальный запрос", "Локальная атака", "Разбор", "Включить защиту", "Сравнить"]
  },
  xss: {
    title: "Stored XSS",
    summary: "Как сохранённый текст становится выполняемым DOM",
    normalRequest: { body: FIXED_EXERCISES.xss.normal },
    attackRequest: { body: FIXED_EXERCISES.xss.attack },
    whatHappens: "Payload сохраняется как комментарий и попадает в документ предпросмотра.",
    whyItWorks: "Сохранённый ввод становится исполняемым DOM только при рендеринге как HTML.",
    safePrinciple: "Контекстное экранирование вывода; CSP остаётся дополнительным слоем, а не заменой экранирования.",
    steps: ["Нормальный комментарий", "Сохранённая атака", "Предпросмотр", "Включить защиту", "Сравнить"]
  },
  idor: {
    title: "IDOR",
    summary: "Почему сессия пользователя ещё не даёт доступ к чужому объекту",
    normalRequest: { user: FIXED_EXERCISES.idor.user, documentId: "doc-alice" },
    attackRequest: { user: FIXED_EXERCISES.idor.user, documentId: "doc-bob" },
    whatHappens: "Alice меняет идентификатор и запрашивает документ Bob.",
    whyItWorks: "Аутентификация отвечает кто пользователь; авторизация — принадлежит ли ему объект.",
    safePrinciple: "Выборка объекта одновременно по ID и владельцу",
    steps: ["Сессия Alice", "Чужой ID", "Проверка владельца", "Включить защиту", "Сравнить"]
  },
  csrf: {
    title: "CSRF",
    summary: "Как другой origin отправляет запрос с сессионной cookie сайта-жертвы",
    normalRequest: { email: FIXED_EXERCISES.csrf.normalEmail, csrfToken: "[выдаётся формой]" },
    attackRequest: { email: FIXED_EXERCISES.csrf.attackEmail },
    whatHappens: "Страница на другом порту отправляет фиксированную форму, но не может прочитать ответ.",
    whyItWorks: "Разные порты — разные origin, но один site: SOP/CORS запрещает чтение, не отправку формы; SameSite не блокирует этот same-site пример, а CORS не является CSRF-защитой.",
    safePrinciple: "Synchronizer token, известный только странице-жертве",
    steps: ["Вход на сайт-жертву", "Межсайтовая форма", "Разбор SOP", "Включить защиту", "Сравнить"]
  }
} as const;

export type ScenarioId = keyof typeof scenarios;
export type Scenario = (typeof scenarios)[ScenarioId];
