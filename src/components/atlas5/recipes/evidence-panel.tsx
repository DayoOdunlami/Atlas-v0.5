"use client";

import type { ArtifactBlock } from "@/lib/atlas5/artifact-store";
import type { CorpusCitation, SourceType } from "@/lib/atlas5/types";
import { cn } from "@/lib/utils";

const SOURCE_BADGE: Record<SourceType, { label: string; style: string }> = {
  project: {
    label: "R&D Project",
    style: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  live_call: {
    label: "Open Call",
    style: "bg-green-50 text-green-700 border-green-200",
  },
  knowledge_doc: {
    label: "Policy",
    style: "bg-blue-50 text-blue-700 border-blue-200",
  },
  knowledge_chunk: {
    label: "Policy",
    style: "bg-blue-50 text-blue-700 border-blue-200",
  },
  hive_chunk: {
    label: "HIVE",
    style: "bg-purple-50 text-purple-700 border-purple-200",
  },
  hive_article: {
    label: "HIVE",
    style: "bg-purple-50 text-purple-700 border-purple-200",
  },
};

function SourceBadge({ type }: { type?: SourceType }) {
  const badge = type ? SOURCE_BADGE[type] : null;
  if (!badge) return null;
  return (
    <span
      className={cn(
        "text-xs px-1.5 py-0.5 rounded border font-medium",
        badge.style,
      )}
    >
      {badge.label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-blue-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
    </div>
  );
}

function CitationCard({ c }: { c: CorpusCitation }) {
  const secondary =
    c.source_type === "live_call"
      ? c.funder
      : c.source_type === "project"
        ? c.organisation
        : c.publisher;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 hover:bg-muted/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug flex-1 line-clamp-2">
          {c.title}
        </p>
        <SourceBadge type={c.source_type} />
      </div>
      <div className="flex items-center justify-between">
        {secondary && (
          <span className="text-xs text-muted-foreground truncate max-w-[60%]">
            {secondary}
          </span>
        )}
        <ScoreBar score={c.score ?? 0} />
      </div>
      {c.source_type === "live_call" && c.deadline && (
        <p className="text-xs text-amber-700">Deadline: {c.deadline}</p>
      )}
    </div>
  );
}

interface Props {
  artifact: ArtifactBlock;
}

export function EvidencePanelRecipe({ artifact }: Props) {
  const citations = artifact.corpus_citations ?? [];
  const sections = artifact.sections ?? {};
  const contextKey = Object.keys(sections)[0];

  return (
    <div className="space-y-1" data-testid="recipe-evidence-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Evidence Summary
        </span>
        <span className="text-xs text-muted-foreground">
          {citations.length} source{citations.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {contextKey && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {sections[contextKey]}
          </p>
        )}

        {citations.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {citations.map((c) => (
              <CitationCard key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No verified citations yet. Ask the agent to search for evidence.
          </p>
        )}
      </div>
    </div>
  );
}
