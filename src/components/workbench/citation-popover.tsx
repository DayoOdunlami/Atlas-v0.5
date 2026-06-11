"use client";

/**
 * CitationPopover — M1.3
 *
 * Renders a compact citation chip (truncated UUID or short label) that opens
 * a popover with full project/citation details when clicked.
 *
 * Usage:
 *   <CitationPopover
 *     id="abc123-…"
 *     title="Digital Wayfinding at Scale"
 *     organisation="Transport for London"
 *     score={0.87}
 *     evidenceState="verified"
 *   />
 */

import * as React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ExternalLink, BookOpen, Building2, Star, Fingerprint } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CitationEvidenceState =
  | "verified"
  | "self-reported"
  | "inferred"
  | "unknown"
  | "contested";

export interface CitationSource {
  /** Project / article UUID */
  id: string;
  /** Human-readable title */
  title?: string;
  /** Organisation that produced the project */
  organisation?: string;
  /** Cosine similarity score 0–1 */
  score?: number;
  /** Evidence state for this citation */
  evidenceState?: CitationEvidenceState;
  /** Short note on why this is relevant */
  relevanceNote?: string;
  /** Source schema: atlas.projects or hive.articles */
  schema?: "atlas" | "hive";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EVIDENCE_STYLES: Record<CitationEvidenceState, string> = {
  verified:       "bg-evidence-verified/15 text-evidence-verified border-evidence-verified/30",
  "self-reported": "bg-evidence-self-reported/15 text-evidence-self-reported border-evidence-self-reported/30",
  inferred:       "bg-evidence-inferred/15 text-evidence-inferred border-evidence-inferred/30",
  unknown:        "bg-muted text-muted-foreground border-border",
  contested:      "bg-evidence-contested/15 text-evidence-contested border-evidence-contested/30",
};

const EVIDENCE_LABELS: Record<CitationEvidenceState, string> = {
  verified:        "Verified",
  "self-reported": "Self-reported",
  inferred:        "Inferred",
  unknown:         "Unknown",
  contested:       "Contested",
};

function scoreBar(score: number) {
  const pct = Math.round(score * 100);
  const colour =
    pct >= 80 ? "bg-evidence-verified" :
    pct >= 60 ? "bg-evidence-inferred" :
    pct >= 40 ? "bg-evidence-self-reported" :
    "bg-muted-foreground";
  return { pct, colour };
}

// ---------------------------------------------------------------------------
// CitationChip — the inline trigger element
// ---------------------------------------------------------------------------

interface CitationChipProps {
  id: string;
  evidenceState?: CitationEvidenceState;
  score?: number;
  label?: string;
  size?: "xs" | "sm";
}

export function CitationChip({
  id,
  evidenceState = "unknown",
  score,
  label,
  size = "xs",
}: CitationChipProps) {
  const short = label ?? id.slice(0, 8);
  const stateStyle = EVIDENCE_STYLES[evidenceState];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border font-mono cursor-pointer select-none",
        "hover:brightness-95 active:scale-95 transition-all",
        size === "xs" ? "text-[11px] px-1.5 py-0" : "text-xs px-2 py-0.5",
        stateStyle,
      )}
    >
      <Fingerprint
        className={cn(size === "xs" ? "size-2.5" : "size-3", "shrink-0")}
      />
      {short}
      {score !== undefined && (
        <span className="opacity-60">{Math.round(score * 100)}%</span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CitationCard — the popover body
// ---------------------------------------------------------------------------

function CitationCard({ citation }: { citation: CitationSource }) {
  const { id, title, organisation, score, evidenceState = "unknown", relevanceNote, schema = "atlas" } = citation;
  const bar = score !== undefined ? scoreBar(score) : null;

  return (
    <div className="w-72 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug line-clamp-2">
            {title ?? "Untitled project"}
          </p>
          {organisation && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Building2 className="size-3 shrink-0" />
              {organisation}
            </p>
          )}
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-[11px] px-1.5 py-0 shrink-0 border",
            EVIDENCE_STYLES[evidenceState],
          )}
        >
          {EVIDENCE_LABELS[evidenceState]}
        </Badge>
      </div>

      {/* Score bar */}
      {bar && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Similarity</span>
            <span className="font-mono">{bar.pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", bar.colour)}
              style={{ width: `${bar.pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Relevance note */}
      {relevanceNote && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {relevanceNote}
        </p>
      )}

      {/* Footer — ID + schema */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <span className="font-mono text-[11px] text-muted-foreground/70 truncate max-w-[180px]">
          {id}
        </span>
        <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
          <BookOpen className="size-2.5" />
          {schema}.projects
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CitationPopover — the public component
// ---------------------------------------------------------------------------

interface CitationPopoverProps extends CitationSource {
  /** Override the chip label */
  label?: string;
  /** Chip size */
  size?: "xs" | "sm";
}

export function CitationPopover({
  label,
  size,
  ...citation
}: CitationPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex items-center">
          <CitationChip
            id={citation.id}
            evidenceState={citation.evidenceState}
            score={citation.score}
            label={label}
            size={size}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="p-3 shadow-lg"
      >
        <CitationCard citation={citation} />
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// CitationList — renders a row of citation chips from an array
// ---------------------------------------------------------------------------

interface CitationListProps {
  citations: Array<CitationSource>;
  maxVisible?: number;
  size?: "xs" | "sm";
  className?: string;
}

export function CitationList({
  citations,
  maxVisible = 5,
  size = "xs",
  className,
}: CitationListProps) {
  const [showAll, setShowAll] = React.useState(false);
  const visible = showAll ? citations : citations.slice(0, maxVisible);
  const overflow = citations.length - maxVisible;

  if (citations.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1 items-center", className)}>
      {visible.map((c) => (
        <CitationPopover key={c.id} {...c} size={size} />
      ))}
      {!showAll && overflow > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-[11px] text-muted-foreground hover:text-foreground px-1 py-0"
        >
          +{overflow} more
        </button>
      )}
    </div>
  );
}
