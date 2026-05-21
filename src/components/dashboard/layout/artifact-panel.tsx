"use client";

import { ArtifactBlock, ConfidenceTier } from "@/lib/types";
import { cn } from "@/lib/utils";

const tierStyle: Record<ConfidenceTier, string> = {
  Speculative: "text-red-600 bg-red-50 border-red-200",
  Indicative: "text-amber-600 bg-amber-50 border-amber-200",
  Supported: "text-blue-600 bg-blue-50 border-blue-200",
  Robust: "text-green-600 bg-green-50 border-green-200",
};

const typeLabel: Record<ArtifactBlock["type"], string> = {
  brief: "Opportunity Brief",
  evidence: "Evidence Summary",
  chart: "Analysis Chart",
};

interface ArtifactPanelProps {
  artifact: ArtifactBlock;
}

export function ArtifactPanel({ artifact }: ArtifactPanelProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {typeLabel[artifact.type]}
          </span>
        </div>
        <span
          className={cn(
            "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
            tierStyle[artifact.confidence_tier],
          )}
        >
          {artifact.confidence_tier}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Sections */}
        {artifact.sections && Object.keys(artifact.sections).length > 0 && (
          <div className="space-y-3">
            {Object.entries(artifact.sections).map(([heading, body]) => (
              <div key={heading}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  {heading}
                </h3>
                <p className="text-sm text-foreground/85 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        )}

        {/* NPV */}
        {artifact.npv_value !== undefined && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
            <div>
              <p className="text-xs text-muted-foreground">NPV (3.5% STPR)</p>
              <p className="text-lg font-bold">
                £{(artifact.npv_value / 1_000_000).toFixed(1)}m
              </p>
            </div>
            {artifact.discount_rate && (
              <div className="ml-6">
                <p className="text-xs text-muted-foreground">Discount rate</p>
                <p className="text-lg font-bold">{artifact.discount_rate}%</p>
              </div>
            )}
          </div>
        )}

        {/* No content placeholder */}
        {(!artifact.sections || Object.keys(artifact.sections).length === 0) &&
          artifact.npv_value === undefined && (
            <p className="text-sm text-muted-foreground italic">
              Ask the agent to generate a brief.
            </p>
          )}
      </div>
    </div>
  );
}
