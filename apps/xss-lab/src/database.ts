import { DatabaseSync } from "node:sqlite";

export interface CommentRow {
  id: number;
  body: string;
  created_at: string;
}

const COMMENTS_SCHEMA = `
  CREATE TABLE comments (
    id INTEGER PRIMARY KEY,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT
`;

export class XssLabDatabase {
  readonly connection: DatabaseSync;

  constructor(databasePath = ":memory:") {
    this.connection = new DatabaseSync(databasePath);
    this.reset();
  }

  insert(body: string): CommentRow {
    const createdAt = new Date().toISOString();
    const result = this.connection
      .prepare("INSERT INTO comments (body, created_at) VALUES (?, ?)")
      .run(body, createdAt);

    return { id: Number(result.lastInsertRowid), body, created_at: createdAt };
  }

  list(): CommentRow[] {
    return this.connection
      .prepare("SELECT id, body, created_at FROM comments ORDER BY id")
      .all() as unknown as CommentRow[];
  }

  reset(): void {
    this.connection.exec("DROP TABLE IF EXISTS comments");
    this.connection.exec(COMMENTS_SCHEMA);
  }

  close(): void {
    this.connection.close();
  }
}
