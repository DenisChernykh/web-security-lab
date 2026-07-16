# Local Web Security Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать запускаемую одной Docker Compose-командой локальную учебную систему из общей console и четырёх изолированных mini-app, где фиксированные SQL Injection, Stored XSS, IDOR и CSRF демонстрации сравниваются в режимах `vulnerable` и `safe` через реальные запросы, события и исходный diff.

**Architecture:** npm-workspaces monorepo содержит React/Vite console, общий typed contract, общий Fastify runtime и самостоятельные Fastify mini-app. Nginx gateway — единственный опубликованный сервис: `127.0.0.1:8080` обслуживает console и victim API, `127.0.0.1:8081` — отдельный CSRF attacker origin; остальные контейнеры доступны только во внутренней Docker-сети.

**Tech Stack:** Node.js 24 LTS, TypeScript 6.0.2, React 19.2.7, Vite 8.1.1, Fastify 5.10.0, `@fastify/cookie` 11.1.2, Node `node:sqlite`, Vitest 4.1.6, Playwright 1.61.0, Nginx 1.29 Alpine, Docker Compose.

## Global Constraints

- Реализацию и task-level review выполнять моделью Terra с effort `high`.
- Переключаться на более сильную модель только при обоснованном блокере: задача требует архитектурного решения вне утверждённого плана, несколько корректных попыток Terra не проходят верификацию, или финальное whole-branch review выявляет сложную межкомпонентную проблему. Перед таким переключением остановиться и сообщить пользователю причину и предлагаемый объём эскалации.
- Два внешних loopback-порта gateway настраиваются только числовыми переменными `LAB_GATEWAY_HOST_PORT` (victim/console, по умолчанию `8080`) и `LAB_ATTACKER_HOST_PORT` (CSRF attacker, по умолчанию `8081`); внутренние listeners и upstream-маршруты остаются фиксированными. При занятых портах использовать, например, `18080/18081`.
- Вся система запускается одной обязательной командой: `docker compose up --build`.
- В интерфейсе свободно доступны четыре сценария: SQL Injection, Stored XSS, IDOR и CSRF.
- Внутри каждого сценария используется маршрут: нормальный запрос, локальная атака, разбор, включение защиты, повтор и сравнение.
- Один и тот же фиксированный запрос воспроизводит атаку в `vulnerable` и блокируется в `safe`.
- HTTP-запрос, ответ и события связаны одним `trace ID`; diff выбирается по лаборатории и режиму.
- Ни один endpoint не принимает внешний host, произвольный файловый путь или shell-команду.
- XSS-payload выполняет только локальный `postMessage`, не читает cookies/storage и не обращается во внешнюю сеть.
- Все опубликованные порты привязаны к loopback; mini-app подключены только к `internal: true` сети.
- Логи маскируют ключи `password`, `cookie`, `authorization`, `session`, `token` и `csrfToken`.
- Основной интерфейс desktop; на узком viewport три зоны складываются без потери технических данных.
- Не добавлять регистрацию, scoring, произвольные payload, сканирование сайтов, file upload или brute force.

---

## File Map

### Root and infrastructure

- `package.json` — workspaces, единые команды typecheck/test/build/e2e.
- `package-lock.json` — воспроизводимый dependency graph.
- `tsconfig.base.json` — строгие общие TypeScript-настройки; каждый workspace проверяется собственным `tsconfig.json`.
- `vitest.config.ts` — Node и jsdom test projects через `test.projects`.
- `playwright.config.ts` — Compose webServer, Chromium, traces.
- `compose.yaml` — gateway, console, четыре labs и attacker site.
- `infra/lab-runtime.Dockerfile` — единый Node runtime image; процессы и данные остаются раздельными по контейнерам.
- `infra/lab-console.Dockerfile` — Vite build и статический Nginx runtime.
- `infra/gateway/nginx.conf` — фиксированные reverse-proxy маршруты и SSE без buffering.
- `infra/gateway/healthz.txt` — gateway health response.

### Shared packages

- `packages/contracts/src/index.ts` — `LabId`, `LabMode`, `LabEvent`, `ExerciseResult`, `SourcePair`.
- `packages/contracts/src/index.test.ts` — runtime allowlists и redaction-key contract.
- `packages/lab-core/src/event-bus.ts` — bounded history и SSE subscribers.
- `packages/lab-core/src/mode-store.ts` — in-memory mode with validation.
- `packages/lab-core/src/redact.ts` — recursive secret redaction.
- `packages/lab-core/src/source-reader.ts` — чтение ровно двух allowlisted files.
- `packages/lab-core/src/common-routes.ts` — health/mode/reset/source/events.
- `packages/lab-core/src/trace.ts` — trace context и structured event emission.
- `packages/lab-core/src/index.ts` — public exports.
- `packages/lab-core/src/*.test.ts` — unit tests общей платформы.

### Mini-apps

- `apps/sql-lab/src/*` — SQLite users, fixed login payloads, concatenated/prepared handlers.
- `apps/xss-lab/src/*` — SQLite comments, raw/escaped render handlers, harmless browser signal.
- `apps/idor-lab/src/*` — SQLite users/documents, cookie session, ID-only/owner-scoped handlers.
- `apps/csrf-lab/src/*` — cookie session, profile mutation, synchronizer token.
- `apps/csrf-attacker/src/*` — fixed cross-origin HTML form without response-reading code.
- Каждый lab имеет `app.ts`, `index.ts`, `database.ts`, `lesson.ts`, `handlers/vulnerable.ts`, `handlers/safe.ts`, `app.test.ts`.

### Console and verification

- `apps/lab-console/src/content/scenarios.ts` — beginner-first Russian lesson copy and fixed request previews.
- `apps/lab-console/src/lib/lab-api.ts` — health/mode/reset/source/exercise/SSE client.
- `apps/lab-console/src/lib/experiment-reducer.ts` — deterministic experiment state.
- `apps/lab-console/src/components/*` — navigation, runner, inspector, diff, status, XSS iframe, CSRF runner.
- `apps/lab-console/src/App.tsx` — composition only.
- `apps/lab-console/src/styles.css` — approved dark/cyan, three-column layout and responsive stack.
- `apps/lab-console/src/*.test.tsx` — console behavior in jsdom.
- `tests/contracts/labs.contract.test.ts` — same HTTP contract against four factories.
- `tests/e2e/*.spec.ts` — complete browser journeys.
- `scripts/compose-smoke.mjs` — health, published-port and reset checks.
- `README.md` — safe local usage, reset, teardown and troubleshooting.

