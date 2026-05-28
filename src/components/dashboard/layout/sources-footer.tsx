"use client";

import { useState } from "react";
import { ArtifactBlock, CorpusCitation, HiveCitation, SourceType } from "@/lib/types";
import { cn } from "@/lib/utils";

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

function CitationChip({ c }: { c: CorpusCitation }) {
  const pct = Math.round((c.score ?? 0) * 100);
  const dot  = c.source_type ? SOURCE_DOT[c.source_type]  : "bg-muted-foreground";
  const lbl  = c.source_type ? SOURCE_LABEL[c.source_type] : null;
  const barColor = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-blue-500" : "bg-amber-500";

  return (
    <div className="rounded-lg border border-border p-2.5 space-y-1.5 bg-muted/20 hover:bg-muted/40 transition-colors">
      <p className="text-xs font-medium leading-snug line-clamp-2">{c.title}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {lbl && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
              <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
              {lbl}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground truncate">
            {c.organisation ?? c.funder ?? c.publisher ?? ""}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="h-1 w-12 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

function HiveCitationChip({ h }: { h: HiveCitation }) {
  const pct = Math.round((h.score ?? 0) * 100);
  return (
    <div className="rounded-lg border border-border p-2.5 space-y-1.5 bg-muted/20 hover:bg-muted/40 transition-colors">
      <p className="text-xs font-medium leading-snug line-clamp-2">{h.title}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          HIVE article
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">{pct}%</span>
      </div>
    </div>
  );
}

interface SourcesFooterProps {
  artifact: ArtifactBlock;
}

export function SourcesFooter({ artifact }: SourcesFooterProps) {
  const [open, setOpen] = useState(false);

  const citations     = artifact.corpus_citations  ?? [];
  const hiveCitations = artifact.hive_citations    ?? [];
  const total         = citations.length + hiveCitations.length;

  if (total === 0) return null;

  const tier       = artifact.confidence_tier;
  const tierColors: Record<string, string> = {
    Speculative: "bg-red-400",
    Indicative:  "bg-amber-400",
    Supported:   "bg-blue-400",
    Robust:      "bg-green-400",
  };
  const tierWidths: Record<string, string> = {
    Speculative: "w-1/4",
    Indicative:  "w-2/4",
    Supported:   "w-3/4",
    Robust:      "w-full",
  };

  return (
    <div className="border-t border-border">
      {/* Toggle row — always visible */}
      <button
        className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {/* Confidence mini-bar */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                tierWidths[tier] ?? "w-2/4",
                tierColors[tier] ?? "bg-muted-foreground",
              )}
            />
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground">{tier}</span>
        </div>

        <span className="flex-1 text-xs font-semibold text-muted-foreground">
          Sources
        </span>

        <span className="text-[10px] text-muted-foreground">
          {total} verified citation{total !== 1 ? "s" : ""}
        </span>

        <svg
          className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded citation list */}
      {open && (
        <div className="px-4 pb-4 space-y-4">
          {citations.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Atlas corpus
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {citations.map((c) => (
                  <CitationChip key={c.id} c={c} />
                ))}
              </div>
            </div>
          )}

          {hiveCitations.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                HIVE articles
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {hiveCitations.map((h) => (
                  <HiveCitationChip key={h.article_id} h={h} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
