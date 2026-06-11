"use client";

import { useWorkbench } from "@/lib/workbench/workbench-context";
import { ChevronLeft, History } from "lucide-react";
import { toast } from "sonner";

/**
 * StageHistoryBreadcrumb (M3 — Stage model)
 *
 * Slim breadcrumb above the canvas content showing how many previous stages
 * are available. Click to pop back to the most recent snapshot.
 *
 * Visible only when stageHistory has at least one snapshot (i.e. the user
 * has branched at least once during this session).
 */
export function StageHistoryBreadcrumb() {
  const { stageHistory, restorePreviousStage } = useWorkbench();

  if (stageHistory.length === 0) return null;

  const last = stageHistory[stageHistory.length - 1];

  const handleRestore = () => {
    const ok = restorePreviousStage();
    if (ok) {
      toast.success(`Restored: ${last.label}`, {
        description:
          stageHistory.length > 1
            ? `${stageHistory.length - 1} more stage${stageHistory.length - 1 === 1 ? "" : "s"} in history`
            : "End of stage history",
      });
    }
  };

  return (
    <div className="px-5 pt-3">
      <button
        onClick={handleRestore}
        className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <History className="w-3 h-3" />
        <span>{stageHistory.length} previous stage{stageHistory.length === 1 ? "" : "s"}</span>
        <ChevronLeft className="w-3 h-3" />
        <span className="font-medium truncate max-w-[200px]">{last.label}</span>
      </button>
    </div>
  );
}
