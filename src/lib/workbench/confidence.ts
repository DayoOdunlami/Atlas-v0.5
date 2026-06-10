/**
 * Atlas Workbench — deterministic confidence logic.
 *
 * Ported from agents/atlas/citation_guard.py (85 lines, no LLM) and adapted to
 * the workbench's evidence model. Single source of truth for confidence tiers
 * so the deterministic builder and (later) the agent lane agree.
 *
 * Original citation_guard rule (verified-citation count → tier):
 *   0 → Speculative, 1–2 → Indicative, 3–4 → Supported, 5+ → Robust
 *
 * Workbench adaptation: derive a base tier from match strength, then CAP it by
 * evidence quality (verified vs self-reported/inferred) and gap severity.
 * The cap is the conservative half — you can never claim more confidence than
 * the weakest evidence justifies.
 */

import type {
  ConfidenceTier,
  EvidenceStateSummaryCounts,
  GapItem,
} from "./atlas-render-model";

const TIER_ORDER: ConfidenceTier[] = [
  "Speculative",
  "Indicative",
  "Supported",
  "Robust",
];

function tierRank(t: ConfidenceTier): number {
  return TIER_ORDER.indexOf(t);
}

/** Return the more conservative (lower) of two tiers. */
export function minTier(a: ConfidenceTier, b: ConfidenceTier): ConfidenceTier {
  return tierRank(a) <= tierRank(b) ? a : b;
}

/**
 * Literal citation_guard port: tier from verified-evidence count.
 * Kept for parity with the Python lane and future agent use.
 */
export function tierFromCitationCount(count: number): ConfidenceTier {
  if (count >= 5) return "Robust";
  if (count >= 3) return "Supported";
  if (count >= 1) return "Indicative";
  return "Speculative";
}

/** Base tier from match similarity score (0–1). */
function baseTierFromScore(matchScore: number | null): ConfidenceTier {
  if (matchScore === null) return "Speculative";
  if (matchScore >= 0.6) return "Robust";
  if (matchScore >= 0.45) return "Supported";
  if (matchScore >= 0.3) return "Indicative";
  return "Speculative";
}

export interface ConfidenceResult {
  tier: ConfidenceTier;
  capReason: string;
  /** Notes worth surfacing in data_quality_notes */
  notes: string[];
}

/**
 * Derive the committed confidence tier + human cap reason.
 *
 * @param counts        evidence-state tally across passport claims
 * @param totalClaims   number of (non-rejected) claims
 * @param gaps          normalized gaps (severity already mapped)
 * @param matchScore    0–1 similarity score
 */
export function deriveConfidence(
  counts: EvidenceStateSummaryCounts,
  totalClaims: number,
  gaps: GapItem[],
  matchScore: number | null,
): ConfidenceResult {
  const notes: string[] = [];

  if (totalClaims === 0) {
    return {
      tier: "Speculative",
      capReason: "No passport claims available to assess this match.",
      notes: ["Match has no associated passport claims."],
    };
  }

  const base = baseTierFromScore(matchScore);
  let cap: ConfidenceTier = "Robust";
  const reasons: string[] = [];

  // Cap 1 — no independently verified evidence
  if (counts.verified === 0) {
    cap = minTier(cap, "Indicative");
    const dominant =
      counts["self-reported"] >= counts.inferred ? "self-reported" : "inferred";
    reasons.push(
      `all ${totalClaims} passport claims are ${dominant}; no independently verified evidence`,
    );
  }

  // Cap 2 — critical gaps
  const criticalGaps = gaps.filter((g) => g.severity === "critical");
  if (criticalGaps.length > 0) {
    cap = minTier(cap, "Indicative");
    reasons.push(
      `${criticalGaps.length} critical evidence gap${criticalGaps.length > 1 ? "s" : ""}`,
    );
  }

  // Cap 3 — contested evidence present
  if (counts.contested > 0) {
    cap = minTier(cap, "Indicative");
    reasons.push(`${counts.contested} contested claim(s)`);
  }

  const tier = minTier(base, cap);

  const capReason =
    reasons.length > 0
      ? `Capped at ${tier}: ${reasons.join("; ")}.`
      : `${tier} — supported by match strength and evidence coverage.`;

  if (tier !== base) {
    notes.push(
      `Confidence capped from ${base} to ${tier} (${reasons.join("; ")}).`,
    );
  }

  return { tier, capReason, notes };
}

/**
 * TODO (Milestone 0.9): when the agent lane proposes deltas, route the final
 * confidence through the full citation_guard (headline softening, citation
 * verification) rather than this deterministic subset.
 */