Every workspace `package.json` uses ESM, declares `"typecheck": "tsc -p tsconfig.json --noEmit"`, and depends on shared workspaces with `"@local-lab/contracts": "*"` and, for server apps, `"@local-lab/lab-core": "*"`. This keeps the root workspace typecheck complete without a fragile project-reference graph.
Every mini-app `index.ts` listens on `0.0.0.0` and `Number(process.env.PORT ?? 3000)`, and closes Fastify plus its SQLite handle on `SIGTERM`. Each lab passes `new URL("./handlers/vulnerable.ts", import.meta.url)` and the corresponding safe URL to the allowlisted source reader.

---

### Task 1: Monorepo and Typed Contract

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/index.test.ts`

**Interfaces:**
- Consumes: approved design spec only.
- Produces: `LAB_IDS`, `LabId`, `LabMode`, `LabEvent`, `ExerciseOutcome`, `ExerciseResult<T>`, `SourcePair`, `REDACTED_KEYS`, `FIXED_EXERCISES`.

- [ ] **Step 1: Create the workspace manifest and install pinned tooling**

Create `package.json`:

```json
{
  "name": "local-web-security-lab",
  "private": true,
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "npm run build --workspaces --if-present",
    "test:e2e": "playwright test",
    "verify": "npm run typecheck && npm test && npm run build"
  },
  "devDependencies": {
    "@playwright/test": "1.61.0",
    "@testing-library/react": "16.3.2",
    "@types/node": "24.13.2",
    "@vitest/coverage-v8": "4.1.6",
    "jsdom": "29.1.1",
    "tsx": "4.23.1",
    "typescript": "6.0.2",
    "vitest": "4.1.6"
  }
}
```

Run: `npm install --package-lock-only`

Expected: exit 0 and a new `package-lock.json` with `lockfileVersion: 3`.

- [ ] **Step 2: Add strict TypeScript and Vitest project configuration**

Create `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, NodeNext modules and `ES2023`. Create `packages/contracts/package.json` with name `@local-lab/contracts`, ESM export `./src/index.ts`, and script `"typecheck": "tsc -p tsconfig.json --noEmit"`. Its `tsconfig.json` extends the base and includes `src/**/*.ts`. Create `vitest.config.ts` with this exact project boundary:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    restoreMocks: true,
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["packages/**/*.test.ts", "apps/**/*.{test,spec}.ts", "tests/contracts/**/*.test.ts"],
          exclude: ["apps/lab-console/**/*.test.tsx"]
        }
      },
      {
        test: {
          name: "console",
          environment: "jsdom",
          include: ["apps/lab-console/**/*.test.tsx"]
        }
      }
    ]
  }
});
```

- [ ] **Step 3: Write the failing contract test**

```ts
import { describe, expect, it } from "vitest";
import { FIXED_EXERCISES, LAB_IDS, REDACTED_KEYS, isLabMode } from "./index.js";

describe("lab contract", () => {
  it("keeps the public lab and mode allowlists closed", () => {
    expect(LAB_IDS).toEqual(["sql", "xss", "idor", "csrf"]);
    expect(isLabMode("vulnerable")).toBe(true);
    expect(isLabMode("safe")).toBe(true);
    expect(isLabMode("custom")).toBe(false);
  });

  it("defines every secret key that logs must redact", () => {
    expect(REDACTED_KEYS).toEqual([
      "authorization", "cookie", "csrfToken", "password", "session", "token"
    ]);
  });

  it("keeps every exercise input fixed and local", () => {
    expect(FIXED_EXERCISES.sql.attack.email).toBe("' OR 1=1 -- ");
    expect(FIXED_EXERCISES.xss.attack).toContain("parent.postMessage");
    expect(FIXED_EXERCISES.idor.documents).toEqual(["doc-alice", "doc-bob"]);
    expect(FIXED_EXERCISES.csrf.attackEmail).toBe("attacker-controlled@example.test");
  });
});
```

- [ ] **Step 4: Run the contract test and verify RED**

Run: `npx vitest run packages/contracts/src/index.test.ts`

Expected: FAIL because `./index.js` does not exist.

- [ ] **Step 5: Implement the contract**

```ts
export const LAB_IDS = ["sql", "xss", "idor", "csrf"] as const;
export type LabId = (typeof LAB_IDS)[number];

export const LAB_MODES = ["vulnerable", "safe"] as const;
export type LabMode = (typeof LAB_MODES)[number];
export const isLabMode = (value: unknown): value is LabMode =>
  typeof value === "string" && LAB_MODES.includes(value as LabMode);

export const REDACTED_KEYS = [
  "authorization", "cookie", "csrfToken", "password", "session", "token"
] as const;

export const FIXED_EXERCISES = {
  sql: {
    normal: { email: "alice@example.test", password: "correct-horse" },
    attack: { email: "' OR 1=1 -- ", password: "demo" }
  },
  xss: {
    normal: "Отличный учебный пример",
    attack: `<img src="x" alt="" onerror="parent.postMessage({type:'lab-xss',traceId:new URLSearchParams(location.search).get('traceId')},'*')">`
  },
  idor: { user: "alice", documents: ["doc-alice", "doc-bob"] },
  csrf: {
    normalEmail: "alice.updated@example.test",
    attackEmail: "attacker-controlled@example.test"
  }
} as const;

export type LabEventSource = "browser" | "api" | "auth" | "database" | "renderer";
export type ExerciseOutcome = "expected" | "exploited" | "blocked";

export interface LabEvent {
  id: string;
  timestamp: string;
  traceId: string;
  labId: LabId;
  mode: LabMode;
  stepId: string;
  source: LabEventSource;
  kind: string;
  observation: string;
  explanation: string;
  result?: string;
  data?: Record<string, unknown>;
}

export interface ExerciseResult<T extends Record<string, unknown> = Record<string, unknown>> {
  traceId: string;
  outcome: ExerciseOutcome;
  status: number;
  body: T;
}

