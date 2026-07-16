export const CSRF_LESSON = {
  origin: {
    observation: "Браузер отправил запрос к локальному сайту-жертве.",
    explanation: "Форма с другого origin может отправить запрос, но политика одного origin не позволяет прочитать ответ."
  },
  session: {
    observation: "Сессионная cookie принята сервером.",
    explanation: "SameSite=Lax не заменяет проверку намерения пользователя для всех изменяющих состояние запросов."
  },
  token: {
    vulnerable: {
      observation: "Сервер изменяет профиль без проверки synchronizer token.",
      explanation: "Одной сессионной cookie достаточно, поэтому межсайтовая форма может выполнить действие."
    },
    safe: {
      observation: "Сервер сравнивает synchronizer token с токеном сессии.",
      explanation: "Страница с другого origin не может прочитать токен из формы жертвы и приложить его к атаке."
    }
  },
  mutation: {
    observation: "Изменение email обработано только для фиксированного учебного профиля.",
    explanation: "Лаборатория не принимает произвольные идентификаторы, адреса или redirect-цели."
  }
} as const;
