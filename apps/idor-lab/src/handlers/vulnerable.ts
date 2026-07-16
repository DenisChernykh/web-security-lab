import type { DatabaseSync } from "node:sqlite";
import type { DocumentRow } from "../database.js";

export function vulnerableRead(
  db: DatabaseSync,
  documentId: string,
  _userId: string
): DocumentRow | undefined {
  return db.prepare("SELECT id, owner_id, title, body FROM documents WHERE id = ?")
    .get(documentId) as DocumentRow | undefined;
}
