import type { DatabaseSync } from "node:sqlite";
import type { LoginExecution, LoginRow } from "./vulnerable.js";

export function safeLogin(
  db: DatabaseSync,
  email: string,
  password: string
): LoginExecution {
  const sql = "SELECT id, email, display_name FROM users WHERE email = ? AND password = ?";
  return {
    rows: db.prepare(sql).all(email, password) as unknown as LoginRow[],
    queryDisplay: `${sql} [${JSON.stringify(email)}, "[REDACTED]"]`
  };
}
