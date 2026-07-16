import type { DatabaseSync } from "node:sqlite";

export interface LoginRow {
  id: number;
  email: string;
  display_name: string;
}

export interface LoginExecution {
  rows: LoginRow[];
  queryDisplay: string;
}

export function vulnerableLogin(
  db: DatabaseSync,
  email: string,
  password: string
): LoginExecution {
  const sql = `SELECT id, email, display_name FROM users WHERE email = '${email}' AND password = '${password}'`;
  return {
    rows: db.prepare(sql).all() as unknown as LoginRow[],
    queryDisplay: sql.replace(password, "[REDACTED]")
  };
}
