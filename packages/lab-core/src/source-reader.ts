import { readFile } from "node:fs/promises";
import type { LabId, SourcePair } from "@local-lab/contracts";

export function createSourceReader(labId: LabId, vulnerableUrl: URL, safeUrl: URL) {
  return async (): Promise<SourcePair> => {
    const [vulnerable, safe] = await Promise.all([
      readFile(vulnerableUrl, "utf8"),
      readFile(safeUrl, "utf8")
    ]);

    return { labId, vulnerable, safe };
  };
}
