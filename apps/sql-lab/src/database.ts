import { DatabaseSync } from "node:sqlite";

const USERS_SCHEMA = `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL
  ) STRICT
`;

const SEED_USERS = [
  [1, "alice@example.test", "correct-horse", "Alice"],
  [2, "bob@example.test", "pocket-sand", "Bob"],
  [3, "admin@example.test", "admin-password", "Admin"]
] as const;

export class SqlLabDatabase {
  readonly connection: DatabaseSync;

  constructor(databasePath = ":memory:") {
    this.connection = new DatabaseSync(databasePath);
    this.reset();
  }

  reset(): void {
    this.connection.exec("DROP TABLE IF EXISTS users");
    this.connection.exec(USERS_SCHEMA);

    const insert = this.connection.prepare(
      "INSERT INTO users (id, email, password, display_name) VALUES (?, ?, ?, ?)"
    );
    for (const user of SEED_USERS) {
      insert.run(...user);
    }
  }

  close(): void {
    this.connection.close();
  }
}
