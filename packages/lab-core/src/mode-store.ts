import { isLabMode, type LabMode } from "@local-lab/contracts";

export class ModeStore {
  #value: LabMode = "vulnerable";

  get(): LabMode {
    return this.#value;
  }

  set(value: unknown): LabMode {
    if (!isLabMode(value)) {
      throw new TypeError("mode must be vulnerable or safe");
    }

    this.#value = value;
    return this.#value;
  }
}
