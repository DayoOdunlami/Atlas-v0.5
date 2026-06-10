import type { RecommendationConfidenceBlock as T } from "@/lib/workbench/atlas-render-model";
import { BlockShell } from "../shared/block-shell";
import { ConfidenceTierBadge } from "../shared/confidence-tier-badge";
import { BlockSkeletonRecommendation } from "../shared/block-skeleton";

export function RecommendationConfidenceBlock({
  block,
  onInspect,
  loading = false,
}: {
  block: T;
  onInspect: (key: string) => void;
  loading?: boolean;
}) {
  if (loading) return <BlockSkeletonRecommendation />;

  const c = block.content;
  const pct = Math.round(c.score * 100);

  return (
    <BlockShell headline={block.headline}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Recommendation */}
        <div className="md:col-span-2 space-y-2">
          <h3 className="text-base font-semibold leading-snug">{c.decision}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{c.summary}</p>
        </div>

        {/* Score + tier */}
        <div className="flex flex-col gap-2 items-start md:items-end">
          <ConfidenceTierBadge
            tier={c.confidence_tier}
            onClick={() => onInspect("confidence")}
          />
          <div className="text-2xl font-bold text-foreground">{pct}%</div>
          <div className="text-xs text-muted-foreground">similarity score</div>
        </div>
      </div>

      {/* Cap reason */}
      <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
        <span className="font-medium">Confidence cap: </span>
        {c.confidence_cap_reason}
      </div>
    </BlockShell>
  );
}
