export const safeChangeEmail = (expectedToken: string, providedToken: string | undefined) =>
  providedToken !== undefined && providedToken === expectedToken;
