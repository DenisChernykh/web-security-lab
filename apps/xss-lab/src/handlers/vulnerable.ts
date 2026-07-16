import type { CommentRow } from "../database.js";

export const vulnerableRender = (comments: CommentRow[]): string =>
  comments.map((comment) => `<li>${comment.body}</li>`).join("");
