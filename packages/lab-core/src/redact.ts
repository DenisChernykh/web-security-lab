import { REDACTED_KEYS } from "@local-lab/contracts";

const redactedKeys = new Set(REDACTED_KEYS.map((key) => key.toLowerCase()));

const isPlainObject = (value: object): value is Record<string, unknown> => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }

  if (value === null || typeof value !== "object" || !isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      redactedKeys.has(key.toLowerCase()) ? "[REDACTED]" : redact(nestedValue)
    ])
  );
}
