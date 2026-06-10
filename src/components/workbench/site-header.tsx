"use client";

import { useWorkbench } from "@/lib/workbench/workbench-context";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ConfidenceTierBadge } from "./shared/confidence-tier-badge";
import { Camera } from "lucide-react";

export function WorkbenchHeader() {
  const { model, openInspector, setSnapshotOpen } = useWorkbench();
  const { source_object, target_object, decision_spine, canonical_question_id } = model;

  return (
    <header className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background shrink-0 overflow-x-auto">
      <SidebarTrigger />

      <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto">
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
      </div>

      {/* Snapshot */}
      <button
        onClick={() => setSnapshotOpen(true)}
        className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
      >
        <Camera className="w-3.5 h-3.5" />
        Snapshot
      </button>
    </header>
  );
}