export interface SourcePair {
  labId: LabId;
  vulnerable: string;
  safe: string;
}
```

- [ ] **Step 6: Verify GREEN and commit**

Run: `npx vitest run packages/contracts/src/index.test.ts && npm run typecheck`

Expected: 3 tests PASS; TypeScript exit 0.

```bash
git add package.json package-lock.json tsconfig.base.json vitest.config.ts packages/contracts
git commit -m "chore: establish typed lab workspace"
```

---

### Task 2: Shared Lab Runtime

**Files:**
- Create: `packages/lab-core/package.json`
- Create: `packages/lab-core/tsconfig.json`
- Create: `packages/lab-core/src/event-bus.ts`
- Create: `packages/lab-core/src/mode-store.ts`
- Create: `packages/lab-core/src/redact.ts`
- Create: `packages/lab-core/src/source-reader.ts`
- Create: `packages/lab-core/src/trace.ts`
- Create: `packages/lab-core/src/common-routes.ts`
- Create: `packages/lab-core/src/index.ts`
- Test: `packages/lab-core/src/event-bus.test.ts`
- Test: `packages/lab-core/src/common-routes.test.ts`

**Interfaces:**
- Consumes: contract types from Task 1.
- Produces: `EventBus`, `ModeStore`, `redact`, `createSourceReader`, `createTrace`, `registerCommonRoutes`.

- [ ] **Step 1: Install Fastify and declare the package boundary**

Add `fastify@5.10.0` and `@local-lab/contracts` to `packages/lab-core/package.json`. Export only `src/index.ts`; do not export internal file paths.

Run: `npm install`

Expected: root lockfile contains Fastify 5.10.0.

- [ ] **Step 2: Write failing event and redaction tests**

```ts
it("bounds history, replays events, and removes a subscriber", () => {
  const bus = new EventBus(2);
  const received: LabEvent[] = [];
  const unsubscribe = bus.subscribe((event) => received.push(event), false);
  bus.publish(makeEvent("one"));
  unsubscribe();
  bus.publish(makeEvent("two"));
  bus.publish(makeEvent("three"));
  expect(received.map((event) => event.kind)).toEqual(["one"]);
  expect(bus.recent().map((event) => event.kind)).toEqual(["two", "three"]);
});

it("redacts nested secrets without mutating safe data", () => {
  expect(redact({ email: "alice@example.test", nested: { password: "secret", token: "abc" } }))
    .toEqual({ email: "alice@example.test", nested: { password: "[REDACTED]", token: "[REDACTED]" } });
});
```

Run: `npx vitest run packages/lab-core/src/event-bus.test.ts`

Expected: FAIL because the runtime classes do not exist.

- [ ] **Step 3: Implement bounded events, modes, redaction and traces**

Implement these exact signatures:

```ts
export class EventBus {
  constructor(maxHistory = 200);
  publish(event: Omit<LabEvent, "id" | "timestamp">): LabEvent;
  recent(): readonly LabEvent[];
  forTrace(traceId: string): readonly LabEvent[];
  subscribe(listener: (event: LabEvent) => void, replay?: boolean): () => void;
}

export class ModeStore {
  get(): LabMode;
  set(value: unknown): LabMode;
}

export function redact(value: unknown): unknown;

export interface TraceContext {
  traceId: string;
  mode: LabMode;
  emit(event: Omit<LabEvent, "id" | "timestamp" | "traceId" | "labId" | "mode">): LabEvent;
}

export function createTrace(labId: LabId, mode: LabMode, bus: EventBus): TraceContext;
```

`ModeStore.set()` throws `TypeError("mode must be vulnerable or safe")`. `redact()` compares keys case-insensitively and recurses through arrays and plain objects.
`EventBus.publish()` passes `event.data` through `redact()` before storing or broadcasting it, so individual labs cannot accidentally bypass masking.

- [ ] **Step 4: Write failing common-route tests**

Build a Fastify instance, register common routes, then assert:

```ts
expect((await app.inject({ method: "GET", url: "/health" })).json()).toEqual({ status: "ok", labId: "sql" });
expect((await app.inject({ method: "PUT", url: "/mode", payload: { mode: "safe" } })).json()).toEqual({ mode: "safe" });
expect((await app.inject({ method: "PUT", url: "/mode", payload: { mode: "custom" } })).statusCode).toBe(400);
expect((await app.inject({ method: "POST", url: "/reset" })).json()).toEqual({ reset: true });
expect((await app.inject({ method: "GET", url: "/source" })).json()).toEqual({ labId: "sql", vulnerable: "v-code", safe: "s-code" });
```

Run: `npx vitest run packages/lab-core/src/common-routes.test.ts`

Expected: FAIL because `registerCommonRoutes` is missing.

- [ ] **Step 5: Implement source allowlisting and common routes**

`createSourceReader(labId: LabId, vulnerableUrl: URL, safeUrl: URL)` closes over the lab ID and those two URLs and accepts no request path. `registerCommonRoutes(app, deps)` registers:

```ts
export interface CommonRouteDeps {
  labId: LabId;
  mode: ModeStore;
  events: EventBus;
  reset(): void | Promise<void>;
  readSource(): Promise<SourcePair>;
}

export async function registerCommonRoutes(app: FastifyInstance, deps: CommonRouteDeps): Promise<void>;
```

The `/source` route rejects every non-empty query object with status 400 before reading either allowlisted file.
The `/mode` route catches the `ModeStore` validation error and returns 400 with `{ error: "mode must be vulnerable or safe" }`; it never delegates that input to Fastify's 500 handler.

For `GET /events`, call `reply.hijack()`, write `Content-Type: text/event-stream`, replay `events.recent()`, subscribe to new events, send a `: heartbeat\n\n` every 15 seconds, and clear heartbeat/subscription on `request.raw.close`. Serialize each message as `data: ${JSON.stringify(event)}\n\n`.

- [ ] **Step 6: Verify runtime behavior and commit**

Run: `npx vitest run packages/lab-core && npm run typecheck`

Expected: all lab-core tests PASS; TypeScript exit 0.

```bash
git add package.json package-lock.json packages/lab-core
git commit -m "feat: add shared lab runtime"
```

---

### Task 3: SQL Injection Vertical Slice

**Files:**
- Create: `apps/sql-lab/package.json`
- Create: `apps/sql-lab/tsconfig.json`
- Create: `apps/sql-lab/src/database.ts`
- Create: `apps/sql-lab/src/lesson.ts`
- Create: `apps/sql-lab/src/handlers/vulnerable.ts`
- Create: `apps/sql-lab/src/handlers/safe.ts`
- Create: `apps/sql-lab/src/app.ts`
- Create: `apps/sql-lab/src/index.ts`
- Test: `apps/sql-lab/src/app.test.ts`

**Interfaces:**
- Consumes: shared contract/runtime.
- Produces: `createSqlLab(options?)`, `/exercise/login`, full common route contract.

- [ ] **Step 1: Write failing vulnerable/safe behavior tests**

Use only these two request bodies:

```ts
import { FIXED_EXERCISES } from "@local-lab/contracts";

