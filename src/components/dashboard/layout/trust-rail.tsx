"use client";

import { ArtifactBlock, ConfidenceTier, CorpusCitation, SourceType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIER_BAR: Record<ConfidenceTier, { width: string; color: string }> = {
  Speculative: { width: "w-1/4", color: "bg-red-400"   },
  Indicative:  { width: "w-2/4", color: "bg-amber-400" },
  Supported:   { width: "w-3/4", color: "bg-blue-400"  },
  Robust:      { width: "w-full", color: "bg-green-400" },
};

const SOURCE_DOT: Record<SourceType, string> = {
  project:         "bg-indigo-500",
  live_call:       "bg-green-500",
  knowledge_doc:   "bg-blue-500",
  knowledge_chunk: "bg-blue-500",
  hive_chunk:      "bg-purple-500",
  hive_article:    "bg-purple-500",
};

const SOURCE_LABEL: Record<SourceType, string> = {
  project:         "R&D",
  live_call:       "Call",
  knowledge_doc:   "Policy",
  knowledge_chunk: "Policy",
  hive_chunk:      "HIVE",
  hive_article:    "HIVE",
};

function CitationRow({ c }: { c: CorpusCitation }) {
  const pct = Math.round((c.score ?? 0) * 100);
  const dot = c.source_type ? SOURCE_DOT[c.source_type] : "bg-muted-foreground";
  const label = c.source_type ? SOURCE_LABEL[c.source_type] : null;

  return (
    <div className="rounded-lg border border-border p-2.5 space-y-1 bg-muted/20">
      <p className="text-xs font-medium leading-snug line-clamp-2">{c.title}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          {label && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded shrink-0",
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
              <span className="text-muted-foreground">{label}</span>
            </span>
          )}
          <span className="text-xs text-muted-foreground truncate">
            {c.organisation ?? c.funder ?? c.publisher ?? ""}
          </span>
        </div>
        <span className="text-xs font-mono text-indigo-600 shrink-0">{pct}%</span>
      </div>
    </div>
  );
}

interface TrustRailProps {
  artifact: ArtifactBlock;
}

export function TrustRail({ artifact }: TrustRailProps) {
  const tier = artifact.confidence_tier;
  const bar = TIER_BAR[tier];
  const citations = artifact.corpus_citations ?? [];
  const hiveCitations = artifact.hive_citations ?? [];
  const total = citations.length + hiveCitations.length;

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
        <span className="text-muted-foreground">Verified citations</span>
        <span className="font-semibold">{total}</span>
      </div>

      {/* Corpus citations */}
      {citations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Atlas corpus</p>
          {citations.map((c) => (
            <CitationRow key={c.id} c={c} />
          ))}
        </div>
      )}

      {/* Hive citations */}
      {hiveCitations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">HIVE articles</p>
          {hiveCitations.map((h) => (
            <div
              key={h.article_id}
              className="rounded-lg border border-border p-2.5 space-y-1 bg-muted/20"
            >
              <p className="text-xs font-medium leading-snug line-clamp-2">{h.title}</p>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  HIVE
                </span>
                <span className="text-xs font-mono text-indigo-600">
                  {Math.round((h.score ?? 0) * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {total === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No verified citations yet. Ask the agent to search for evidence.
        </p>
      )}
    </div>
  );
}
