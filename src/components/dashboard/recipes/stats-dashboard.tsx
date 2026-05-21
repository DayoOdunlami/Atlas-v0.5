"use client";

import { ArtifactBlock } from "@/lib/types";

interface Props {
  artifact: ArtifactBlock;
}

export function StatsDashboardRecipe({ artifact }: Props) {
  const sections = artifact.sections ?? {};
  const sectionEntries = Object.entries(sections);

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Data Analysis
        </span>
        {artifact.confidence_tier && (
          <span className="text-xs text-muted-foreground">{artifact.confidence_tier}</span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* NPV / financial headline */}
        {artifact.npv_value !== undefined && (
          <div className="flex items-center gap-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <div>
              <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide">
                Net Present Value (3.5% STPR)
              </p>
              <p className="text-3xl font-bold text-emerald-800 mt-0.5">
                £{(artifact.npv_value / 1_000_000).toFixed(1)}m
              </p>
            </div>
            {artifact.discount_rate !== undefined && (
              <div className="border-l border-emerald-200 pl-6">
                <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide">
                  Discount Rate
                </p>
                <p className="text-3xl font-bold text-emerald-800 mt-0.5">
                  {artifact.discount_rate}%
                </p>
              </div>
            )}
          </div>
        )}

        {/* Context sections */}
        {sectionEntries.map(([heading, body]) => (
          <div key={heading}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              {heading}
            </h3>
            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
              {body}
            </p>
          </div>
        ))}

        {sectionEntries.length === 0 && artifact.npv_value === undefined && (
          <p className="text-sm text-muted-foreground italic">
            Ask the agent to run a data analysis or NPV calculation.
          </p>
        )}

        {/* Charts hint */}
        <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground border-t border-border">
          <span className="w-3 h-3 rounded-sm bg-indigo-200 inline-block" />
          Charts are rendered in the panel below
        </div>
      </div>
    </div>
  );
}