export const NORMAL_LOGIN = FIXED_EXERCISES.sql.normal;
export const ATTACK_LOGIN = FIXED_EXERCISES.sql.attack;
```

Test matrix:

```ts
it.each([
  ["vulnerable", NORMAL_LOGIN, "expected", 200],
  ["safe", NORMAL_LOGIN, "expected", 200],
  ["vulnerable", ATTACK_LOGIN, "exploited", 200],
  ["safe", ATTACK_LOGIN, "blocked", 401]
] as const)("mode %s handles the fixed request", async (mode, payload, outcome, status) => {
  await app.inject({ method: "PUT", url: "/mode", payload: { mode } });
  const response = await app.inject({ method: "POST", url: "/exercise/login", payload });
  expect(response.statusCode).toBe(status);
  expect(response.json().outcome).toBe(outcome);
  expect(bus.forTrace(response.json().traceId).length).toBeGreaterThanOrEqual(4);
});
```

Also assert an arbitrary email returns 400 and no trace is executed.

Run: `npx vitest run apps/sql-lab/src/app.test.ts`

Expected: FAIL because `createSqlLab` does not exist.

- [ ] **Step 2: Implement the SQLite seed and two separate handlers**

`database.ts` creates `users(id, email, password, display_name) STRICT`, inserts Alice, Bob and Admin with prepared seed statements, and exposes `reset()`/`close()`.

Use these handler signatures:

```ts
export interface LoginRow { id: number; email: string; display_name: string }
export interface LoginExecution { rows: LoginRow[]; queryDisplay: string }

export function vulnerableLogin(db: DatabaseSync, email: string, password: string): LoginExecution {
  const sql = `SELECT id, email, display_name FROM users WHERE email = '${email}' AND password = '${password}'`;
  return { rows: db.prepare(sql).all() as LoginRow[], queryDisplay: sql.replace(password, "[REDACTED]") };
}

export function safeLogin(db: DatabaseSync, email: string, password: string): LoginExecution {
  const sql = "SELECT id, email, display_name FROM users WHERE email = ? AND password = ?";
  return { rows: db.prepare(sql).all(email, password) as LoginRow[], queryDisplay: `${sql} [${JSON.stringify(email)}, "[REDACTED]"]` };
}
```

- [ ] **Step 3: Implement the app factory and explained events**

`createSqlLab({ databasePath = ":memory:" } = {})` returns `{ app, bus, close }`. It registers common routes, allowlists the two exact bodies, selects the handler from `ModeStore`, and emits in order:

1. `request.received` / API — fixed login request accepted;
2. `query.constructed` / database — command and data were concatenated or separated;
3. `query.executed` / database — row count;
4. `auth.decision` / auth — expected, exploited or blocked.

Return `ExerciseResult<{ authenticated: boolean; user: LoginRow | null }>` and never include the stored password.

- [ ] **Step 4: Verify RED/GREEN semantics, reset and source diff**

Run: `npx vitest run apps/sql-lab/src/app.test.ts && npm run typecheck`

Expected: 4 matrix cases plus validation/reset/source tests PASS.

- [ ] **Step 5: Commit the independently runnable SQL lab**

```bash
git add apps/sql-lab package.json package-lock.json tsconfig.base.json
git commit -m "feat: add sql injection lab"
```

---

### Task 4: Console Workspace and SQL Lesson

**Files:**
- Create: `apps/lab-console/package.json`
- Create: `apps/lab-console/tsconfig.json`
- Create: `apps/lab-console/vite.config.ts`
- Create: `apps/lab-console/index.html`
- Create: `apps/lab-console/src/main.tsx`
- Create: `apps/lab-console/src/App.tsx`
- Create: `apps/lab-console/src/content/scenarios.ts`
- Create: `apps/lab-console/src/lib/lab-api.ts`
- Create: `apps/lab-console/src/lib/experiment-reducer.ts`
- Create: `apps/lab-console/src/components/ScenarioNav.tsx`
- Create: `apps/lab-console/src/components/ExperimentRunner.tsx`
- Create: `apps/lab-console/src/components/Inspector.tsx`
- Create: `apps/lab-console/src/components/SourceDiff.tsx`
- Create: `apps/lab-console/src/components/LabStatus.tsx`
- Create: `apps/lab-console/src/styles.css`
- Test: `apps/lab-console/src/App.test.tsx`

**Interfaces:**
- Consumes: `LabEvent`, `ExerciseResult`, `SourcePair`; SQL HTTP contract.
- Produces: approved three-zone UI and reusable lab API client.

- [ ] **Step 1: Install Vite/React and write the failing console behavior test**

Pin React 19.2.7, Vite 8.1.1, `@vitejs/plugin-react` 6.0.3. In jsdom, mock `fetch` and `EventSource`, then assert:

```tsx
render(<App />);
expect(screen.getByRole("heading", { name: "SQL Injection" })).toBeTruthy();
fireEvent.click(screen.getByRole("button", { name: "Запустить локально" }));
await screen.findByText("Условие SQL стало истинным для нескольких строк");
fireEvent.click(screen.getByRole("button", { name: "Защищённая" }));
expect(screen.getByText("Параметризованный запрос")).toBeTruthy();
```

Run: `npx vitest run --project console apps/lab-console/src/App.test.tsx`

Expected: FAIL because `App` does not exist.

- [ ] **Step 2: Implement API client and deterministic reducer**

```ts
export async function getHealth(labId: LabId, signal?: AbortSignal): Promise<{ status: "ok"; labId: LabId }>;
export async function setMode(labId: LabId, mode: LabMode): Promise<{ mode: LabMode }>;
export async function resetLab(labId: LabId): Promise<void>;
export async function getSource(labId: LabId): Promise<SourcePair>;
export async function runExercise<TBody extends object, TResult extends Record<string, unknown>>(
  labId: LabId, path: string, body: TBody, signal?: AbortSignal
): Promise<ExerciseResult<TResult>>;
export function subscribeToEvents(labId: LabId, onEvent: (event: LabEvent) => void, onError: () => void): () => void;
```

All URLs are built from a closed record `{ sql: "/api/sql", xss: "/api/xss", idor: "/api/idor", csrf: "/api/csrf" }`; no caller supplies a host.

Reducer states are `checking | ready | running | complete | infrastructure-error | stream-incomplete`. `RUN_SUCCEEDED` retains only events whose `traceId` equals the returned result.

- [ ] **Step 3: Build the approved workspace**

`App.tsx` composes navigation, runner and inspector without embedding data-fetching logic. Use one source of scenario copy:

```ts
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
```

Initial inspector tabs: `Ответ`, `Логи`, `Diff`. Each log renders timestamp, source, observation, explanation and optional result.

- [ ] **Step 4: Implement the full visual system, not a placeholder dashboard**

`styles.css` starts with these stable tokens and layout rules:

```css
:root {
  color-scheme: dark;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  background: #090e16;
  color: #e7edf5;
  --surface: #0f1722;
  --surface-raised: #151f2d;
  --line: #273548;
  --muted: #8996a8;
  --accent: #67e8f9;
  --danger: #fb7185;
}

