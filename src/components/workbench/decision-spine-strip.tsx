import type { DecisionSpine } from "@/lib/workbench/atlas-render-model";
import { ConfidenceTierBadge } from "./shared/confidence-tier-badge";

interface Props {
  spine: DecisionSpine;
  onInspectConfidence: () => void;
}

export function DecisionSpineStrip({ spine, onInspectConfidence }: Props) {
  const pct = Math.round(spine.score * 100);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      {/* Decision */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">Decision</p>
        <p className="text-sm font-semibold leading-snug text-amber-700">{spine.decision}</p>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{spine.recommendation}</p>
      </div>

      {/* Confidence */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">Confidence</p>
        <ConfidenceTierBadge
          tier={spine.confidence_tier}
          onClick={onInspectConfidence}
        />
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{spine.confidence_cap_reason}</p>
      </div>

      {/* Score / value */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">Score / value</p>
        <p className="text-2xl font-bold text-indigo-600">{pct}%</p>
        {spine.economic_gap_value !== undefined && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Gap value est: £{spine.economic_gap_value.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
