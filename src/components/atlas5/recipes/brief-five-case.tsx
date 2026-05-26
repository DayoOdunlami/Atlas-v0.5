"use client";

import type { ArtifactBlock } from "@/lib/atlas5/artifact-store";
import type { ConfidenceTier } from "@/lib/atlas5/types";
import { cn } from "@/lib/utils";

const FIVE_CASE_ORDER = [
  "Strategic Case",
  "Economic Case",
  "Commercial Case",
  "Financial Case",
  "Management Case",
];

const SECTION_STYLE: Record<
  string,
  { border: string; label: string; dot: string }
> = {
  "Strategic Case": {
    border: "border-l-indigo-500",
    label: "text-indigo-700",
    dot: "bg-indigo-500",
  },
  "Economic Case": {
    border: "border-l-emerald-500",
    label: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  "Commercial Case": {
    border: "border-l-violet-500",
    label: "text-violet-700",
    dot: "bg-violet-500",
  },
  "Financial Case": {
    border: "border-l-amber-500",
    label: "text-amber-700",
    dot: "bg-amber-500",
  },
  "Management Case": {
    border: "border-l-slate-500",
    label: "text-slate-700",
    dot: "bg-slate-500",
  },
};

const TIER_BADGE: Record<ConfidenceTier, string> = {
  Speculative: "bg-red-50 text-red-700 border-red-200",
  Indicative: "bg-amber-50 text-amber-700 border-amber-200",
  Supported: "bg-blue-50 text-blue-700 border-blue-200",
  Robust: "bg-green-50 text-green-700 border-green-200",
};

interface Props {
  artifact: ArtifactBlock;
}

export function BriefFiveCaseRecipe({ artifact }: Props) {
  const sections = artifact.sections ?? {};
  const sectionKeys = Object.keys(sections);

  // Ordered: Five Case sections first, then any extras
  const ordered = [
    ...FIVE_CASE_ORDER.filter((k) => k in sections),
    ...sectionKeys.filter((k) => !FIVE_CASE_ORDER.includes(k)),
  ];

  return (
    <div className="space-y-1" data-testid="recipe-brief-five-case">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Investment Brief
        </span>
        <span
          className={cn(
            "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
            TIER_BADGE[artifact.confidence_tier],
          )}
        >
          {artifact.confidence_tier}
        </span>
      </div>

      {/* Five Case sections */}
      <div className="p-4 space-y-3">
        {ordered.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            Ask the agent to build an investment brief.
          </p>
        )}

        {ordered.map((heading) => {
          const style = SECTION_STYLE[heading];
          return (
            <div
              key={heading}
              className={cn(
                "pl-3 border-l-2",
                style?.border ?? "border-l-muted-foreground/30",
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {style && (
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      style.dot,
                    )}
                  />
                )}
                <h3
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wide",
                    style?.label ?? "text-muted-foreground",
                  )}
                >
                  {heading}
                </h3>
              </div>
              <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
                {sections[heading]}
              </p>
            </div>
          );
        })}

        {/* NPV callout */}
        {artifact.npv_value != null && (
          <div className="mt-2 flex items-center gap-6 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div>
              <p className="text-xs text-emerald-700 font-medium">
                NPV (3.5% STPR)
              </p>
              <p className="text-xl font-bold text-emerald-800">
                £{(artifact.npv_value / 1_000_000).toFixed(1)}m
              </p>
            </div>
            {artifact.discount_rate !== undefined && (
              <div>
                <p className="text-xs text-emerald-700 font-medium">
                  Discount rate
                </p>
                <p className="text-xl font-bold text-emerald-800">
                  {artifact.discount_rate}%
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
