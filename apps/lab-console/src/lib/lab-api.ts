import type { ExerciseResult, LabEvent, LabId, LabMode, SourcePair } from "@local-lab/contracts";

const LAB_BASE_PATHS: Record<LabId, string> = {
  sql: "/api/sql",
  xss: "/api/xss",
  idor: "/api/idor",
  csrf: "/api/csrf"
};

const EXERCISE_PATHS: Record<LabId, readonly string[]> = {
  sql: ["/exercise/login"],
  xss: [],
  idor: [],
  csrf: []
};

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
  const response = await fetch(urlFor(labId, path), init);
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
    body: JSON.stringify({ mode })
  });
}

export async function resetLab(labId: LabId): Promise<void> {
  const response = await fetch(urlFor(labId, "/reset"), { method: "POST" });
  if (!response.ok) {
    throw new Error(`Lab reset failed with ${response.status}`);
  }
}

export async function getSource(labId: LabId): Promise<SourcePair> {
  return requestJson(labId, "/source");
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
    ...(signal === undefined ? {} : { signal })
  });
  return response.json() as Promise<ExerciseResult<TResult>>;
}

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