.app-shell { min-height: 100svh; display: grid; grid-template-rows: 56px 1fr; }
.workspace { display: grid; grid-template-columns: 208px minmax(420px, 1fr) 340px; min-height: 0; }
.scenario-nav { border-right: 1px solid var(--line); background: #0c131d; }
.experiment { padding: clamp(24px, 4vw, 52px); overflow: auto; }
.inspector { border-left: 1px solid var(--line); background: #0c131d; overflow: auto; }
.mode-button[aria-pressed="true"] { color: var(--danger); background: #3a1d27; }
.mode-button.safe[aria-pressed="true"] { color: var(--accent); background: #12333b; }
@media (max-width: 900px) {
  .workspace { grid-template-columns: 1fr; }
  .scenario-nav, .inspector { border: 0; border-bottom: 1px solid var(--line); }
}
@media (prefers-reduced-motion: no-preference) {
  .log-entry { animation: log-in 180ms ease-out both; }
  @keyframes log-in { from { opacity: 0; transform: translateY(6px); } }
}
```

Add a 160ms inspector tab transition and a request-running progress line; do not add gradients, card mosaics or fake terminal rain.

- [ ] **Step 5: Verify console behavior and production build**

Run: `npx vitest run --project console && npm run build --workspace apps/lab-console`

Expected: console tests PASS; Vite outputs `apps/lab-console/dist/index.html` and hashed assets.

- [ ] **Step 6: Commit**

```bash
git add apps/lab-console package.json package-lock.json tsconfig.base.json vitest.config.ts
git commit -m "feat: add security lab console"
```

---

### Task 5: Docker Compose SQL End-to-End Slice

**Files:**
- Create: `.dockerignore`
- Create: `compose.yaml`
- Create: `infra/lab-runtime.Dockerfile`
- Create: `infra/lab-console.Dockerfile`
- Create: `infra/lab-console/nginx.conf`
- Create: `infra/gateway/nginx.conf`
- Test: `scripts/compose-smoke.mjs`

**Interfaces:**
- Consumes: SQL lab on port 3000, console `dist`.
- Produces: loopback gateway at `http://localhost:8080`, internal `labs` network.

- [ ] **Step 1: Write the failing smoke script**

```js
import assert from "node:assert/strict";

const health = await fetch("http://127.0.0.1:8080/api/sql/health").then((r) => r.json());
assert.deepEqual(health, { status: "ok", labId: "sql" });

const root = await fetch("http://127.0.0.1:8080/");
assert.equal(root.status, 200);
assert.match(await root.text(), /LOCAL\/LAB/);
```

Run: `node scripts/compose-smoke.mjs`

Expected: FAIL with connection refused because Compose is absent.

- [ ] **Step 2: Build runtime and console images**

`infra/lab-runtime.Dockerfile` uses `node:24-alpine`, `npm ci`, copies the full workspace and runs a service-specific command supplied by Compose. Set `NODE_ENV=production` only after installation so `tsx` remains present.

`infra/lab-console.Dockerfile` uses a Node build stage to run `npm ci` and `npm run build --workspace apps/lab-console`, then copies `dist` into `nginx:1.29-alpine`. The console container exposes only port 8080 to the internal network.

- [ ] **Step 3: Add the initial Compose topology**

Create services `sql-lab`, `lab-console`, and `gateway`. Only gateway has:

```yaml
ports:
  - "127.0.0.1:8080:8080"
```

`sql-lab` command is `npx tsx apps/sql-lab/src/index.ts`, uses `/data/sql.sqlite`, has a Node-fetch healthcheck, and joins only:

```yaml
networks:
  labs:
    internal: true
```

Gateway joins `edge` and `labs`. `depends_on` waits for `service_healthy` on console and SQL.

- [ ] **Step 4: Add fixed Nginx routes and SSE settings**

```nginx
server {
  listen 8080;
  location = /healthz { return 200 "ok\n"; }
  location /api/sql/ {
    proxy_pass http://sql-lab:3000/;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_cache off;
    proxy_set_header Connection "";
  }
  location / { proxy_pass http://lab-console:8080; }
}
```

No regex proxy, resolver-based proxy, variable upstream or user-controlled destination is allowed.

- [ ] **Step 5: Verify the one-command slice**

Run: `docker compose config && docker compose up --build -d --wait && node scripts/compose-smoke.mjs`

Expected: Compose config exit 0; all three services healthy; smoke script exit 0.

Run: `docker compose ps --format json`

Expected: only `gateway` reports a published host port, bound to `127.0.0.1`.

- [ ] **Step 6: Tear down and commit**

Run: `docker compose down -v`

```bash
git add .dockerignore compose.yaml infra scripts/compose-smoke.mjs
git commit -m "feat: run sql lab through local compose gateway"
```

---

### Task 6: Stored XSS Lab

**Files:**
- Create: `apps/xss-lab/package.json`
- Create: `apps/xss-lab/tsconfig.json`
- Create: `apps/xss-lab/src/database.ts`
- Create: `apps/xss-lab/src/lesson.ts`
- Create: `apps/xss-lab/src/handlers/vulnerable.ts`
- Create: `apps/xss-lab/src/handlers/safe.ts`
- Create: `apps/xss-lab/src/app.ts`
- Create: `apps/xss-lab/src/index.ts`
- Test: `apps/xss-lab/src/app.test.ts`
- Modify: `compose.yaml`
- Modify: `infra/gateway/nginx.conf`

**Interfaces:**
- Consumes: common routes/events.
- Produces: `/exercise/comment`, `/render`, `/exercise/browser-event`, harmless iframe document.

- [ ] **Step 1: Write the failing XSS matrix**

Fixed content:

```ts
import { FIXED_EXERCISES } from "@local-lab/contracts";

export const NORMAL_COMMENT = FIXED_EXERCISES.xss.normal;
export const ATTACK_COMMENT = FIXED_EXERCISES.xss.attack;
```

Assert normal and attack comments can be stored in both modes. For `GET /render?traceId=...`, assert vulnerable HTML contains the real `<img` and safe HTML contains `&lt;img`. Assert any other content returns 400.

Run: `npx vitest run apps/xss-lab/src/app.test.ts`

Expected: FAIL because the XSS app does not exist.

- [ ] **Step 2: Implement SQLite comments and context-specific rendering**

Create `comments(id, body, created_at) STRICT`. Both modes store the same fixed value. Separate render handlers:

```ts
export const vulnerableRender = (comments: CommentRow[]) =>
  comments.map((comment) => `<li>${comment.body}</li>`).join("");

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
export const safeRender = (comments: CommentRow[]) =>
  comments.map((comment) => `<li>${escapeHtml(comment.body)}</li>`).join("");
```

- [ ] **Step 3: Implement events and harmless browser acknowledgement**

`POST /exercise/comment` emits storage and render-intent events and returns a trace. `/render` returns a complete minimal HTML document. `POST /exercise/browser-event` accepts only `{ type: "lab-xss", traceId: UUID }`, verifies the trace exists, and emits `renderer.script-executed`; it cannot accept script or URL fields.

- [ ] **Step 4: Verify, add the service and route**

Run: `npx vitest run apps/xss-lab/src/app.test.ts && npm run typecheck`

Expected: mode/render/validation/reset/source tests PASS.

Add `xss-lab` to Compose on internal `labs`; proxy only `/api/xss/` to it. Extend smoke script with `/api/xss/health`.

Run: `docker compose up --build -d --wait && node scripts/compose-smoke.mjs`

Expected: SQL and XSS health checks PASS.

- [ ] **Step 5: Tear down and commit**

```bash
docker compose down -v
git add apps/xss-lab compose.yaml infra/gateway/nginx.conf scripts/compose-smoke.mjs package-lock.json
git commit -m "feat: add stored xss lab"
```

---

### Task 7: IDOR Lab

**Files:**
- Create: `apps/idor-lab/package.json`
- Create: `apps/idor-lab/tsconfig.json`
- Create: `apps/idor-lab/src/database.ts`
- Create: `apps/idor-lab/src/lesson.ts`
- Create: `apps/idor-lab/src/handlers/vulnerable.ts`
- Create: `apps/idor-lab/src/handlers/safe.ts`
- Create: `apps/idor-lab/src/app.ts`
- Create: `apps/idor-lab/src/index.ts`
- Test: `apps/idor-lab/src/app.test.ts`
- Modify: `compose.yaml`
- Modify: `infra/gateway/nginx.conf`

**Interfaces:**
- Consumes: common runtime and `@fastify/cookie`.
- Produces: `/exercise/session`, `/exercise/documents/:id` with fixed IDs `doc-alice`/`doc-bob`.

- [ ] **Step 1: Install cookie parsing and write the failing authorization matrix**

Pin `@fastify/cookie` 11.1.2. Seed Alice, Bob, `doc-alice`, `doc-bob`.

Import the session user and document IDs from `FIXED_EXERCISES.idor`; the route rejects every other ID.

```ts
it.each([
  ["vulnerable", "doc-alice", 200, "expected"],
  ["safe", "doc-alice", 200, "expected"],
  ["vulnerable", "doc-bob", 200, "exploited"],
  ["safe", "doc-bob", 404, "blocked"]
] as const)("%s access to %s", async (mode, documentId, status, outcome) => {
  const cookie = await loginAsAlice(app);
  await setMode(app, mode);
  const response = await app.inject({ method: "GET", url: `/exercise/documents/${documentId}`, headers: { cookie } });
  expect(response.statusCode).toBe(status);
  expect(response.json().outcome).toBe(outcome);
});
```

Run: `npx vitest run apps/idor-lab/src/app.test.ts`

Expected: FAIL because `createIdorLab` is missing.

- [ ] **Step 2: Implement authentication separately from authorization**

`POST /exercise/session` accepts only `{ user: "alice" }`, sets `idor_session=alice` with `httpOnly: true`, `sameSite: "lax"`, `path: "/api/idor"`.

```ts
export function vulnerableRead(db: DatabaseSync, documentId: string, _userId: string): DocumentRow | undefined {
  return db.prepare("SELECT id, owner_id, title, body FROM documents WHERE id = ?").get(documentId) as DocumentRow | undefined;
}

export function safeRead(db: DatabaseSync, documentId: string, userId: string): DocumentRow | undefined {
  return db.prepare("SELECT id, owner_id, title, body FROM documents WHERE id = ? AND owner_id = ?")
    .get(documentId, userId) as DocumentRow | undefined;
}
```

Emit distinct `auth.session-accepted` and `authorization.owner-check` events so the lesson never conflates authentication and authorization.

- [ ] **Step 3: Verify and integrate**

Run: `npx vitest run apps/idor-lab/src/app.test.ts && npm run typecheck`

Expected: four matrix cases, missing-cookie, allowlist, reset and source tests PASS.

Add internal `idor-lab`, `/api/idor/` proxy, health and reset smoke checks.

Run: `docker compose up --build -d --wait && node scripts/compose-smoke.mjs`

Expected: SQL, XSS and IDOR health checks PASS.

- [ ] **Step 4: Tear down and commit**

```bash
docker compose down -v
git add apps/idor-lab compose.yaml infra/gateway/nginx.conf scripts/compose-smoke.mjs package-lock.json
git commit -m "feat: add idor authorization lab"
```

---

### Task 8: CSRF Victim and Attacker Origins

**Files:**
- Create: `apps/csrf-lab/package.json`
- Create: `apps/csrf-lab/tsconfig.json`
- Create: `apps/csrf-lab/src/database.ts`
- Create: `apps/csrf-lab/src/lesson.ts`
- Create: `apps/csrf-lab/src/handlers/vulnerable.ts`
- Create: `apps/csrf-lab/src/handlers/safe.ts`
- Create: `apps/csrf-lab/src/app.ts`
- Create: `apps/csrf-lab/src/index.ts`
- Test: `apps/csrf-lab/src/app.test.ts`
- Create: `apps/csrf-attacker/package.json`
- Create: `apps/csrf-attacker/tsconfig.json`
- Create: `apps/csrf-attacker/src/app.ts`
- Create: `apps/csrf-attacker/src/index.ts`
- Test: `apps/csrf-attacker/src/app.test.ts`
- Modify: `compose.yaml`
- Modify: `infra/gateway/nginx.conf`

**Interfaces:**
- Consumes: common runtime and cookie parsing.
- Produces: victim API on origin `localhost:8080`; fixed attacker page on `localhost:8081`.

- [ ] **Step 1: Write the failing CSRF behavior tests**

Test login sets `csrf_session` with `HttpOnly` and `SameSite=Lax`. With that cookie:

```ts
it.each([
  ["vulnerable", false, 200, "exploited"],
  ["safe", false, 403, "blocked"],
  ["safe", true, 200, "expected"]
] as const)("%s mode checks synchronizer token", async (mode, includeToken, status, outcome) => {
  const response = await submitEmailChange({ app, mode, includeToken });
  expect(response.statusCode).toBe(status);
  expect(response.json().outcome).toBe(outcome);
});
```

`submitEmailChange()` logs in, reads the real current token from `/exercise/form` only when `includeToken` is true, and submits the same fixed email body in every case.

The attacker-page test asserts its HTML contains a fixed form action `http://localhost:8080/api/csrf/exercise/email`, a fixed email, no token input, and no `fetch`/XHR code that could read the victim response.

Run: `npx vitest run apps/csrf-lab apps/csrf-attacker`

Expected: FAIL because both factories are absent.

- [ ] **Step 2: Implement victim session and synchronizer token**

Add a narrow `application/x-www-form-urlencoded` parser using `URLSearchParams`; reject all other keys. Session state is a fixed in-memory record `{ userId: "alice", csrfToken: randomUUID() }` reset with the DB.

Both legitimate and attack email values come from `FIXED_EXERCISES.csrf`; no request may supply a third value.

```ts
export const vulnerableChangeEmail = (_expectedToken: string, _providedToken: string | undefined) => true;
export const safeChangeEmail = (expectedToken: string, providedToken: string | undefined) =>
  providedToken !== undefined && providedToken === expectedToken;
```

Routes: `POST /exercise/login`, `GET /exercise/profile`, `GET /exercise/form`, `POST /exercise/email`. Emit browser-origin, session-cookie, token-decision and mutation events. Do not enable CORS.

- [ ] **Step 3: Implement the fixed attacker page**

Return one HTML document containing a button and hidden iframe target:

```html
<form action="http://localhost:8080/api/csrf/exercise/email" method="post" target="csrf-result">
  <input type="hidden" name="email" value="attacker-controlled@example.test">
  <button type="submit">Отправить межсайтовый запрос</button>
</form>
<iframe name="csrf-result" title="Ответ сайта-жертвы"></iframe>
```

The page explains that it can submit the form but cannot inspect the iframe because port 8080 is another origin. It never accepts a target URL.
The attacker app also exposes `GET /health` returning `{ status: "ok", service: "csrf-attacker" }` for its Compose healthcheck.

- [ ] **Step 4: Verify two-origin behavior and integrate**

Run: `npx vitest run apps/csrf-lab apps/csrf-attacker && npm run typecheck`

Expected: victim and attacker tests PASS.

Add both services to internal `labs`. Gateway publishes a second loopback port:

```yaml
ports:
  - "127.0.0.1:8080:8080"
  - "127.0.0.1:8081:8081"
```

Port 8080 proxies `/api/csrf/` to victim. A separate Nginx `server { listen 8081; location / { proxy_pass http://csrf-attacker:3000; } }` serves only the attacker app.

- [ ] **Step 5: Verify and commit**

Run: `docker compose up --build -d --wait && node scripts/compose-smoke.mjs`

Expected: all seven services healthy; gateway alone publishes loopback ports 8080/8081.

```bash
docker compose down -v
git add apps/csrf-lab apps/csrf-attacker compose.yaml infra/gateway/nginx.conf scripts/compose-smoke.mjs package-lock.json
git commit -m "feat: add two-origin csrf lab"
```

---

### Task 9: Complete Console Lessons, Diff and Error States

**Files:**
- Modify: `apps/lab-console/src/content/scenarios.ts`
- Modify: `apps/lab-console/src/App.tsx`
- Modify: `apps/lab-console/src/lib/lab-api.ts`
- Modify: `apps/lab-console/src/lib/experiment-reducer.ts`
- Create: `apps/lab-console/src/components/XssPreview.tsx`
- Create: `apps/lab-console/src/components/CsrfExercise.tsx`
- Create: `apps/lab-console/src/components/ResponsePanel.tsx`
- Modify: `apps/lab-console/src/components/ExperimentRunner.tsx`
- Modify: `apps/lab-console/src/components/Inspector.tsx`
- Modify: `apps/lab-console/src/styles.css`
- Test: `apps/lab-console/src/lessons.test.tsx`
- Test: `apps/lab-console/src/errors.test.tsx`

**Interfaces:**
- Consumes: all four lab contracts.
- Produces: full five-step lessons and explicit infrastructure/stream/blocked states.

- [ ] **Step 1: Write failing navigation and lesson tests**

For each scenario, assert the five step labels exist, vulnerable and safe mode can be selected, reset calls the correct closed endpoint, and blocked outcome is rendered as `Защита сработала`, not `Ошибка`.

XSS test dispatches a fixed message:

```ts
window.dispatchEvent(new MessageEvent("message", {
  data: { type: "lab-xss", traceId: "00000000-0000-4000-8000-000000000001" }
}));
expect(fetch).toHaveBeenCalledWith("/api/xss/exercise/browser-event", expect.objectContaining({ method: "POST" }));
```

CSRF test asserts the attacker iframe uses the constant `http://localhost:8081/` and no user input controls it.

Run: `npx vitest run --project console apps/lab-console/src/lessons.test.tsx`

Expected: FAIL because only SQL is present.

- [ ] **Step 2: Add all beginner-first scenario content**

Each manifest includes `whatHappens`, `whyItWorks`, `safePrinciple`, `normalRequest`, `attackRequest`, and five step labels. Required teaching statements:

- SQL: command and data become indistinguishable under string concatenation.
- XSS: stored input becomes executable DOM only when rendered as HTML.
- XSS: CSP is a defense-in-depth layer, not a replacement for contextual output escaping.
- IDOR: authentication answers who; authorization answers whether this user owns this object.
- CSRF: ports 8080 and 8081 are different origins but the same site; SOP/CORS can prevent reading a response while the browser still submits a form, SameSite alone does not block this same-site demonstration, and CORS is not CSRF protection.

- [ ] **Step 3: Add XSS and CSRF controlled surfaces**

`XssPreview` fetches `/api/xss/render?traceId=...`, places the returned fixed document in `<iframe sandbox="allow-scripts" srcDoc={html}>`, accepts only the exact `lab-xss` message shape, and acknowledges execution through the fixed API endpoint.

`CsrfExercise` opens or embeds `http://localhost:8081/`, offers separate legitimate and attack actions, then refetches the victim profile from `/api/csrf/exercise/profile`. It explicitly reports that the attacker origin could not read the mutation response.

- [ ] **Step 4: Implement timeouts and honest partial-state rendering**

All finite requests use `AbortSignal.timeout(8_000)`. Reducer transitions:

```ts
type ExperimentStatus =
  | "checking"
  | "ready"
  | "running"
  | "complete"
  | "infrastructure-error"
  | "exercise-error"
  | "stream-incomplete";
```

Health failure renders `Лаборатория недоступна` plus the exact service name. An SSE error after an HTTP result preserves the response and renders `Журнал неполный`. A safe `blocked` outcome renders as successful learning completion.

- [ ] **Step 5: Verify responsive, accessible behavior and commit**

Run: `npx vitest run --project console && npm run build --workspace apps/lab-console && npm run typecheck`

Expected: all console tests PASS; Vite and TypeScript exit 0.

```bash
git add apps/lab-console
git commit -m "feat: complete guided security lessons"
```

---

### Task 10: Contract Tests, Browser Journeys, Isolation and Documentation

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/contracts/labs.contract.test.ts`
- Create: `tests/e2e/sql.spec.ts`
- Create: `tests/e2e/xss.spec.ts`
- Create: `tests/e2e/idor.spec.ts`
- Create: `tests/e2e/csrf.spec.ts`
- Create: `tests/e2e/errors.spec.ts`
- Modify: `scripts/compose-smoke.mjs`
- Create: `README.md`

**Interfaces:**
- Consumes: finished Compose system.
- Produces: end-to-end evidence for all approved success criteria.

- [ ] **Step 1: Add the shared HTTP contract suite**

Create a factory table for SQL/XSS/IDOR/CSRF and assert every app supports health, mode, invalid mode, idempotent reset, non-empty real source pair and redacted events. The source test confirms the public API has no path parameter; it additionally asserts `/source?path=/etc/passwd` returns 400 and never includes `root:`.

Run: `npx vitest run tests/contracts/labs.contract.test.ts`

Expected: PASS against all four factories.

- [ ] **Step 2: Configure Playwright for Compose**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "narrow", use: { ...devices["Desktop Chrome"], viewport: { width: 760, height: 900 } } }
  ],
  webServer: process.env.PW_SKIP_WEBSERVER ? undefined : {
    command: "docker compose up --build",
    url: "http://127.0.0.1:8080/healthz",
    timeout: 240_000,
    reuseExistingServer: !process.env.CI
  }
});
```

- [ ] **Step 3: Write four complete browser journeys**

Each spec performs normal → attack → logs → safe → repeat → compare. Required assertions:

- SQL: attack authenticates in vulnerable; same payload is blocked in safe; query diff shows placeholders.
- XSS: vulnerable iframe emits `renderer.script-executed`; safe iframe displays literal payload and emits nothing.
- IDOR: Alice reads Bob's document in vulnerable; safe returns protected result; auth and authorization log entries are distinct.
- CSRF: login at port 8080, submit fixed form from port 8081, verify mutation in vulnerable; repeat safe and verify email is unchanged; attacker iframe access throws or remains inaccessible because of SOP.

Run: `npx playwright test --project=chromium`

Expected: four scenario specs PASS.

- [ ] **Step 4: Test error states and narrow layout**

Use Playwright routing to abort `/api/sql/health` and `/api/sql/events`, then assert infrastructure and incomplete-stream messages. At width 760, assert navigation precedes experiment and inspector in DOM order and all three are visible by scrolling.

Run: `npx playwright test tests/e2e/errors.spec.ts --project=narrow`

Expected: error and responsive checks PASS.

- [ ] **Step 5: Strengthen the Compose smoke test**

The script must:

1. fetch all health endpoints;
2. call every reset twice and compare the returned seed summary;
3. run `docker compose ps --format json` and assert only gateway has publishers;
4. assert every publisher has `URL === "127.0.0.1"` and target port 8080 or 8081;
5. run `docker compose exec -T sql-lab node -e` with an HTTP request to `1.1.1.1` and assert it times out/fails on the internal network.

Run: `node scripts/compose-smoke.mjs`

Expected: exit 0 and a summary listing 4 healthy labs, 2 loopback ports, 0 successful egress checks.

- [ ] **Step 6: Write the safe-use README**

README contains, in this order:

1. prominent warning that vulnerable services are intentionally unsafe and local-only;
2. prerequisite: Docker Desktop or Docker Engine with Compose;
3. `docker compose up --build` and `http://localhost:8080`;
4. map of four lessons;
5. reset from UI and `docker compose down -v` for full cleanup;
6. health/occupied-port troubleshooting;
7. verification commands;
8. explicit statement that the system accepts no external target URLs.

- [ ] **Step 7: Run the complete verification chain**

Run:

```bash
npm run typecheck
npm test
npm run build
docker compose up --build -d --wait
PW_SKIP_WEBSERVER=1 npx playwright test
node scripts/compose-smoke.mjs
docker compose down -v
git diff --check
```

Expected: TypeScript exit 0; all Vitest projects PASS; Vite build PASS; all Playwright projects PASS; smoke summary reports 4/4 healthy and egress blocked; clean Compose teardown; no whitespace errors.

- [ ] **Step 8: Commit the verified first version**

```bash
git add README.md playwright.config.ts tests scripts/compose-smoke.mjs
git commit -m "test: verify complete local security lab"
```

---

## Implementation Order and Review Gates

1. Tasks 1–3 establish contracts and one real vulnerable/safe mini-app.
2. Tasks 4–5 produce the first browser-visible, Docker-only vertical slice.
3. Tasks 6–8 add one independently reviewable vulnerability at a time.
4. Task 9 generalizes the console only after all lab contracts are concrete.
5. Task 10 is the release gate; do not call the project complete before every command in Step 7 succeeds from a clean checkout.

After every task, review the staged diff for unrelated changes and keep the task commit isolated. Do not combine a failing lab with the next lab to hide incomplete behavior.
