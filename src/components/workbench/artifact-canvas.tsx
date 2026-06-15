"use client";

import * as React from "react";
import { useWorkbench, CQ_LABELS, MATCH_CQ_IDS } from "@/lib/workbench/workbench-context";
import type { CanonicalQuestionId, RenderBlock } from "@/lib/workbench/atlas-render-model";
import { DecisionSpineStrip } from "./decision-spine-strip";
import { BlockRenderer } from "./block-renderer";
import { ReasoningTrace, DEMO_REASONING_STEPS } from "./reasoning-trace";
import { ResearchDocument } from "./research-document";
import { BranchConfirmChip } from "./branch-confirm-chip";
import { StageHistoryBreadcrumb } from "./stage-history-breadcrumb";
import {
  BlockSkeletonRecommendation,
  BlockSkeletonDimensionGap,
  BlockSkeletonMatchBench,
  BlockSkeletonClaimLedger,
} from "./shared/block-skeleton";
import { AlertCircle, ChevronRight, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

export function ArtifactCanvas() {
  const {
    model,
    cqId,
    setCqId,
    openInspector,
    isLoading,
    error,
    isDbBacked,
    reasoningSteps,
    renderMode,
    documentSections,
    lastCitations,
  } = useWorkbench();

  // Live agent steps when available; fall back to demo steps so the
  // trace panel always shows something meaningful in static/demo mode.
  const traceSteps = reasoningSteps.length > 0 ? reasoningSteps : DEMO_REASONING_STEPS;
  const traceIsLive = reasoningSteps.length > 0;
  const traceIsActive = traceIsLive && reasoningSteps.some((s) => s.status === "active");

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Canvas subheader — context + CQ morph bar (no duplicate source title, that's in WorkbenchHeader) */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-muted/10 shrink-0 overflow-x-auto">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground/80 shrink-0 font-semibold">
          View
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        {MATCH_CQ_IDS.map((id: CanonicalQuestionId) => (
          <button
            key={id}
            onClick={() => setCqId(id)}
            disabled={isLoading}
            className={cn(
              "px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed",
              id === cqId
                ? "bg-primary text-primary-foreground"
                : "bg-background border border-border text-muted-foreground hover:text-foreground hover:border-primary/40",
            )}
          >
            {CQ_LABELS[id]}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground/70 shrink-0 truncate max-w-[240px]">
          {model.mode} · {model.layout_template}
        </span>
      </div>

      {/* Error state — DB fetch failed */}
      {error && (
        <div className="px-5 pt-4 shrink-0">
          <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-destructive">Could not load this match</p>
              <p className="text-xs text-muted-foreground mt-0.5 break-words">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Decision spine strip — hidden while loading a DB model */}
      {!(isLoading && isDbBacked) && !error && (
        <div className="px-5 pt-4 shrink-0">
          <DecisionSpineStrip
            spine={model.decision_spine}
            onInspectConfidence={() => openInspector("confidence")}
          />
        </div>
      )}

      {/* Reasoning trace — expands when agent is running, collapsed at rest */}
      {!error && (
        <div className="px-5 pt-3 shrink-0">
          <ReasoningTrace
            steps={traceSteps}
            defaultCollapsed={!traceIsActive && !(isLoading && isDbBacked)}
            label={
              isLoading && isDbBacked
                ? "Building render model…"
                : traceIsActive
                  ? "Agent working…"
                  : traceIsLive
                    ? "Last agent reasoning"
                    : "How this model was built"
            }
          />
        </div>
      )}

      {/* Stage chrome — branch confirm chip + history breadcrumb */}
      {!error && (
        <>
          <BranchConfirmChip />
          <StageHistoryBreadcrumb />
        </>
      )}

      {/* Blocks or document layout */}
      <div className="flex-1 px-6 pb-8 pt-1">
        {isLoading && isDbBacked ? (
          <div className="space-y-4">
            <BlockSkeletonRecommendation />
            <BlockSkeletonDimensionGap />
            <BlockSkeletonMatchBench />
            <BlockSkeletonClaimLedger />
          </div>
        ) : error ? null : renderMode === "document" ? (
          <ResearchDocument
            headline={model.decision_spine.recommendation}
            insightCard={model.decision_spine.summary}
            sections={documentSections}
            confidenceTier={model.decision_spine.confidence_tier}
            citations={lastCitations}
          />
        ) : (
          <StageZones blocks={model.blocks} onInspect={openInspector} />
        )}

        {/* Data quality notes */}
        {!error && !isLoading && model.data_quality_notes.length > 0 && (
          <div className="rounded-lg border border-dashed border-border p-4 mt-6 bg-muted/20">
            <p className="text-[13px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Data quality notes
            </p>
            <ul className="space-y-1.5">
              {model.data_quality_notes.map((note, i) => (
                <li
                  key={i}
                  className="text-sm text-muted-foreground flex gap-2 leading-relaxed"
                >
                  <span className="shrink-0 text-muted-foreground/60">·</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StageZones — Tier 2 (M3) 3-zone canvas
//
// Groups blocks by their `role` (focus / context / reference / archived) into
// distinct visual zones. Defaults to `focus` for legacy blocks without a role
// so the existing match models continue to render unchanged.
//
// Animation: framer-motion LayoutGroup + motion.div per block gives a 200ms
// auto-morph when a block's role changes (Cmd+Z, agent pivot, etc.).
// ---------------------------------------------------------------------------
function StageZones({
  blocks,
  onInspect,
}: {
  blocks: RenderBlock[];
  onInspect: (kind: string, payload?: unknown) => void;
}) {
  const groups = React.useMemo(() => {
    const focus: RenderBlock[] = [];
    const context: RenderBlock[] = [];
    const reference: RenderBlock[] = [];
    const archived: RenderBlock[] = [];
    for (const b of blocks) {
      const role = b.role ?? "focus";
      if (role === "context") context.push(b);
      else if (role === "reference") reference.push(b);
      else if (role === "archived") archived.push(b);
      else focus.push(b);
    }
    return { focus, context, reference, archived };
  }, [blocks]);

  // Show "ready for work" hint when canvas is empty but on a match CQ
  const isEmpty =
    groups.focus.length === 0 &&
    groups.context.length === 0 &&
    groups.reference.length === 0;
  if (isEmpty) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/10 p-12 text-center">
        <p className="text-base font-semibold text-foreground">
          Ask a question in chat to populate this stage
        </p>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
          Substantive answers land here as cards. Use{" "}
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[11px] font-mono">
            Cmd+Z
          </kbd>{" "}
          to revert any block the agent adds.
        </p>
      </div>
    );
  }

  return (
    <LayoutGroup>
      <div className="space-y-8">
        {/* FOCUS zone — primary content, full cards arranged via content-aware grid */}
        {groups.focus.length > 0 && (
          <AnimatePresence mode="popLayout">
            <FocusGrid blocks={groups.focus} onInspect={onInspect} />
          </AnimatePresence>
        )}

        {/* CONTEXT strip — condensed, kept around to ground the focus */}
        {groups.context.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2.5 px-1">
              Context
            </p>
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-95">
                {groups.context.map((block) => (
                  <motion.div
                    key={block.id}
                    layout
                    layoutId={`block-${block.id}`}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 0.95, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <BlockRenderer block={block} onInspect={onInspect} />
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          </div>
        )}

        {/* REFERENCE rail — tiny chips, click to recall */}
        {groups.reference.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2.5 px-1">
              Reference
            </p>
            <div className="flex flex-wrap gap-2">
              {groups.reference.map((block) => (
                <motion.button
                  key={block.id}
                  layout
                  layoutId={`block-${block.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => onInspect("block", block.id)}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-border bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors max-w-[200px] truncate"
                  title={block.headline}
                >
                  {block.headline}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* ARCHIVED footer — count only, recoverable via undo/history */}
        {groups.archived.length > 0 && (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground/70 pt-3 border-t border-border/50">
            <Archive className="w-3.5 h-3.5" />
            <span>
              {groups.archived.length} archived{" "}
              {groups.archived.length === 1 ? "block" : "blocks"} (Cmd+Z to restore)
            </span>
          </div>
        )}
      </div>
    </LayoutGroup>
  );
}

// ---------------------------------------------------------------------------
// FocusGrid — content-aware layout for the focus zone
//
// Atlas blocks have very different visual weight:
//   - Full-width: NetworkMap, ComparisonMatrix (SWOT), EconomicCase,
//     MatchBench, DimensionGap, ClaimLedger, OpportunityList, TransferLanes,
//     ActionPlan, ObjectionResponse, ProvenanceTrace
//   - Half-width: ContextCard, EvidenceStateSummary, RecommendationConfidence
//
// We pair consecutive half-width blocks side-by-side on >=lg screens. Full
// blocks always take a row of their own. This stops the canvas from feeling
// like a single tall column and recovers the unused horizontal real estate.
// ---------------------------------------------------------------------------

const HALF_WIDTH_BLOCK_TYPES = new Set<RenderBlock["type"]>([
  "ContextCard",
  "EvidenceStateSummary",
  "RecommendationConfidence",
]);

type FocusRow =
  | { kind: "full"; block: RenderBlock }
  | { kind: "pair"; blocks: [RenderBlock, RenderBlock] }
  | { kind: "half"; block: RenderBlock };

function packFocusRows(blocks: RenderBlock[]): FocusRow[] {
  const rows: FocusRow[] = [];
  let i = 0;
  while (i < blocks.length) {
    const a = blocks[i];
    if (HALF_WIDTH_BLOCK_TYPES.has(a.type)) {
      const b = blocks[i + 1];
      if (b && HALF_WIDTH_BLOCK_TYPES.has(b.type)) {
        rows.push({ kind: "pair", blocks: [a, b] });
        i += 2;
        continue;
      }
      rows.push({ kind: "half", block: a });
      i += 1;
      continue;
    }
    rows.push({ kind: "full", block: a });
    i += 1;
  }
  return rows;
}

function FocusGrid({
  blocks,
  onInspect,
}: {
  blocks: RenderBlock[];
  onInspect: (kind: string, payload?: unknown) => void;
}) {
  const rows = React.useMemo(() => packFocusRows(blocks), [blocks]);

  return (
    <div className="space-y-5">
      {rows.map((row, idx) => {
        if (row.kind === "full") {
          return (
            <motion.div
              key={row.block.id}
              layout
              layoutId={`block-${row.block.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <BlockRenderer block={row.block} onInspect={onInspect} />
            </motion.div>
          );
        }
        if (row.kind === "half") {
          return (
            <motion.div
              key={row.block.id}
              layout
              layoutId={`block-${row.block.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="md:max-w-[60%]"
            >
              <BlockRenderer block={row.block} onInspect={onInspect} />
            </motion.div>
          );
        }
        return (
          <div
            key={`pair-${idx}-${row.blocks[0].id}`}
            className="grid grid-cols-1 lg:grid-cols-2 gap-5"
          >
            {row.blocks.map((b) => (
              <motion.div
                key={b.id}
                layout
                layoutId={`block-${b.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <BlockRenderer block={b} onInspect={onInspect} />
              </motion.div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
