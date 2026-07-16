import { DatabaseSync } from "node:sqlite";

export interface DocumentRow {
  id: string;
  owner_id: string;
  title: string;
  body: string;
}

const USERS_SCHEMA = `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL
  ) STRICT
`;

const DOCUMENTS_SCHEMA = `
  CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL
  ) STRICT
`;

const USERS = [
  ["alice", "Alice"],
  ["bob", "Bob"]
] as const;

const DOCUMENTS = [
  ["doc-alice", "alice", "Alice's local document", "Only Alice should read this fixed exercise document."],
  ["doc-bob", "bob", "Bob's local document", "Only Bob should read this fixed exercise document."]
] as const;

export class IdorLabDatabase {
  readonly connection: DatabaseSync;

  constructor(databasePath = ":memory:") {
    this.connection = new DatabaseSync(databasePath);
    this.reset();
  }

  reset(): void {
    this.connection.exec("DROP TABLE IF EXISTS documents");
    this.connection.exec("DROP TABLE IF EXISTS users");
    this.connection.exec(USERS_SCHEMA);
    this.connection.exec(DOCUMENTS_SCHEMA);

    const insertUser = this.connection.prepare("INSERT INTO users (id, display_name) VALUES (?, ?)");
    for (const user of USERS) {
      insertUser.run(...user);
    }

    const insertDocument = this.connection.prepare(
      "INSERT INTO documents (id, owner_id, title, body) VALUES (?, ?, ?, ?)"
    );
    for (const document of DOCUMENTS) {
      insertDocument.run(...document);
    }
  }

  close(): void {
    this.connection.close();
  }
}
