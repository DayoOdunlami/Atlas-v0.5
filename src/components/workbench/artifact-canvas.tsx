"use client";

import { useWorkbench, CQ_LABELS } from "@/lib/workbench/workbench-context";
import type { CanonicalQuestionId } from "@/lib/workbench/atlas-render-model";
import { DecisionSpineStrip } from "./decision-spine-strip";
import { BlockRenderer } from "./block-renderer";
import { ReasoningTrace, DEMO_REASONING_STEPS } from "./reasoning-trace";
import {
  BlockSkeletonRecommendation,
  BlockSkeletonDimensionGap,
  BlockSkeletonMatchBench,
  BlockSkeletonClaimLedger,
} from "./shared/block-skeleton";
import { AlertCircle, Camera, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ArtifactCanvas() {
  const {
    model,
    cqId,
    setCqId,
    cqIds,
    openInspector,
    setSnapshotOpen,
    isLoading,
    error,
    isDbBacked,
  } = useWorkbench();

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Artifact header */}
      <div className="px-5 pt-5 pb-3 border-b border-border bg-background shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs text-muted-foreground">{model.mode} · {model.layout_template}</span>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
              <span className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                {model.canonical_question_id}
              </span>
            </div>
            <h1 className="text-sm font-semibold leading-snug line-clamp-2">
              {isLoading && isDbBacked ? "Loading match…" : model.source_object.title}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {isLoading && isDbBacked
                ? "Fetching DB-backed render model"
                : `Target: ${model.target_object.title}`}
            </p>
          </div>
        </div>
      </div>

      {/* Morph bar */}
      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border bg-muted/10 shrink-0 overflow-x-auto">
        {cqIds.map((id: CanonicalQuestionId) => (
          <button
            key={id}
            onClick={() => setCqId(id)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
              id === cqId
                ? "bg-foreground text-background"
                : "bg-background border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
            )}
          >
            {CQ_LABELS[id]}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setSnapshotOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors whitespace-nowrap"
        >
          <Camera className="w-3.5 h-3.5" />
          Snapshot
        </button>
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

      {/* Reasoning trace — active while loading, collapsed otherwise */}
      {!error && (
        <div className="px-5 pt-3 shrink-0">
          <ReasoningTrace
            steps={DEMO_REASONING_STEPS}
            defaultCollapsed={!(isLoading && isDbBacked)}
            label={isLoading && isDbBacked ? "Building render model…" : "How this model was built"}
          />
        </div>
      )}

      {/* Blocks */}
      <div className="flex-1 px-5 pb-6 space-y-4">
        {isLoading && isDbBacked ? (
          <>
            <BlockSkeletonRecommendation />
            <BlockSkeletonDimensionGap />
            <BlockSkeletonMatchBench />
            <BlockSkeletonClaimLedger />
          </>
        ) : error ? null : (
          <>
            {model.blocks.map((block) => (
              <BlockRenderer key={block.id} block={block} onInspect={openInspector} />
            ))}

            {/* Data quality notes */}
            {model.data_quality_notes.length > 0 && (
              <div className="rounded-md border border-dashed border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Data quality notes</p>
                <ul className="space-y-1">
                  {model.data_quality_notes.map((note, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                      <span className="shrink-0">·</span>{note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
