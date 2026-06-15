"use client";

/**
 * ResearchDocument — prose layout for render_mode=document (U8).
 *
 * Shows headline, insight card, sections, and corpus citations when the
 * orchestrator format pass selects document mode over blocks.
 */

import type { AtlasRenderModel } from "@/lib/workbench/atlas-render-model";
import { CitationList } from "./citation-popover";
import { cn } from "@/lib/utils";

export interface ResearchDocumentProps {
  headline: string;
  insightCard: string;
  sections: Record<string, string>;
  confidenceTier: string;
  citations: Array<{ id: string; title?: string; organisation?: string; score?: number }>;
  className?: string;
}

export function ResearchDocument({
  headline,
  insightCard,
  sections,
  confidenceTier,
  citations,
  className,
}: ResearchDocumentProps) {
  return (
    <div className={cn("px-6 py-6 max-w-3xl space-y-6", className)}>
      <header className="space-y-2 border-b border-border pb-4">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Research document
        </span>
        <h1 className="text-xl font-semibold text-foreground leading-snug">{headline}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">{insightCard}</p>
        <span className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
          {confidenceTier}
        </span>
      </header>

      {Object.entries(sections).map(([key, value]) => (
        <section key={key} className="space-y-1.5">
          <h2 className="text-sm font-semibold text-foreground capitalize">
            {key.replace(/_/g, " ")}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {value}
          </p>
        </section>
      ))}

      {citations.length > 0 && (
        <section className="space-y-2 pt-2 border-t border-border">
          <h2 className="text-sm font-semibold text-foreground">Corpus citations</h2>
          <CitationList citations={citations} />
        </section>
      )}
    </div>
  );
}

/** Build ResearchDocument props from an AtlasRenderModel. */
export function researchDocumentFromModel(model: AtlasRenderModel): ResearchDocumentProps {
  return {
    headline: model.decision_spine.recommendation,
    insightCard: model.decision_spine.summary,
    sections: {
      mode: model.mode,
      layout: model.layout_template,
    },
    confidenceTier: model.decision_spine.confidence_tier,
    citations: [],
  };
}
