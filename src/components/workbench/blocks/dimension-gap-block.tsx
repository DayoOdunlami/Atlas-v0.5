import type { DimensionGapBlock as T, GapItem, GapMagnitude } from "@/lib/workbench/atlas-render-model";
import { BlockShell } from "../shared/block-shell";
import { BlockSkeletonDimensionGap } from "../shared/block-skeleton";
import { WorkbenchRichVisual } from "../workbench-rich-visual";
import {
  buildAtlasVisualBlock,
  usesDominantAtlasVisual,
} from "@/lib/workbench/visual-adapter";
import type { VisualId } from "@/lib/workbench/visual-registry";
import { cn } from "@/lib/utils";

const MAG_ORDER: GapMagnitude[] = ["large", "medium", "small", "unknown"];

const MAG_BADGE: Record<GapMagnitude, string> = {
  large:   "bg-red-50   text-red-700   border-red-200",
  medium:  "bg-amber-50 text-amber-700 border-amber-200",
  small:   "bg-slate-50 text-slate-600 border-slate-200",
  unknown: "bg-slate-50 text-slate-400 border-slate-200",
};

const SEV_DOT: Record<string, string> = {
  significant: "bg-red-400",
  minor:       "bg-amber-300",
  critical:    "bg-red-600",
};

// Sort: large+significant first, then magnitude, then severity
function sortGaps(gaps: GapItem[]): GapItem[] {
  return [...gaps].sort((a, b) => {
    const ma = MAG_ORDER.indexOf(a.magnitude);
    const mb = MAG_ORDER.indexOf(b.magnitude);
    if (ma !== mb) return ma - mb;
    const sa = a.severity === "significant" ? 0 : 1;
    const sb = b.severity === "significant" ? 0 : 1;
    return sa - sb;
  });
}

export function DimensionGapBlock({
  block,
  onInspect,
  loading = false,
  effectiveVisual,
}: {
  block: T;
  onInspect: (key: string) => void;
  loading?: boolean;
  effectiveVisual: VisualId;
}) {
  if (loading) return <BlockSkeletonDimensionGap />;

  const sorted = sortGaps(block.content);
  const atlasVisual = buildAtlasVisualBlock(block, effectiveVisual);
  const dominant = usesDominantAtlasVisual(block.type, effectiveVisual);

  return (
    <BlockShell headline={block.headline}>
      {dominant && atlasVisual && (
        <div className="mb-4">
          <WorkbenchRichVisual visual={atlasVisual} />
        </div>
      )}
      <div className="divide-y divide-border">
        {sorted.map((gap) => (
          <div
            key={gap.id}
            className="py-3 first:pt-0 last:pb-0"
          >
            <div className="flex items-start gap-2 mb-1">
              {/* Magnitude badge */}
              <span
                className={cn(
                  "shrink-0 inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium capitalize",
                  MAG_BADGE[gap.magnitude],
                )}
              >
                {gap.magnitude}
              </span>

              {/* Severity dot + title */}
              <button
                onClick={() => onInspect(gap.id)}
                className="flex items-center gap-1.5 text-left text-sm font-medium hover:underline underline-offset-2"
              >
                <span className={cn("w-2 h-2 rounded-full shrink-0 mt-0.5", SEV_DOT[gap.severity] ?? "bg-slate-300")} />
                {gap.title}
              </button>

              <span className="ml-auto shrink-0 text-xs text-muted-foreground capitalize">{gap.severity}</span>
            </div>

            <p className="text-sm text-muted-foreground pl-1 leading-relaxed">{gap.description}</p>

            {gap.what_would_change && (
              <p className="mt-1 pl-1 text-xs text-sky-700 bg-sky-50 border border-sky-100 rounded px-2 py-1">
                <span className="font-medium">Would change if: </span>
                {gap.what_would_change}
              </p>
            )}
          </div>
        ))}
      </div>
    </BlockShell>
  );
}
