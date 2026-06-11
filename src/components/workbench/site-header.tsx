"use client";

import { useWorkbench } from "@/lib/workbench/workbench-context";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ConfidenceTierBadge } from "./shared/confidence-tier-badge";
import { Camera, Undo2, Redo2, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkbenchHeader() {
  const {
    model,
    cqId,
    openInspector,
    setSnapshotOpen,
    canUndo,
    canRedo,
    undo,
    redo,
    appliedPatches,
  } = useWorkbench();
  const { source_object, decision_spine, canonical_question_id } = model;
  const isHome = cqId === "cq.home";

  return (
    <header className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background shrink-0 overflow-x-auto">
      <SidebarTrigger />

      <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto">
        {isHome ? (
          // Home: just show workbench identity, no match chrome
          <>
            <Home className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">Atlas Workbench</span>
            <span className="text-[10px] text-muted-foreground/60 shrink-0 hidden md:inline">
              · ask anything
            </span>
          </>
        ) : (
          <>
            {/* Source title — truncated */}
            <span className="text-sm font-medium truncate max-w-xs" title={source_object.title}>
              {source_object.title}
            </span>

            <span className="text-muted-foreground text-xs shrink-0">→</span>

            {/* CQ pill */}
            <span className="shrink-0 inline-flex items-center rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
              {canonical_question_id}
            </span>

            {/* Confidence tier — clickable */}
            <ConfidenceTierBadge
              tier={decision_spine.confidence_tier}
              onClick={() => openInspector("confidence")}
              className="shrink-0"
            />
          </>
        )}
      </div>

      {/* Undo / Redo (M2.0) */}
      <div className="flex shrink-0 items-center gap-0.5 mr-1">
        <button
          type="button"
          onClick={() => undo()}
          disabled={!canUndo}
          title={canUndo ? `Undo (${appliedPatches.length} change${appliedPatches.length !== 1 ? "s" : ""})` : "Nothing to undo"}
          aria-label="Undo last change"
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-md text-xs transition-colors",
            canUndo
              ? "text-muted-foreground hover:text-foreground hover:bg-muted"
              : "text-muted-foreground/30 cursor-not-allowed",
          )}
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => redo()}
          disabled={!canRedo}
          title={canRedo ? "Redo" : "Nothing to redo"}
          aria-label="Redo last change"
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-md text-xs transition-colors",
            canRedo
              ? "text-muted-foreground hover:text-foreground hover:bg-muted"
              : "text-muted-foreground/30 cursor-not-allowed",
          )}
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Snapshot — hidden on home (nothing to snapshot yet) */}
      {!isHome && (
        <button
          onClick={() => setSnapshotOpen(true)}
          className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
        >
          <Camera className="w-3.5 h-3.5" />
          Snapshot
        </button>
      )}
    </header>
  );
}
