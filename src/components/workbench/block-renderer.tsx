import type { RenderBlock } from "@/lib/workbench/atlas-render-model";
import { validateBlockVisual, selectVisualRecipe } from "@/lib/workbench/visual-registry";
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
export function BlockRenderer({ block, onInspect, loading = false }: Props) {
  // --- Visual contract validation (dev only) ---
  if (process.env.NODE_ENV === "development") {
    const issue = validateBlockVisual(block.type, block.visual);
    if (issue) {
      console.warn(`[BlockRenderer] Visual registry mismatch — ${issue}`);
    }
  }

  // Resolve effective visual (no-op for now — deterministic primary returned).
  // When Art Director is wired, this will drive visual variant selection.
  const _effectiveVisual = selectVisualRecipe(block.type, block.visual);
  void _effectiveVisual; // suppress unused-var lint until it drives rendering

  // --- Block dispatch ---
  switch (block.type) {
    case "RecommendationConfidence":
      return <RecommendationConfidenceBlock block={block} onInspect={onInspect} loading={loading} />;
    case "EvidenceStateSummary":
      return <EvidenceStateSummaryBlock block={block} onInspect={onInspect} />;
    case "DimensionGap":
      return <DimensionGapBlock block={block} onInspect={onInspect} loading={loading} />;
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
      return <ComparisonMatrixBlock block={block} />;
    case "ContextCard":
      return <ContextCardBlock block={block} />;
    case "EconomicCase":
      return <EconomicCaseBlock block={block} />;
    default:
      return (
        <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
          Unknown block type: {(block as RenderBlock).type}
        </div>
      );
  }
}
