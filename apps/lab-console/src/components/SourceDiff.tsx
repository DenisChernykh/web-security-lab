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
      <div className="source-pair">
        <section><h3>Уязвимая</h3><pre><code>{source.vulnerable}</code></pre></section>
        <section><h3>Защищённая</h3><pre><code>{source.safe}</code></pre></section>
      </div>
    </div>
  );
}
