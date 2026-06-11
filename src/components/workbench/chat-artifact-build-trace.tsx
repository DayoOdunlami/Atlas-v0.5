"use client";

/**
 * Inline "building artifact" trace for the chat panel.
 * Shown instead of raw model_patch JSON during propose / economic routes.
 */

import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReasoningStep } from "@/lib/workbench/atlas-render-model";

const BUILD_STEPS: ReasoningStep[] = [
  { label: "Understanding request", status: "complete" },
  { label: "Structuring artifact block", status: "active" },
  { label: "Applying to canvas", status: "pending" },
];

interface ChatArtifactBuildTraceProps {
  steps: ReasoningStep[];
  isRunning?: boolean;
  done?: boolean;
  className?: string;
}

export function ChatArtifactBuildTrace({
  steps,
  isRunning = false,
  done = false,
  className,
}: ChatArtifactBuildTraceProps) {
  const displaySteps =
    steps.length > 0
      ? steps
      : isRunning
        ? BUILD_STEPS
        : [{ label: "Artifact updated", status: "complete" as const }];

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/50 px-3 py-2.5 space-y-2",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {done || !isRunning ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        ) : (
          <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
        )}
        <Sparkles className="w-3 h-3 text-amber-600/80 shrink-0" />
        <span className="text-xs font-medium text-foreground">
          {isRunning ? "Building artifact…" : done ? "Added to canvas" : "Artifact ready"}
        </span>
      </div>

      <ul className="space-y-1 pl-1">
        {displaySteps.map((step, i) => (
          <li key={`${step.label}-${i}`} className="flex items-center gap-2 text-[11px]">
            <span
              className={cn(
                "w-1 h-1 rounded-full shrink-0",
                step.status === "complete" && "bg-emerald-500",
                step.status === "active" && "bg-amber-500 animate-pulse",
                step.status === "pending" && "bg-muted-foreground/30",
                step.status === "error" && "bg-red-500",
              )}
            />
            <span
              className={cn(
                step.status === "active" && "text-amber-800 dark:text-amber-200 font-medium",
                step.status === "complete" && "text-muted-foreground",
                step.status === "pending" && "text-muted-foreground/50",
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
