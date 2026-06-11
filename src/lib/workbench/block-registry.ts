/**
 * Canonical analytical block types — locked Omega Block Library (+ EconomicCase recipe).
 *
 * Seam 3: single source for client-side validation. Python agent mirrors this set
 * in agents/workbench/graph.py valid_block_types.
 */

import type { RenderBlock } from "./atlas-render-model";

/** Registered block types the workbench renderer can mount. */
export const CANONICAL_BLOCK_TYPES = [
  "ContextCard",
  "OpportunityList",
  "ClaimLedger",
  "EvidenceStateSummary",
  "ProvenanceTrace",
  "MatchBench",
  "DimensionGap",
  "ComparisonMatrix",
  "NetworkMap",
  "TransferLanes",
  "RecommendationConfidence",
  "ActionPlan",
  "ObjectionResponse",
  "EconomicCase", // Five Case recipe block (demote to recipe-only later)
] as const satisfies readonly RenderBlock["type"][];

export type CanonicalBlockType = (typeof CANONICAL_BLOCK_TYPES)[number];

const CANONICAL_SET = new Set<string>(CANONICAL_BLOCK_TYPES);

export function isCanonicalBlockType(type: string): type is CanonicalBlockType {
  return CANONICAL_SET.has(type);
}

/** Returns null if valid, otherwise a human-readable rejection reason. */
export function validateBlockType(type: string): string | null {
  if (isCanonicalBlockType(type)) return null;
  return (
    `Block type "${type}" is not registered. Valid types: ${CANONICAL_BLOCK_TYPES.join(", ")}.`
  );
}
