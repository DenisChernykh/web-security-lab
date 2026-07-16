import { randomUUID } from "node:crypto";
import { FIXED_EXERCISES } from "@local-lab/contracts";

export interface CsrfSession {
  userId: "alice";
  csrfToken: string;
}

export interface CsrfProfile {
  userId: "alice";
  email: typeof FIXED_EXERCISES.csrf.normalEmail | typeof FIXED_EXERCISES.csrf.attackEmail;
}

/** Fixed local state for one teaching account; no external database is used. */
export class CsrfLabDatabase {
  #session!: CsrfSession;
  #profile!: CsrfProfile;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.#session = { userId: "alice", csrfToken: randomUUID() };
    this.#profile = { userId: "alice", email: FIXED_EXERCISES.csrf.normalEmail };
  }

  session(): Readonly<CsrfSession> {
    return this.#session;
  }

  profile(): Readonly<CsrfProfile> {
    return this.#profile;
  }

  changeEmail(email: CsrfProfile["email"]): Readonly<CsrfProfile> {
    this.#profile = { userId: "alice", email };
    return this.#profile;
  }
}
