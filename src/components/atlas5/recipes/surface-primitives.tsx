"use client";

/**
 * Shared primitives for all Atlas 5 surfaces.
 *
 * Design system from gold-standard reference:
 *   - Answer first — bold one-sentence verdict + left border colored by tier
 *   - Claim states are first-class — ✓ ~ ? ⚠ before every piece of evidence
 *   - Confidence tier = visual weight (opacity + border style + accent color)
 *   - Action always available — at least one next step per surface
 */

import { useState } from "react";
import type { ConfidenceTier, ClaimState } from "@/lib/atlas5/types";
import { ClaimStateBadge } from "@/components/atlas5/claim-state-badge";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { CorpusCitation } from "@/lib/atlas5/types";

// ---------------------------------------------------------------------------
// Tier visual config
// ---------------------------------------------------------------------------

export const TIER_BORDER_L: Record<ConfidenceTier, string> = {
  Speculative: "border-l-slate-400",
  Indicative:  "border-l-amber-500",
  Supported:   "border-l-blue-500",
  Robust:      "border-l-emerald-500",
};

export const TIER_BADGE: Record<ConfidenceTier, string> = {
  Speculative: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600",
  Indicative:  "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",
  Supported:   "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700",
  Robust:      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-700",
};

// ---------------------------------------------------------------------------
// SurfaceHeadline — "answer first" bold verdict + tier accent
// ---------------------------------------------------------------------------

export function SurfaceHeadline({
  text,
  tier,
  label,
  className,
}: {
  text: string;
  tier: ConfidenceTier;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-l-4 pl-4 mb-1",
        TIER_BORDER_L[tier],
        className,
      )}
      data-testid="surface-headline"
    >
      <p className="text-sm font-semibold text-foreground leading-snug">{text}</p>
      <div className="flex items-center gap-2 mt-1.5">
        <span
          className={cn(
            "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold",
            TIER_BADGE[tier],
          )}
        >
          {tier}
        </span>
        {label && (
          <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SurfaceSection — accordion with optional preview text
// ---------------------------------------------------------------------------

export function SurfaceSection({
  title,
  preview,
  children,
  defaultOpen = false,
  testId,
}: {
  title: string;
  preview?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  testId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="border border-border rounded-lg overflow-hidden"
      data-testid={testId}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1 pr-2">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          {!open && preview && (
            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{preview}</p>
          )}
        </div>
        {open
          ? <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-border px-3 pb-3 pt-2.5 bg-muted/5">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CitationRow — compact citation with score + claim state
// ---------------------------------------------------------------------------

export function CitationRow({ citation }: { citation: CorpusCitation }) {
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-border/60 last:border-0">
      {citation.score != null && (
        <span className="text-[10px] font-mono text-muted-foreground w-8 pt-0.5 shrink-0 tabular-nums">
          {Math.round(citation.score * 100)}%
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground font-medium line-clamp-2 leading-snug">
          {citation.title}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {citation.organisation ?? citation.publisher ?? citation.funder ?? ""}
        </p>
      </div>
      {citation.claim_state && (
        <ClaimStateBadge
          state={citation.claim_state}
          rationale={citation.claim_rationale}
          showLabel={false}
          className="shrink-0 mt-0.5"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FitBadge — Met / Partial / Gap
// ---------------------------------------------------------------------------

const FIT_STYLES: Record<string, string> = {
  Met:     "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700",
  Partial: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",
  Gap:     "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
  Unknown: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

export function FitBadge({ fit }: { fit: string }) {
  const cls = FIT_STYLES[fit] ?? FIT_STYLES.Unknown;
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold", cls)}>
      {fit}
    </span>
  );
}

// ---------------------------------------------------------------------------
// MoveBadge — recommended action type
// ---------------------------------------------------------------------------

const MOVE_STYLES: Record<string, string> = {
  apply_now:       "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
  evidence_build:  "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  reposition:      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
  seek_partner:    "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300",
  monitor:         "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
  bid:             "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
  partner:         "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300",
  reject:          "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300",
};

export function MoveBadge({ move }: { move: string }) {
  const cls = MOVE_STYLES[move] ?? MOVE_STYLES.monitor;
  const label = move.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold", cls)}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// EvidenceCountStrip — summary bar of citation states
// ---------------------------------------------------------------------------

export function EvidenceCountStrip({ citations }: { citations: CorpusCitation[] }) {
  if (citations.length === 0) return null;
  const stated   = citations.filter((c) => c.claim_state === "stated").length;
  const inferred = citations.filter((c) => c.claim_state === "inferred").length;
  const unknown  = citations.filter((c) => c.claim_state === "unknown").length;
  const contested = citations.filter((c) => c.claim_state === "contested").length;

  return (
    <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
      <span>{citations.length} sources</span>
      {stated > 0    && <span className="text-teal-600 dark:text-teal-400">✓ {stated} stated</span>}
      {inferred > 0  && <span className="text-amber-600 dark:text-amber-400">~ {inferred} inferred</span>}
      {unknown > 0   && <span className="text-slate-500">? {unknown} unknown</span>}
      {contested > 0 && <span className="text-red-600 dark:text-red-400">⚠ {contested} contested</span>}
    </div>
  );
}
