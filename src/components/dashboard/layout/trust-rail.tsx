"use client";

import { ArtifactBlock, ConfidenceTier } from "@/lib/types";
import { cn } from "@/lib/utils";

const tierBar: Record<ConfidenceTier, { width: string; color: string }> = {
  Speculative: { width: "w-1/4", color: "bg-red-400" },
  Indicative:  { width: "w-2/4", color: "bg-amber-400" },
  Supported:   { width: "w-3/4", color: "bg-blue-400" },
  Robust:      { width: "w-full", color: "bg-green-400" },
};

interface TrustRailProps {
  artifact: ArtifactBlock;
}

export function TrustRail({ artifact }: TrustRailProps) {
  const tier = artifact.confidence_tier;
  const bar = tierBar[tier];
  const citations = artifact.corpus_citations ?? [];
  const hiveCitations = artifact.hive_citations ?? [];
  const totalCitations = citations.length + hiveCitations.length;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Evidence &amp; Trust
      </p>

      {/* Confidence bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Confidence</span>
          <span className="text-xs font-semibold">{tier}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", bar.width, bar.color)} />
        </div>
      </div>

      {/* Citation count */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Corpus citations</span>
        <span className="font-semibold">{totalCitations}</span>
      </div>

      {/* Corpus citations */}
      {citations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Atlas corpus</p>
          {citations.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-border p-2.5 space-y-1 bg-muted/20"
            >
              <p className="text-xs font-medium leading-snug line-clamp-2">{c.title}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.organisation}</span>
                <span className="text-xs font-mono text-indigo-600">
                  {(c.score * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hive citations */}
      {hiveCitations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Hive articles</p>
          {hiveCitations.map((h) => (
            <div
              key={h.article_id}
              className="rounded-lg border border-border p-2.5 space-y-1 bg-muted/20"
            >
              <p className="text-xs font-medium leading-snug line-clamp-2">{h.title}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">{h.article_id.slice(0, 8)}…</span>
                <span className="text-xs font-mono text-indigo-600">
                  {(h.score * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalCitations === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No citations yet. Ask the agent to find evidence.
        </p>
      )}
    </div>
  );
}
