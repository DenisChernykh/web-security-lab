import type { CommentRow } from "../database.js";

const escapeHtml = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

export const safeRender = (comments: CommentRow[]): string =>
  comments.map((comment) => `<li>${escapeHtml(comment.body)}</li>`).join("");
