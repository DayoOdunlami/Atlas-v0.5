"use client";

import type { DecisionSpine, ConfidenceTier } from "@/lib/atlas5/types";
import { cn } from "@/lib/utils";

const tierStyle: Record<ConfidenceTier, string> = {
  Speculative: "bg-red-50 text-red-700 border-red-200",
  Indicative: "bg-amber-50 text-amber-700 border-amber-200",
  Supported: "bg-blue-50 text-blue-700 border-blue-200",
  Robust: "bg-green-50 text-green-700 border-green-200",
};

const tierDot: Record<ConfidenceTier, string> = {
  Speculative: "bg-red-500",
  Indicative: "bg-amber-500",
  Supported: "bg-blue-500",
  Robust: "bg-green-500",
};

interface DecisionSpineCardProps {
  spine: DecisionSpine;
}

export function DecisionSpineCard({ spine }: DecisionSpineCardProps) {
  const tier = spine.confidence_tier;

  return (
    <div
      data-testid="decision-spine-card"
      className="rounded-xl border border-border bg-card p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Decision
          </p>
          <p className="text-sm font-semibold leading-snug">{spine.decision}</p>
        </div>
        <span
          className={cn(
            "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
            tierStyle[tier],
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", tierDot[tier])} />
          {tier}
        </span>
      </div>

      <div className="bg-muted/40 rounded-lg p-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">
          Recommendation
        </p>
        <p className="text-sm">{spine.recommendation}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="font-medium text-muted-foreground mb-0.5">
            Key assumption
          </p>
          <p className="text-foreground/80">{spine.key_assumption}</p>
        </div>
        <div>
          <p className="font-medium text-muted-foreground mb-0.5">
            Next action
          </p>
          <p className="text-foreground/80">{spine.next_action}</p>
        </div>
        {spine.strongest_objection && (
          <div>
            <p className="font-medium text-muted-foreground mb-0.5">
              Strongest objection
            </p>
            <p className="text-foreground/80">{spine.strongest_objection}</p>
          </div>
        )}
        {spine.would_change_if && (
          <div>
            <p className="font-medium text-muted-foreground mb-0.5">
              Would change if
            </p>
            <p className="text-foreground/80">{spine.would_change_if}</p>
          </div>
        )}
      </div>

      {spine.framework && (
        <p className="text-xs text-muted-foreground">
          Framework: <span className="font-medium">{spine.framework}</span>
        </p>
      )}
    </div>
  );
}
