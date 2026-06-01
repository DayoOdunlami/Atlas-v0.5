"use client";

/**
 * ConnectSurface — CONNECT recipe
 *
 * 1. HeadlineCard — "N opportunity routes worth exploring"
 * 2. Opportunity cards (up to 5): fit_reason, fit_band badge, entry_friction chips,
 *    "Diagnose fit →" [FRONTEND]
 * 3. Sector Bridge card when cross_modal_bridges present
 * 4. Confidence tier visual weight
 */

import type { ArtifactBlock } from "@/lib/atlas5/artifact-store";
import { cn } from "@/lib/utils";
import { getConfidenceStyles } from "@/lib/atlas5/confidence-styles";
import { ClaimStateBadge } from "@/components/atlas5/claim-state-badge";
import { ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FitBand = "Strong" | "Moderate" | "Weak";

interface OpportunityCard {
  id: string;
  title: string;
  funder?: string;
  fit_reason: string;
  fit_band: FitBand;
  entry_friction_tags: string[];
  deadline?: string | null;
  value_gbm?: number;
  claim_state?: import("@/lib/atlas5/types").ClaimState;
  claim_rationale?: string;
}

interface SectorBridge {
  source_sector: string;
  target_sector: string;
  bridge_score: number;
  why_connected: string;
}

// ---------------------------------------------------------------------------
// Visual config
// ---------------------------------------------------------------------------

const FIT_BAND_STYLE: Record<FitBand, string> = {
  Strong:   "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700",
  Moderate: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",
  Weak:     "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600",
};

const FRICTION_LABELS: Record<string, string> = {
  consortium_required:          "Consortium",
  commercial_deployment_evidence: "Deployment evidence",
  evidence_gap:                 "Evidence gap",
  rural_delivery_track_record:  "Rural track record",
  industry_match_30pct:         "30% match",
  international_consortium:     "Intl. consortium",
  eligibility_uncertain:        "Eligibility ?",
};

// ---------------------------------------------------------------------------
// Headline
// ---------------------------------------------------------------------------

function ConnectHeadline({
  opportunityCount,
  headline,
  styles,
}: {
  opportunityCount: number;
  headline?: string;
  styles: ReturnType<typeof getConfidenceStyles>;
}) {
  return (
    <div
      data-testid="connect-headline-card"
      className={cn("rounded-lg border p-3.5 bg-muted/20", styles.border)}
    >
      <p className={cn("text-sm font-semibold leading-snug", styles.headline)}>
        {headline ?? `${opportunityCount} opportunity route${opportunityCount !== 1 ? "s" : ""} worth exploring`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Opportunity card
// ---------------------------------------------------------------------------

function OpportunityCardItem({
  card,
  styles,
  onDiagnose,
}: {
  card: OpportunityCard;
  styles: ReturnType<typeof getConfidenceStyles>;
  onDiagnose: (id: string) => void;
}) {
  const fitStyle = FIT_BAND_STYLE[card.fit_band] ?? FIT_BAND_STYLE.Weak;

  return (
    <div
      data-testid={`connect-opportunity-${card.id}`}
      className={cn(
        "rounded-lg border bg-card p-3.5 space-y-2.5",
        card.fit_band === "Strong"
          ? "border-emerald-200 dark:border-emerald-800"
          : card.fit_band === "Moderate"
          ? "border-amber-200 dark:border-amber-800"
          : "border-border",
      )}
    >
      {/* Title + fit band */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-semibold leading-snug", styles.headline)}>
            {card.title}
          </p>
          {card.funder && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{card.funder}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {card.claim_state && (
            <ClaimStateBadge
              state={card.claim_state}
              rationale={card.claim_rationale}
              showLabel={false}
            />
          )}
          <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold", fitStyle)}>
            {card.fit_band}
          </span>
        </div>
      </div>

      {/* Fit reason */}
      <p className={cn("text-xs leading-relaxed", styles.body)}>
        {card.fit_reason}
      </p>

      {/* Deadline + value */}
      {(card.deadline || card.value_gbm) && (
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          {card.deadline && (
            <span>Deadline: <span className="font-medium text-foreground">{card.deadline}</span></span>
          )}
          {card.value_gbm && (
            <span>Value: <span className="font-medium text-foreground">£{card.value_gbm}m</span></span>
          )}
        </div>
      )}

      {/* Entry friction chips */}
      {card.entry_friction_tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.entry_friction_tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium bg-muted text-muted-foreground"
              title={FRICTION_LABELS[tag] ?? tag}
            >
              {FRICTION_LABELS[tag] ?? tag.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      {/* Diagnose fit action */}
      <button
        type="button"
        onClick={() => onDiagnose(card.id)}
        data-testid={`connect-diagnose-${card.id}`}
        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 transition-colors"
      >
        Diagnose fit
        <ArrowRight className="size-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sector bridge card
// ---------------------------------------------------------------------------

function SectorBridgeCard({
  bridge,
  styles,
}: {
  bridge: SectorBridge;
  styles: ReturnType<typeof getConfidenceStyles>;
}) {
  const pct = Math.min(100, Math.max(0, bridge.bridge_score));
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-slate-400";

  return (
    <div
      data-testid="connect-sector-bridge"
      className={cn("rounded-lg border p-3.5 space-y-2.5 bg-violet-50/50 dark:bg-violet-950/20", "border-violet-200 dark:border-violet-800")}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
        Cross-Sector Bridge
      </p>

      <div className="flex items-center gap-2 text-xs font-medium">
        <span className="text-foreground">{bridge.source_sector}</span>
        <ArrowRight className="size-3 text-muted-foreground shrink-0" />
        <span className="text-foreground">{bridge.target_sector}</span>
      </div>

      {/* Bridge score bar */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Bridge score</span>
          <span className="font-mono font-semibold">{pct}/100</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <p className={cn("text-xs leading-relaxed", styles.body)}>
        {bridge.why_connected}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  artifact: ArtifactBlock;
}

export function ConnectSurface({ artifact }: Props) {
  const sections = artifact.sections ?? {};
  const styles = getConfidenceStyles(artifact.confidence_tier);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extra = artifact as any;
  const opportunities: OpportunityCard[] = extra.connect_opportunities ?? [];
  const bridge: SectorBridge | undefined = extra.connect_bridge;

  const headlineText = sections["Headline"];

  const handleDiagnose = (id: string) => {
    // [FRONTEND] — switch recipe to 'diagnose', pass opportunity id as context
    console.info("[FRONTEND] Diagnose fit for opportunity:", id);
    window.alert(`[Demo] Diagnose surface for ${id} — wired at surface gateway level.`);
  };

  return (
    <div
      className={cn("space-y-1", styles.container)}
      data-testid="recipe-connect"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Opportunities — CONNECT
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

      <div className="p-4 space-y-4">
        {/* 1. Headline */}
        <ConnectHeadline
          opportunityCount={opportunities.length}
          headline={headlineText}
          styles={styles}
        />

        {/* 2. Opportunity cards */}
        {opportunities.slice(0, 5).map((card) => (
          <OpportunityCardItem
            key={card.id}
            card={card}
            styles={styles}
            onDiagnose={handleDiagnose}
          />
        ))}

        {/* 3. Sector bridge */}
        {bridge && <SectorBridgeCard bridge={bridge} styles={styles} />}

        {opportunities.length === 0 && (
          <p className="text-sm text-muted-foreground italic text-center py-6">
            No opportunities identified. Run ORIENT first to build the terrain map.
          </p>
        )}
      </div>
    </div>
  );
}
