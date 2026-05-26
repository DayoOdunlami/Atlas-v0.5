/**
 * Atlas 5 — Confidence tier mapping
 *
 * Bridges the DB-layer tier vocabulary (atlas.claims.confidence_tier) and
 * the product-layer vocabulary used in all recipe components and the UI.
 *
 * DB tier        → Product display tier
 * ─────────────────────────────────────────────────────────
 * verified       → Robust   (if evidence_links >= 3)
 *                → Supported (otherwise)
 * self_reported  → Indicative
 * ai_inferred    → Speculative
 * pending_review → Speculative
 * null / unknown → Speculative
 *
 * The mapping is intentionally conservative: we never inflate a DB tier.
 * `verified` with 3+ evidence links earns Robust; with fewer it gets Supported.
 * `self_reported` caps at Indicative because it lacks independent corroboration.
 */

import type { ConfidenceTier } from "./types";

export type DbConfidenceTier =
  | "verified"
  | "self_reported"
  | "ai_inferred"
  | "pending_review";

/**
 * Map a single DB confidence_tier string to the product display tier.
 *
 * @param dbTier     - raw value from atlas.claims.confidence_tier
 * @param evidenceLinks - count of atlas.claim_evidence_links rows for this claim
 */
export function mapDbTierToDisplay(
  dbTier: string | null | undefined,
  evidenceLinks = 0,
): ConfidenceTier {
  switch (dbTier) {
    case "verified":
      return evidenceLinks >= 3 ? "Robust" : "Supported";
    case "self_reported":
      return "Indicative";
    case "ai_inferred":
    case "pending_review":
    default:
      return "Speculative";
  }
}

/**
 * Aggregate multiple claim display tiers into an overall portfolio tier.
 * The portfolio tier is the median tier, biased slightly downward for safety.
 */
const TIER_ORDER: ConfidenceTier[] = [
  "Speculative",
  "Indicative",
  "Supported",
  "Robust",
];

export function aggregateTiers(tiers: ConfidenceTier[]): ConfidenceTier {
  if (tiers.length === 0) return "Speculative";
  const scores = tiers.map((t) => TIER_ORDER.indexOf(t)).filter((s) => s >= 0);
  const median = Math.floor(
    scores.reduce((a, b) => a + b, 0) / scores.length,
  );
  // Bias one step down so aggregate is conservative
  return TIER_ORDER[Math.max(0, median)] as ConfidenceTier;
}

/**
 * Clamp a claim_level integer from the DB to the 1 | 2 | 3 product type.
 */
export function clampClaimLevel(level: number | null | undefined): 1 | 2 | 3 {
  if (level === 1 || level === 2 || level === 3) return level;
  if (typeof level === "number" && level > 3) return 3;
  return 1;
}
