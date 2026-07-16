import type { ExerciseResult, LabEvent, LabId, LabMode, SourcePair } from "@local-lab/contracts";

const LAB_BASE_PATHS: Record<LabId, string> = {
  sql: "/api/sql",
  xss: "/api/xss",
  idor: "/api/idor",
  csrf: "/api/csrf"
};

const EXERCISE_PATHS: Record<LabId, readonly string[]> = {
  sql: ["/exercise/login"],
  xss: ["/exercise/comment", "/exercise/browser-event"],
  idor: ["/exercise/session", "/exercise/documents/doc-bob"],
  csrf: ["/exercise/login", "/exercise/email", "/exercise/form", "/exercise/profile"]
};

const timeoutSignal = (): AbortSignal => AbortSignal.timeout(8_000);

function urlFor(labId: LabId, path: string): string {
  return `${LAB_BASE_PATHS[labId]}${path}`;
}

function assertExercisePath(labId: LabId, path: string): void {
  if (!EXERCISE_PATHS[labId].includes(path)) {
    throw new TypeError("exercise path is not allowed for this lab");
  }
}

async function requestJson<TResult>(
  labId: LabId,
  path: string,
  init?: RequestInit
): Promise<TResult> {
  const response = await fetch(urlFor(labId, path), { ...init, signal: init?.signal ?? timeoutSignal() });
  if (!response.ok) {
    throw new Error(`Lab request failed with ${response.status}`);
  }
  return response.json() as Promise<TResult>;
}

export async function getHealth(
  labId: LabId,
  signal?: AbortSignal
): Promise<{ status: "ok"; labId: LabId }> {
  return requestJson(labId, "/health", signal === undefined ? undefined : { signal });
}

export async function setMode(labId: LabId, mode: LabMode): Promise<{ mode: LabMode }> {
  return requestJson(labId, "/mode", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode }), signal: timeoutSignal()
  });
}

export const getMode = (labId: LabId): Promise<{ mode: LabMode }> =>
  requestJson(labId, "/mode", { signal: timeoutSignal() });

export async function resetLab(labId: LabId): Promise<void> {
  const response = await fetch(urlFor(labId, "/reset"), { method: "POST", signal: timeoutSignal() });
  if (!response.ok) {
    throw new Error(`Lab reset failed with ${response.status}`);
  }
}

export async function getSource(labId: LabId): Promise<SourcePair> {
  return requestJson(labId, "/source", { signal: timeoutSignal() });
}

export async function runExercise<TBody extends object, TResult extends Record<string, unknown>>(
  labId: LabId,
  path: string,
  body: TBody,
  signal?: AbortSignal
): Promise<ExerciseResult<TResult>> {
  assertExercisePath(labId, path);
  const response = await fetch(urlFor(labId, path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: signal ?? timeoutSignal()
  });
  return response.json() as Promise<ExerciseResult<TResult>>;
}

export async function runFixedExercise(
  labId: LabId,
  body: Record<string, unknown>
): Promise<ExerciseResult> {
  if (labId === "sql" || labId === "xss") {
    return runExercise(labId, labId === "sql" ? "/exercise/login" : "/exercise/comment", body);
  }
  if (labId === "idor") {
    await requestJson(labId, "/exercise/session", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ user: "alice" }), credentials: "same-origin", signal: timeoutSignal()
    });
    const documentId = body.documentId === "doc-alice" ? "doc-alice" : "doc-bob";
    return requestExerciseResult(labId, `/exercise/documents/${documentId}`, { credentials: "same-origin", signal: timeoutSignal() });
  }
  await requestJson(labId, "/exercise/login", { method: "POST", credentials: "same-origin", signal: timeoutSignal() });
  return requestExerciseResult(labId, "/exercise/email", {
    method: "POST", credentials: "same-origin",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: String(body.email) }), signal: timeoutSignal()
  });
}

async function requestExerciseResult(labId: LabId, path: string, init: RequestInit): Promise<ExerciseResult> {
  const response = await fetch(urlFor(labId, path), init);
  const body: unknown = await response.json();
  if (body !== null && typeof body === "object" && "outcome" in body && "traceId" in body) {
    return body as ExerciseResult;
  }
  throw new Error(`Lab exercise failed with ${response.status}`);
}

export const acknowledgeXss = (traceId: string): Promise<{ acknowledged: true }> =>
  requestJson("xss", "/exercise/browser-event", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "lab-xss", traceId }), signal: timeoutSignal()
  });

export const renderXss = async (traceId: string): Promise<string> => {
  const response = await fetch(`${LAB_BASE_PATHS.xss}/render?traceId=${encodeURIComponent(traceId)}`, { signal: timeoutSignal() });
  if (!response.ok) throw new Error(`XSS render failed with ${response.status}`);
  return response.text();
};

export const getCsrfAttackerOrigin = (): Promise<{ origin: string }> =>
  requestJson("csrf", "/exercise/attacker-origin", { signal: timeoutSignal() });

export const csrfLogin = (): Promise<{ session: "accepted" }> => requestJson("csrf", "/exercise/login", {
  method: "POST", credentials: "same-origin", signal: timeoutSignal()
});

export const getCsrfForm = (): Promise<{ csrfToken: string }> => requestJson("csrf", "/exercise/form", {
  credentials: "same-origin", signal: timeoutSignal()
});

export const getCsrfProfile = (): Promise<{ profile: { email: string } }> => requestJson("csrf", "/exercise/profile", {
  credentials: "same-origin", signal: timeoutSignal()
});

export const submitLegitimateCsrfChange = (email: string, csrfToken: string): Promise<ExerciseResult> =>
  requestExerciseResult("csrf", "/exercise/email", {
    method: "POST", credentials: "same-origin", signal: timeoutSignal(),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, csrfToken })
  });

export function subscribeToEvents(
  labId: LabId,
  onEvent: (event: LabEvent) => void,
  onError: () => void
): () => void {
  const source = new EventSource(urlFor(labId, "/events"));
  source.onmessage = (message) => {
    try {
      const event: unknown = JSON.parse(message.data);
      if (isLabEventFor(event, labId)) {
        onEvent(event);
      }
    } catch {
      onError();
    }
  };
  source.onerror = onError;
  return () => source.close();
}

function isLabEventFor(value: unknown, labId: LabId): value is LabEvent {
  return value !== null && typeof value === "object" && "labId" in value && value.labId === labId &&
    "traceId" in value && typeof value.traceId === "string" &&
    "observation" in value && typeof value.observation === "string";
}
