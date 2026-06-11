import type { RenderBlock } from "@/lib/workbench/atlas-render-model";
import { validateBlockVisual, selectVisualRecipe } from "@/lib/workbench/visual-registry";
import {
  inferDataShape,
  buildAtlasVisualBlock,
  usesDominantAtlasVisual,
} from "@/lib/workbench/visual-adapter";
import { WorkbenchRichVisual } from "./workbench-rich-visual";
import type { VisualId } from "@/lib/workbench/visual-registry";
import { RecommendationConfidenceBlock } from "./blocks/recommendation-confidence-block";
import { EvidenceStateSummaryBlock } from "./blocks/evidence-state-summary-block";
import { DimensionGapBlock } from "./blocks/dimension-gap-block";
import { MatchBenchBlock } from "./blocks/match-bench-block";
import { ClaimLedgerBlock } from "./blocks/claim-ledger-block";
import { ActionPlanBlock } from "./blocks/action-plan-block";
import { ObjectionResponseBlock } from "./blocks/objection-response-block";
import { ProvenanceTraceBlock } from "./blocks/provenance-trace-block";
import { ComparisonMatrixBlock } from "./blocks/comparison-matrix-block";
import { ContextCardBlock } from "./blocks/context-card-block";
import { EconomicCaseBlock } from "./blocks/economic-case-block";
import { OpportunityListBlock } from "./blocks/opportunity-list-block";
import { NetworkMapBlock } from "./blocks/network-map-block";
import { TransferLanesBlock } from "./blocks/transfer-lanes-block";
import { useWorkbench } from "@/lib/workbench/workbench-context";
import { Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { BlockErrorBoundary } from "./block-error-boundary";

interface Props {
  block: RenderBlock;
  onInspect: (key: string) => void;
  /** When true, renders the skeleton placeholder for this block. */
  loading?: boolean;
}

/**
 * Central block dispatcher.
 *
 * Contract:
 *  1. Validates block.visual against the visual registry (dev warning on mismatch).
 *  2. Resolves the effective visual via selectVisualRecipe() for future Art Director use.
 *  3. Dispatches to the correct block component by block.type.
 *  4. Passes loading prop through so skeleton states can be driven by stream events.
 *
 * When the backend is wired, `loading` will be set to true for blocks whose
 * model_patch has not yet arrived, and false once the patch is committed.
 */
function dispatchBlock(
  block: RenderBlock,
  onInspect: (key: string) => void,
  loading: boolean,
  effectiveVisual: VisualId,
) {
  switch (block.type) {
    case "RecommendationConfidence":
      return <RecommendationConfidenceBlock block={block} onInspect={onInspect} loading={loading} />;
    case "EvidenceStateSummary":
      return <EvidenceStateSummaryBlock block={block} onInspect={onInspect} effectiveVisual={effectiveVisual} />;
    case "DimensionGap":
      return <DimensionGapBlock block={block} onInspect={onInspect} loading={loading} effectiveVisual={effectiveVisual} />;
    case "MatchBench":
      return <MatchBenchBlock block={block} onInspect={onInspect} loading={loading} />;
    case "ClaimLedger":
      return <ClaimLedgerBlock block={block} onInspect={onInspect} loading={loading} />;
    case "ActionPlan":
      return <ActionPlanBlock block={block} />;
    case "ObjectionResponse":
      return <ObjectionResponseBlock block={block} onInspect={onInspect} />;
    case "ProvenanceTrace":
      return <ProvenanceTraceBlock block={block} onInspect={onInspect} />;
    case "ComparisonMatrix":
      return <ComparisonMatrixBlock block={block} effectiveVisual={effectiveVisual} />;
    case "ContextCard":
      return <ContextCardBlock block={block} />;
    case "OpportunityList":
      return <OpportunityListBlock block={block} effectiveVisual={effectiveVisual} />;
    case "NetworkMap":
      return <NetworkMapBlock block={block} effectiveVisual={effectiveVisual} />;
    case "TransferLanes":
      return <TransferLanesBlock block={block} />;
    case "EconomicCase":
      return <EconomicCaseBlock block={block} effectiveVisual={effectiveVisual} />;
    default:
      return (
        <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
          Unknown block type: {(block as RenderBlock).type}
        </div>
      );
  }
}

export function BlockRenderer({ block, onInspect, loading = false }: Props) {
  const { togglePin } = useWorkbench();
  const pinned = (block as RenderBlock & { pinned?: boolean }).pinned ?? false;

  if (process.env.NODE_ENV === "development") {
    const issue = validateBlockVisual(block.type, block.visual);
    if (issue) {
      console.warn(`[BlockRenderer] Visual registry mismatch — ${issue}`);
    }
  }

  const dataShape = inferDataShape(block);
  const effectiveVisual = selectVisualRecipe(block.type, block.visual, dataShape);
  const atlasVisual = buildAtlasVisualBlock(block, effectiveVisual);
  const showRichLayer =
    atlasVisual &&
    usesDominantAtlasVisual(block.type, effectiveVisual) &&
    block.type !== "OpportunityList" &&
    block.type !== "ComparisonMatrix" &&
    block.type !== "DimensionGap" &&
    block.type !== "EvidenceStateSummary" &&
    block.type !== "EconomicCase" &&
    block.type !== "NetworkMap";

  return (
    <div
      className={cn(
        "group/block relative",
        pinned && "ring-1 ring-amber-300/60 rounded-lg",
      )}
    >
      <BlockErrorBoundary blockType={block.type} blockId={block.id}>
        {showRichLayer && (
          <div className="mb-3">
            <WorkbenchRichVisual visual={atlasVisual} />
          </div>
        )}
        {dispatchBlock(block, onInspect, loading, effectiveVisual)}
      </BlockErrorBoundary>
      <button
        type="button"
        onClick={() => togglePin(block.id)}
        title={pinned ? "Unpin — allow agent to edit" : "Pin — require hard confirm to edit"}
        aria-label={pinned ? "Unpin block" : "Pin block"}
        className={cn(
          "absolute top-2 right-2 z-10 flex items-center justify-center",
          "w-6 h-6 rounded-md border text-muted-foreground transition-all",
          pinned
            ? "opacity-100 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
            : "opacity-0 group-hover/block:opacity-100 border-border bg-background hover:bg-muted",
        )}
      >
        {pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
      </button>
    </div>
  );
}
