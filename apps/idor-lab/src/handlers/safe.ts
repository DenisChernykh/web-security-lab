import type { DatabaseSync } from "node:sqlite";
import type { DocumentRow } from "../database.js";

export function safeRead(
  db: DatabaseSync,
  documentId: string,
  userId: string
): DocumentRow | undefined {
  return db.prepare("SELECT id, owner_id, title, body FROM documents WHERE id = ? AND owner_id = ?")
    .get(documentId, userId) as DocumentRow | undefined;
}
