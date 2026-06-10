/**
 * Atlas Workbench — Visual Registry
 *
 * Single source of truth for the contract between backend block builders and
 * frontend block renderers. Every `block.visual` value emitted by
 * `buildAtlasRenderModel()` must appear in this registry.
 *
 * Rules:
 *  - Each block type has exactly one PRIMARY visual (the current renderer).
 *  - ALTERNATIVE visuals are defined now so the Art Director can choose them
 *    later without inventing arbitrary strings.
 *  - `selectVisualRecipe()` resolves the effective visual for a given
 *    block type + requested visual. Falls back to the primary.
 *  - `validateBlockVisual()` is called by BlockRenderer in dev mode to catch
 *    backend drift early.
 *
 * When the Art Director is wired:
 *   selectVisualRecipe(blockType, dataShape, intent) → VisualId
 * For now it is deterministic.
 */

import type { RenderBlock } from "./atlas-render-model";

// ---------------------------------------------------------------------------
// Visual identifier union — every allowed visual string lives here
// ---------------------------------------------------------------------------

export type VisualId =
  // RecommendationConfidence
  | "decision_card"
  // EvidenceStateSummary
  | "evidence_state_bar"
  | "evidence_coverage_donut"
  // DimensionGap
  | "source_target_gap_rows"
  | "gap_matrix"
  // MatchBench
  | "evidence_map_table"
  | "requirement_coverage_matrix"
  // ClaimLedger
  | "claim_audit_ledger"
  // ActionPlan
  | "gap_to_action_timeline"
  | "action_checklist"
  // ObjectionResponse
  | "objection_response_table"
  // ProvenanceTrace
  | "evidence_trail"
  // ComparisonMatrix
  | "stored_match_list"
  | "match_score_bar"
  // ContextCard
  | "paired_context_cards";

// ---------------------------------------------------------------------------
// Registry entry
// ---------------------------------------------------------------------------

export interface VisualRegistryEntry {
  /** The block type this entry describes */
  blockType: RenderBlock["type"];
  /** Visual currently rendered by the block component */
  primary: VisualId;
  /**
   * Visuals the Art Director may select in future.
   * Must all be renderable by the same block component or a future variant.
   */
  alternatives: VisualId[];
  /** Human description for documentation */
  description: string;
}

// ---------------------------------------------------------------------------
// Registry definition
// ---------------------------------------------------------------------------

export const VISUAL_REGISTRY: Record<RenderBlock["type"], VisualRegistryEntry> = {
  RecommendationConfidence: {
    blockType: "RecommendationConfidence",
    primary: "decision_card",
    alternatives: [],
    description: "Headline decision, confidence tier badge, similarity score, and cap reason.",
  },
  EvidenceStateSummary: {
    blockType: "EvidenceStateSummary",
    primary: "evidence_state_bar",
    alternatives: ["evidence_coverage_donut"],
    description: "Breakdown of claim evidence states: verified / self-reported / inferred / unknown / contested.",
  },
  DimensionGap: {
    blockType: "DimensionGap",
    primary: "source_target_gap_rows",
    alternatives: ["gap_matrix"],
    description: "Sorted list of evidence gaps with magnitude, severity, and what would change.",
  },
  MatchBench: {
    blockType: "MatchBench",
    primary: "evidence_map_table",
    alternatives: ["requirement_coverage_matrix"],
    description: "Claim-by-claim evidence verdict table with evidence state and judgement.",
  },
  ClaimLedger: {
    blockType: "ClaimLedger",
    primary: "claim_audit_ledger",
    alternatives: [],
    description: "Full collapsible audit ledger of passport claims with domain, state, and match verdict.",
  },
  ActionPlan: {
    blockType: "ActionPlan",
    primary: "gap_to_action_timeline",
    alternatives: ["action_checklist"],
    description: "Sequenced actions linked to gaps, with owner attribution.",
  },
  ObjectionResponse: {
    blockType: "ObjectionResponse",
    primary: "objection_response_table",
    alternatives: [],
    description: "Challenge / response pairs for Defend mode with evidence state.",
  },
  ProvenanceTrace: {
    blockType: "ProvenanceTrace",
    primary: "evidence_trail",
    alternatives: [],
    description: "Evidence provenance path showing how claims were derived.",
  },
  ComparisonMatrix: {
    blockType: "ComparisonMatrix",
    primary: "stored_match_list",
    alternatives: ["match_score_bar"],
    description: "Browse-mode list of available matches with scores and funder.",
  },
  ContextCard: {
    blockType: "ContextCard",
    primary: "paired_context_cards",
    alternatives: [],
    description: "Side-by-side source/target context cards.",
  },
};

// ---------------------------------------------------------------------------
// selectVisualRecipe — deterministic resolver
//
// When the Art Director is introduced, it will call this with additional
// dataShape / intent parameters and select from VISUAL_REGISTRY[blockType].alternatives.
// Until then, this always returns the primary visual (or the requested one if valid).
// ---------------------------------------------------------------------------

export function selectVisualRecipe(
  blockType: RenderBlock["type"],
  requestedVisual?: string,
): VisualId {
  const entry = VISUAL_REGISTRY[blockType];
  if (!entry) return "decision_card"; // safe fallback — should never happen

  if (!requestedVisual) return entry.primary;

  const allowed: VisualId[] = [entry.primary, ...entry.alternatives];
  if (allowed.includes(requestedVisual as VisualId)) {
    return requestedVisual as VisualId;
  }

  // Requested visual is not registered — fall back to primary and let
  // validateBlockVisual() emit the dev warning.
  return entry.primary;
}

// ---------------------------------------------------------------------------
// validateBlockVisual — dev-time contract check
//
// Call from BlockRenderer with every rendered block. Returns null if valid,
// or a string describing the issue if not. The caller decides whether to
// warn / throw / log.
// ---------------------------------------------------------------------------

export function validateBlockVisual(
  blockType: RenderBlock["type"],
  visual: string,
): string | null {
  const entry = VISUAL_REGISTRY[blockType];
  if (!entry) {
    return `Unknown block type "${blockType}" — not in visual registry.`;
  }

  const allowed: VisualId[] = [entry.primary, ...entry.alternatives];
  if (!allowed.includes(visual as VisualId)) {
    return (
      `Block "${blockType}" emitted visual "${visual}" which is not in the registry. ` +
      `Allowed: ${allowed.join(", ")}. Falling back to primary: "${entry.primary}".`
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// getAllowedVisuals — utility for documentation / debug panels
// ---------------------------------------------------------------------------

export function getAllowedVisuals(blockType: RenderBlock["type"]): VisualId[] {
  const entry = VISUAL_REGISTRY[blockType];
  if (!entry) return [];
  return [entry.primary, ...entry.alternatives];
}
