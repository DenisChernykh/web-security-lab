import type { LabMode, SourcePair } from "@local-lab/contracts";

interface SourceDiffProps {
  mode: LabMode;
  source?: SourcePair | undefined;
}

export function SourceDiff({ mode, source }: SourceDiffProps) {
  if (source === undefined) {
    return <p className="empty-state">Исходный код загружается из локальной лаборатории.</p>;
  }

  return (
    <div className="source-diff">
      <p>Активная реализация: <strong>{mode === "safe" ? "защищённая" : "уязвимая"}</strong></p>
      <pre><code>{source[mode]}</code></pre>
    </div>
  );
}
