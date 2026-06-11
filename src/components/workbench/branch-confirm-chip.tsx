"use client";

import * as React from "react";
import { useWorkbench } from "@/lib/workbench/workbench-context";
import { GitBranch, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * BranchConfirmChip (M3 — Stage model)
 *
 * Shown when the agent emits a `branch` patch. The patch is held pending for
 * 3 seconds and auto-applies if the user does nothing. The user can cancel
 * with the "Keep this view" button.
 *
 * Visual: slim banner across the top of the canvas with a thin progress bar
 * that drains over 3 seconds.
 */
export function BranchConfirmChip() {
  const { pendingBranch, cancelPendingBranch } = useWorkbench();
  const [progress, setProgress] = React.useState(1);

  React.useEffect(() => {
    if (!pendingBranch) {
      setProgress(1);
      return;
    }
    const start = pendingBranch.startedAt;
    const total = pendingBranch.timeoutMs;
    let rafId: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 1 - elapsed / total);
      setProgress(remaining);
      if (remaining > 0) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [pendingBranch]);

  return (
    <AnimatePresence>
      {pendingBranch && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="mx-5 mt-3 rounded-md border border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-100 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium">
            <GitBranch className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 truncate">
              Branching to <span className="font-semibold">{pendingBranch.topicLabel}</span>
              {" · current view will be archived"}
            </span>
            <button
              onClick={cancelPendingBranch}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-400/60 bg-white/50 hover:bg-white text-amber-900 dark:bg-amber-950/50 dark:hover:bg-amber-950 dark:text-amber-100 transition-colors"
            >
              <X className="w-3 h-3" />
              Keep this view
            </button>
          </div>
          {/* progress bar — drains over 3 seconds */}
          <div
            className="h-0.5 bg-amber-400 dark:bg-amber-600 origin-left"
            style={{ transform: `scaleX(${progress})`, transition: "none" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
