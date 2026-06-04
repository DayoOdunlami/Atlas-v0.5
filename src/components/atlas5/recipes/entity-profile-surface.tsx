"use client";

/**
 * EntityProfileSurface — the object-layer noun primitive (Sprint: Connect the Moat, Phase 2).
 *
 * ONE component, three configurations via `subject_type`:
 *   passport      → entity_profile block (claims grouped by domain)
 *   organisation  → entity_profile block pointed at corpus entity data
 *   swot          → evidence_aware_swot block (2x2, every cell claim-stated)
 *
 * Same skeleton for all three:
 *   identity header → claim-stated rows / quadrants → escalation buttons (noun→verb bridge)
 *
 * The moat rule: never render a claim without its claim_state. Every row carries a
 * ClaimStateBadge; self-reported claims are labelled as such via confidence_reason.
 *
 * Phase 2 = fixtures only. Phase 3 feeds this from the live entity_profile artefact.
 */

import type { ConfidenceTier } from "@/lib/atlas5/types";
import type {
  EntityProfileData,
  EvidenceAwareSwotData,
} from "@/lib/atlas5/block-vocabulary";
import { BlockRenderer } from "@/components/atlas5/block-renderer";
import { TIER_BORDER_L, TIER_BADGE } from "./surface-primitives";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Search, AlertTriangle } from "lucide-react";

export type EntitySubjectType = "passport" | "organisation" | "swot";

export interface EntityEscalation {
  label: string;
  /** Verb lane this noun escalates into. */
  target: "connect" | "diagnose" | "defend";
}

export interface EntityProfileSurfaceProps {
  subject_type: EntitySubjectType;
  identity: {
    name: string;
    subtitle?: string;
    confidence_tier?: ConfidenceTier;
  };
  /** passport | organisation configs */
  claim_groups?: EntityProfileData["claim_groups"];
  /** swot config */
  swot?: EvidenceAwareSwotData;
  /** Noun → verb bridge buttons. */
  escalations?: EntityEscalation[];
  /** Fired when an escalation is clicked (Phase 3 wires real navigation). */
  onEscalate?: (target: EntityEscalation["target"]) => void;
  compact?: boolean;
}

const SUBJECT_LABEL: Record<EntitySubjectType, string> = {
  passport: "Passport",
  organisation: "Organisation",
  swot: "Evidence-Aware SWOT",
};

const ESCALATION_ICON: Record<EntityEscalation["target"], React.ElementType> = {
  connect: ArrowUpRight,
  diagnose: Search,
  defend: AlertTriangle,
};

export function EntityProfileSurface({
  subject_type,
  identity,
  claim_groups,
  swot,
  escalations,
  onEscalate,
  compact = false,
}: EntityProfileSurfaceProps) {
  const tier = identity.confidence_tier ?? "Speculative";

  const topBlock =
    subject_type === "swot" ? (
      <BlockRenderer
        block={{
          type: "evidence_aware_swot",
          data: swot ?? { strengths: [], weaknesses: [], opportunities: [], threats: [] },
        }}
      />
    ) : (
      <BlockRenderer
        block={{
          type: "entity_profile",
          data: {
            identity: { ...identity, subject_type },
            claim_groups: claim_groups ?? [],
          } satisfies EntityProfileData,
        }}
      />
    );

  // Honest empty state — preserves the skeleton, never fakes claims.
  const isEmpty =
    subject_type === "swot"
      ? !swot ||
        [swot.strengths, swot.weaknesses, swot.opportunities, swot.threats].every(
          (q) => !q?.length,
        )
      : !claim_groups || !claim_groups.some((g) => g.claims?.length);

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-l-4 bg-card p-3",
        TIER_BORDER_L[tier],
      )}
      data-testid={`entity-profile-surface-${subject_type}`}
    >
      {/* Identity header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("font-semibold text-foreground leading-tight", compact ? "text-base" : "text-sm")}>
            {identity.name}
          </p>
          {identity.subtitle && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {identity.subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
            {SUBJECT_LABEL[subject_type]}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold",
              TIER_BADGE[tier],
            )}
          >
            {tier}
          </span>
        </div>
      </div>

      {/* Claim-stated rows / quadrants */}
      {isEmpty ? (
        <div className="flex min-h-[80px] items-center justify-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/10 px-4 text-center">
          <p className="text-xs text-muted-foreground">
            No claims yet — upload a passport or enrich the corpus to populate this profile.
          </p>
        </div>
      ) : (
        topBlock
      )}

      {/* Escalation buttons — noun → verb bridge */}
      {escalations && escalations.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {escalations.map((esc) => {
            const Icon = ESCALATION_ICON[esc.target];
            return (
              <button
                key={`${esc.target}-${esc.label}`}
                type="button"
                onClick={() => onEscalate?.(esc.target)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-border bg-background",
                  "px-2.5 py-1.5 text-xs font-medium text-foreground",
                  "hover:bg-muted/50 transition-colors",
                )}
                data-testid={`entity-escalation-${esc.target}`}
              >
                <Icon className="size-3.5 text-muted-foreground" />
                {esc.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
