"use client";

/**
 * DefendSurface — DEFEND recipe
 *
 * 1. HeadlineCard — confidence tier statement
 * 2. Evidence tree — collapsible rows (claim + badge + source; expanded = full + rationale)
 * 3. Objection cards — adversarial framing / response / what_would_change
 * 4. Assumptions list — numbered, each with confidence tier badge
 * 5. Overall confidence verdict with visual weight
 *
 * Tested with Speculative fixture — low visual weight throughout.
 */

import { useState } from "react";
import type { ArtifactBlock } from "@/lib/atlas5/artifact-store";
import type { ConfidenceTier } from "@/lib/atlas5/types";
import { cn } from "@/lib/utils";
import { getConfidenceStyles } from "@/lib/atlas5/confidence-styles";
import { ClaimStateBadge } from "@/components/atlas5/claim-state-badge";
import { ChevronDown, ChevronRight, AlertCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

interface EvidenceTreeItem {
  id: string;
  claim: string;
  claim_state: import("@/lib/atlas5/types").ClaimState;
  source: string;
  rationale?: string;
}

interface ObjectionCard {
  id: string;
  objection: string;
  response: string;
  what_would_change: string;
}

interface AssumptionItem {
  id: string;
  text: string;
  confidence_tier: ConfidenceTier;
  basis?: string;
}

// ---------------------------------------------------------------------------
// Tier badge (for assumptions)
// ---------------------------------------------------------------------------

const TIER_BADGE: Record<ConfidenceTier, string> = {
  Speculative: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600",
  Indicative:  "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",
  Supported:   "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700",
  Robust:      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-700",
};

// ---------------------------------------------------------------------------
// HeadlineCard
// ---------------------------------------------------------------------------

function DefendHeadline({
  tier,
  text,
  styles,
}: {
  tier: ConfidenceTier;
  text?: string;
  styles: ReturnType<typeof getConfidenceStyles>;
}) {
  const tierStatement: Record<ConfidenceTier, string> = {
    Speculative: "Evidence base is Speculative. Key assumptions are unverified. Do not use for investment decisions.",
    Indicative:  "Evidence base is Indicative. Core claims are plausible but not fully evidenced.",
    Supported:   "Evidence base is Supported. Primary claims are verified; minor gaps remain.",
    Robust:      "Evidence base is Robust. All primary claims are verified and independently corroborated.",
  };

  return (
    <div
      data-testid="defend-headline-card"
      className={cn("rounded-lg border p-3.5 bg-muted/20", styles.border)}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        Confidence Verdict
      </p>
      <p className={cn("text-sm font-medium leading-snug", styles.headline)}>
        {text ?? tierStatement[tier]}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence tree
// ---------------------------------------------------------------------------

function EvidenceTreeRow({
  item,
  styles,
}: {
  item: EvidenceTreeItem;
  styles: ReturnType<typeof getConfidenceStyles>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={open}
      >
        <ClaimStateBadge
          state={item.claim_state}
          showLabel={false}
          className="shrink-0 mt-0.5"
        />
        <p className={cn("text-xs flex-1 leading-snug", styles.body)}>
          {item.claim}
        </p>
        <span className="text-[10px] text-muted-foreground truncate max-w-[30%] shrink-0 text-right">
          {item.source}
        </span>
        {open ? (
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
        )}
      </button>

      {open && item.rationale && (
        <div className="border-t border-border px-3 py-2.5 bg-muted/10 space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Rationale
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">{item.rationale}</p>
          <p className="text-[10px] text-muted-foreground/70">Source: {item.source}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Objection cards
// ---------------------------------------------------------------------------

function ObjectionCardItem({
  card,
  styles,
}: {
  card: ObjectionCard;
  styles: ReturnType<typeof getConfidenceStyles>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      data-testid={`defend-objection-${card.id}`}
      className="rounded-lg border border-red-200/60 dark:border-red-900/60 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors"
        aria-expanded={open}
      >
        <AlertCircle className="size-3.5 text-red-500 shrink-0 mt-0.5" />
        <p className={cn("text-xs flex-1 leading-snug italic text-foreground/80", styles.body)}>
          {card.objection}
        </p>
        {open ? (
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
        )}
      </button>

      {open && (
        <div className="border-t border-red-200/40 dark:border-red-900/40 px-3 py-2.5 bg-muted/10 space-y-2.5">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
              Response
            </p>
            <p className="text-xs leading-relaxed">{card.response}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
              Would change if
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed italic">
              {card.what_would_change}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assumptions list
// ---------------------------------------------------------------------------

function AssumptionsList({
  assumptions,
  styles,
}: {
  assumptions: AssumptionItem[];
  styles: ReturnType<typeof getConfidenceStyles>;
}) {
  if (assumptions.length === 0) return null;

  return (
    <div data-testid="defend-assumptions" className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Assumptions ({assumptions.length})
      </p>
      <ol className="space-y-2">
        {assumptions.map((a, i) => (
          <li
            key={a.id}
            className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 px-2.5 py-2"
          >
            <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5 w-4 text-right">
              {i + 1}.
            </span>
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs leading-snug", styles.body)}>{a.text}</p>
              {a.basis && (
                <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{a.basis}</p>
              )}
            </div>
            <span
              className={cn(
                "inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold shrink-0",
                TIER_BADGE[a.confidence_tier],
              )}
            >
              {a.confidence_tier}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  artifact: ArtifactBlock;
}

export function DefendSurface({ artifact }: Props) {
  const sections = artifact.sections ?? {};
  const styles = getConfidenceStyles(artifact.confidence_tier);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extra = artifact as any;
  const evidenceItems: EvidenceTreeItem[] = extra.defend_evidence ?? [];
  const objections: ObjectionCard[] = extra.defend_objections ?? [];
  const assumptions: AssumptionItem[] = extra.defend_assumptions ?? [];

  const headlineText = sections["Headline"];

  return (
    <div
      className={cn("space-y-1", styles.container)}
      data-testid="recipe-defend"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Evidence Trail — DEFEND
        </span>
        <span
          data-testid="confidence-tier-badge"
          className={cn(
            "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
            styles.badge,
          )}
        >
          {artifact.confidence_tier}
        </span>
      </div>

      <div className="p-4 space-y-5">
        {/* 1. Headline */}
        <DefendHeadline
          tier={artifact.confidence_tier}
          text={headlineText}
          styles={styles}
        />

        {/* 2. Evidence tree */}
        {evidenceItems.length > 0 && (
          <div data-testid="defend-evidence-tree" className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Evidence Tree
            </p>
            {evidenceItems.map((item) => (
              <EvidenceTreeRow key={item.id} item={item} styles={styles} />
            ))}
          </div>
        )}

        {/* Fallback: corpus citations as evidence tree */}
        {evidenceItems.length === 0 && (artifact.corpus_citations ?? []).length > 0 && (
          <div data-testid="defend-evidence-tree" className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Evidence
            </p>
            {(artifact.corpus_citations ?? []).map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 px-2.5 py-2"
              >
                {c.claim_state && (
                  <ClaimStateBadge
                    state={c.claim_state}
                    rationale={c.claim_rationale}
                    showLabel={false}
                    className="shrink-0 mt-0.5"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium leading-snug">{c.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {c.organisation ?? c.publisher ?? ""}
                  </p>
                </div>
                {c.score != null && (
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                    {Math.round(c.score * 100)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 3. Objections */}
        {objections.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Objections &amp; Responses
            </p>
            {objections.map((card) => (
              <ObjectionCardItem key={card.id} card={card} styles={styles} />
            ))}
          </div>
        )}

        {/* 4. Assumptions */}
        <AssumptionsList assumptions={assumptions} styles={styles} />
      </div>
    </div>
  );
}
