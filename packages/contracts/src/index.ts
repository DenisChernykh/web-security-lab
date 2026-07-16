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
    attack: `<img src="x" alt="" onerror="parent.postMessage({type:'lab-xss',traceId:document.documentElement.dataset.traceId},'*')">`
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
