"use client";

import Link from "next/link";
import { useWorkbench } from "@/lib/workbench/workbench-context";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ConfidenceTierBadge } from "./shared/confidence-tier-badge";
import { Camera, Undo2, Redo2, Home, PlayCircle } from "lucide-react";
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
    <header className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background shrink-0 overflow-x-auto">
      <SidebarTrigger />

      <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto">
        {isHome ? (
          // Home: just show workbench identity, no match chrome
          <>
            <Home className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-[15px] font-semibold truncate">Atlas Workbench</span>
            <span className="text-[12px] text-muted-foreground/70 shrink-0 hidden md:inline">
              · ask anything
            </span>
          </>
        ) : (
          <>
            {/* Source title — truncated */}
            <span
              className="text-[15px] font-semibold truncate max-w-xs"
              title={source_object.title}
            >
              {source_object.title}
            </span>

            <span className="text-muted-foreground text-sm shrink-0">→</span>

            {/* CQ pill */}
            <span className="shrink-0 inline-flex items-center rounded border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-800 px-2 py-0.5 text-[12px] font-medium text-indigo-700 dark:text-indigo-300">
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

      {/* Demo mode entry — always visible so it's discoverable */}
      <Link
        href="/workbench/demo"
        prefetch={false}
        title="Open the demo workbench (pre-baked fixtures, no agent)"
        className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors mr-1"
      >
        <PlayCircle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Demo</span>
      </Link>

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
