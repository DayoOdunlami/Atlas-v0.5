"use client";

/**
 * RunProgress — expandable workflow trace from reasoning_trace.
 * Shows what the agent is doing (not raw LLM reasoning tokens).
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReasoningStep } from "@/lib/atlas5/artifact-store";
import { NODE_LABELS } from "@/lib/atlas5/display-messages";

const HIDDEN = new Set([
  "__start__",
  "__end__",
  "extract_query",
  "reset_analyze_state",
  "emit_build_partial",
]);

function stepLabel(step: ReasoningStep, idx: number, total: number): string {
  if (step.thought?.trim()) return step.thought.trim();
  const node = step.node ?? "";
  if (node && NODE_LABELS[node]) return NODE_LABELS[node];
  return `Step ${idx + 1}`;
}

interface RunProgressProps {
  steps: ReasoningStep[];
  active?: boolean;
  compact?: boolean;
  className?: string;
}

export function RunProgress({
  steps,
  active = false,
  compact = false,
  className,
}: RunProgressProps) {
  const visible = steps.filter((s) => !s.node || !HIDDEN.has(s.node));
  const [open, setOpen] = useState(active);

  if (visible.length === 0 && !active) return null;

  const lastIdx = visible.length - 1;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/20 overflow-hidden",
        className,
      )}
      data-testid="run-progress"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        {active ? (
          <Loader2 className="size-3.5 shrink-0 text-indigo-500 animate-spin" />
        ) : (
          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
        )}
        <span className="text-[11px] font-medium text-foreground flex-1 truncate">
          {active
            ? visible.length > 0
              ? stepLabel(visible[lastIdx], lastIdx, visible.length)
              : "Starting analysis…"
            : `${visible.length} step${visible.length !== 1 ? "s" : ""} completed`}
        </span>
        {open ? (
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <ol className="border-t border-border px-3 py-2 space-y-1.5 max-h-48 overflow-y-auto">
          {visible.length === 0 ? (
            <li className="text-[11px] text-muted-foreground animate-pulse">
              Connecting to agent…
            </li>
          ) : (
            visible.map((step, i) => {
              const isActive = active && i === lastIdx;
              const done = !active || i < lastIdx;
              return (
                <li key={`${step.node ?? "step"}-${i}`} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-1 size-1.5 rounded-full shrink-0",
                      isActive && "bg-indigo-400 animate-pulse",
                      done && "bg-emerald-400",
                      !isActive && !done && "bg-muted-foreground/40",
                    )}
                  />
                  <p
                    className={cn(
                      "text-[11px] leading-snug",
                      isActive ? "text-foreground" : "text-muted-foreground",
                      done && !isActive && "opacity-70",
                    )}
                  >
                    {stepLabel(step, i, visible.length)}
                    {step.evidence_count != null && (
                      <span className="ml-1 opacity-70">({step.evidence_count})</span>
                    )}
                  </p>
                </li>
              );
            })
          )}
        </ol>
      )}

      {!open && active && visible.length > 0 && !compact && (
        <p className="px-3 pb-2 text-[10px] text-muted-foreground truncate">
          {stepLabel(visible[lastIdx], lastIdx, visible.length)}
        </p>
      )}
    </div>
  );
}
