# Local Web Security Lab

> **Внимание:** сервисы в режиме `vulnerable` намеренно небезопасны. Запускайте систему только локально. Gateway публикуется исключительно на `127.0.0.1`, а лаборатории находятся во внутренней Docker-сети.

## Требования

Docker Desktop либо Docker Engine с Compose v2, Node.js 24 — для запуска проверок вне контейнеров.

## Запуск

```bash
docker compose up --build
```

Откройте [http://localhost:8080](http://localhost:8080). Если порты заняты:

```bash
LAB_GATEWAY_HOST_PORT=18080 LAB_ATTACKER_HOST_PORT=18081 docker compose up --build
```

Тогда console доступна на `http://localhost:18080`, CSRF attacker — на `http://localhost:18081`.

## Уроки

- SQL Injection — конкатенация SQL против параметризованного запроса.
- Stored XSS — raw HTML против контекстного экранирования.
- IDOR — проверка ID против выборки по ID и владельцу.
- CSRF — cookie-аутентификация против synchronizer token на двух origin.

В каждом уроке используется один закрытый фиксированный пример: нормальный запрос, атака, объяснение, безопасный режим и сравнение исходного кода.

## Сброс и остановка

Кнопка «Сбросить лабораторию» восстанавливает данные выбранного урока. Полная очистка контейнеров и томов:

```bash
docker compose down -v
```

## Диагностика

Проверьте `http://localhost:8080/healthz` и `docker compose ps`. При ошибке `port is already allocated` выберите свободные числовые `LAB_GATEWAY_HOST_PORT` и `LAB_ATTACKER_HOST_PORT`; host всегда остаётся `127.0.0.1`.

## Проверка

```bash
npm run typecheck
npm test
npm run build
LAB_GATEWAY_HOST_PORT=18080 LAB_ATTACKER_HOST_PORT=18081 docker compose up --build -d --wait
PW_SKIP_WEBSERVER=1 LAB_GATEWAY_HOST_PORT=18080 LAB_ATTACKER_HOST_PORT=18081 npx playwright test
LAB_GATEWAY_HOST_PORT=18080 LAB_ATTACKER_HOST_PORT=18081 node scripts/compose-smoke.mjs
LAB_GATEWAY_HOST_PORT=18080 LAB_ATTACKER_HOST_PORT=18081 docker compose down -v
```

Система не принимает внешние target URL, host, путь к файлу, shell-команду или произвольный payload. Все демонстрации ограничены локальными allowlist-контрактами.
