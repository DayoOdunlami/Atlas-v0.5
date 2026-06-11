import type { EvidenceStateSummaryBlock as T, EvidenceState } from "@/lib/workbench/atlas-render-model";
import { BlockShell } from "../shared/block-shell";
import { WorkbenchRichVisual } from "../workbench-rich-visual";
import {
  buildAtlasVisualBlock,
  usesDominantAtlasVisual,
} from "@/lib/workbench/visual-adapter";
import type { VisualId } from "@/lib/workbench/visual-registry";

const STATE_COLORS: Record<EvidenceState, string> = {
  verified:        "bg-green-500",
  "self-reported": "bg-amber-400",
  inferred:        "bg-sky-400",
  unknown:         "bg-slate-300",
  contested:       "bg-red-400",
};

const STATE_LABELS: Record<EvidenceState, string> = {
  verified:        "Verified",
  "self-reported": "Self-reported",
  inferred:        "Inferred",
  unknown:         "Unknown",
  contested:       "Contested",
};

export function EvidenceStateSummaryBlock({
  block,
  onInspect,
  effectiveVisual,
}: {
  block: T;
  onInspect: (key: string) => void;
  effectiveVisual: VisualId;
}) {
  const c = block.content;
  const states: EvidenceState[] = ["verified", "self-reported", "inferred", "unknown", "contested"];
  const total = c.total_claims || 1;
  const atlasVisual = buildAtlasVisualBlock(block, effectiveVisual);
  const dominant = usesDominantAtlasVisual(block.type, effectiveVisual);

  return (
    <BlockShell headline={block.headline}>
      {dominant && atlasVisual && (
        <div className="mb-4">
          <WorkbenchRichVisual visual={atlasVisual} />
        </div>
      )}
      {/* Stacked bar */}
      <div className="flex h-5 w-full rounded overflow-hidden gap-px mb-3">
        {states.map((s) => {
          const count = c.counts[s] ?? 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={s}
              title={`${STATE_LABELS[s]}: ${count}`}
              className={`${STATE_COLORS[s]} transition-all`}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
        {states.map((s) => {
          const count = c.counts[s] ?? 0;
          if (count === 0) return null;
          return (
            <span key={s} className="flex items-center gap-1">
              <span className={`inline-block w-2 h-2 rounded-sm ${STATE_COLORS[s]}`} />
              {STATE_LABELS[s]}: {count}
            </span>
          );
        })}
        <span className="ml-auto font-medium text-foreground">{total} claims total</span>
      </div>

      {/* Cap reason — clickable */}
      <button
        onClick={() => onInspect("confidence")}
        className="text-left w-full rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
      >
        <span className="font-medium text-foreground">Why confidence is capped: </span>
        {c.cap_reason}
      </button>
    </BlockShell>
  );
}
