/**
 * Atlas Workbench — DB row types + normalizers.
 *
 * Maps raw `atlas.*` rows into the clean AtlasRenderModel block content types.
 * All shapes here were verified against the live DB (afysgjiczzptubonbuxs) before
 * writing — see notes inline.
 *
 * Key realities this module handles:
 *  - evidence_map is an object keyed by the 8-char prefix of passport_claims.id,
 *    valued by a verdict-prefixed judgement sentence.
 *  - gaps is an array of { gap_type, severity, gap_description } with severity
 *    high/medium/low (NOT the workbench enum).
 *  - confidence_tier in DB is self_reported / ai_inferred (NOT the workbench enum).
 *  - match_score is numeric 0–1 (pg returns it as a string).
 *  - Only ~30 of 85 matches have populated evidence_map + gaps; the rest are {} / [].
 */

import type {
  EvidenceState,
  Provenance,
  GapItem,
  GapMagnitude,
  GapSeverity,
  MatchBenchItem,
  ClaimLedgerItem,
  EvidenceVerdict,
  EvidenceStateSummaryCounts,
} from "./atlas-render-model";

// ---------------------------------------------------------------------------
// Raw DB row types (exactly the columns the builder selects)
// ---------------------------------------------------------------------------

export interface MatchRow {
  id: string;
  passport_id: string | null;
  project_id: string | null;
  live_call_id: string | null;
  match_type: "project" | "live_call";
  match_score: string | number | null; // numeric → string from pg
  match_summary: string | null;
  evidence_map: Record<string, string> | null;
  gaps: RawGap[] | null;
  gap_value_estimate: string | number | null;
  created_at: string | null;
}

export interface RawGap {
  gap_type?: string;
  severity?: string; // high | medium | low (observed)
  gap_description?: string;
  addressable_by?: string;
}

export interface PassportRow {
  id: string;
  title: string | null;
  project_name: string | null;
  project_description: string | null;
  summary: string | null;
  owner_org: string | null;
  trl_level: number | null;
  sector_origin: string | null;
  sector_target: string | null;
}

export interface ClaimRow {
  id: string;
  passport_id: string;
  claim_role: string | null;
  claim_domain: string | null;
  claim_text: string | null;
  conditions: string | null;
  confidence_tier: string | null; // self_reported | ai_inferred (observed)
  confidence_reason: string | null;
  source_excerpt: string | null;
  verified_at: string | null;
  rejected: boolean | null;
}

export interface ProjectRow {
  id: string;
  title: string | null;
  lead_funder: string | null;
  funding_amount: string | number | null;
  abstract: string | null;
  lead_org_name: string | null;
}

export interface LiveCallRow {
  id: string;
  title: string | null;
  funder: string | null;
  funding_amount: string | number | null;
  description: string | null;
  deadline: string | null;
  status: string | null;
}

// ---------------------------------------------------------------------------
// Scalar normalizers
// ---------------------------------------------------------------------------

/** pg returns numeric as string; coerce safely. */
export function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize DB confidence_tier → workbench EvidenceState.
 * DB values observed: self_reported, ai_inferred. verified_at promotes to "verified".
 */
export function normalizeEvidenceState(
  dbTier: string | null,
  verifiedAt?: string | null,
): EvidenceState {
  if (verifiedAt) return "verified";
  const t = (dbTier ?? "").toLowerCase().replace(/[\s-]/g, "_");
  switch (t) {
    case "verified":
      return "verified";
    case "self_reported":
      return "self-reported";
    case "ai_inferred":
    case "inferred":
      return "inferred";
    case "contested":
      return "contested";
    default:
      return "unknown";
  }
}

/** Map DB gap severity (high/medium/low) → workbench severity + magnitude. */
export function normalizeGapSeverity(
  raw: string | undefined,
): { severity: GapSeverity; magnitude: GapMagnitude } {
  switch ((raw ?? "").toLowerCase()) {
    case "high":
    case "critical":
      return { severity: "critical", magnitude: "large" };
    case "medium":
    case "moderate":
      return { severity: "significant", magnitude: "medium" };
    case "low":
    case "minor":
      return { severity: "minor", magnitude: "small" };
    default:
      return { severity: "significant", magnitude: "unknown" };
  }
}

/**
 * Parse the leading verdict phrase from an evidence_map judgement sentence.
 * Observed prefixes: "Partial alignment — …", "Not addressed — …".
 */
export function parseVerdict(judgement: string): EvidenceVerdict {
  const head = judgement.slice(0, 40).toLowerCase();
  if (/\bnot addressed|\bnot relevant|\bno mention|\bnot mapped/.test(head)) {
    return "not mapped";
  }
  if (/\bpartial/.test(head)) return "partial";
  if (/\bstrong|\bdirect|\bclose alignment|\bfully/.test(head)) return "strong";
  if (/\brelevant|\baligns?/.test(head)) return "relevant";
  if (/\bcontext/.test(head)) return "contextual";
  return "judgement";
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ---------------------------------------------------------------------------
// Collection mappers
// ---------------------------------------------------------------------------

/** Map raw gaps[] → GapItem[]. Severity drives both severity and magnitude. */
export function mapGaps(raw: RawGap[] | null): GapItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((g, i) => {
    const { severity, magnitude } = normalizeGapSeverity(g.severity);
    const gapType = g.gap_type ?? "general";
    return {
      id: `gap-${i}`,
      gap_type: gapType,
      title: `${capitalize(gapType)} gap`,
      magnitude,
      severity,
      description: g.gap_description ?? "No description provided.",
      provenance: "derived" as Provenance,
      evidence_state: "inferred" as EvidenceState,
      what_would_change: g.addressable_by ?? undefined,
    };
  });
}

/** Index claims by the 8-char prefix of their id (matches evidence_map keys). */
export function indexClaimsByPrefix(claims: ClaimRow[]): Map<string, ClaimRow> {
  const m = new Map<string, ClaimRow>();
  for (const c of claims) m.set(c.id.slice(0, 8), c);
  return m;
}

/**
 * Map evidence_map → MatchBenchItem[] by joining keys to claim prefixes.
 * Key = 8-char prefix of passport_claims.id; value = verdict-prefixed judgement.
 */
export function mapEvidenceMap(
  evidenceMap: Record<string, string> | null,
  claims: ClaimRow[],
): MatchBenchItem[] {
  if (!evidenceMap || typeof evidenceMap !== "object") return [];
  const byPrefix = indexClaimsByPrefix(claims);

  return Object.entries(evidenceMap).map(([prefix, judgement], i) => {
    const claim = byPrefix.get(prefix);
    return {
      id: `evidence-${i}`,
      claim_id: claim?.id ?? prefix,
      claim_text: claim?.claim_text ?? `Claim ${prefix}`,
      verdict: parseVerdict(judgement),
      judgement,
      evidence_state: normalizeEvidenceState(
        claim?.confidence_tier ?? null,
        claim?.verified_at,
      ),
      provenance: "derived" as Provenance,
      source_excerpt: claim?.source_excerpt ?? null,
      confidence_reason: claim?.confidence_reason ?? undefined,
    };
  });
}

/**
 * Map claims → ClaimLedgerItem[], enriched with evidence_map verdict/judgement
 * where a claim's prefix appears in evidence_map.
 */
export function mapClaims(
  claims: ClaimRow[],
  evidenceMap: Record<string, string> | null,
): ClaimLedgerItem[] {
  return claims
    .filter((c) => !c.rejected)
    .map((c) => {
      const prefix = c.id.slice(0, 8);
      const judgement = evidenceMap?.[prefix];
      return {
        id: c.id,
        claim_id: c.id,
        claim_text: c.claim_text ?? "Untitled claim",
        domain: c.claim_domain ?? "general",
        role: c.claim_role ?? "asserts",
        conditions: c.conditions ?? null,
        evidence_state: normalizeEvidenceState(c.confidence_tier, c.verified_at),
        provenance: "stored" as Provenance,
        source_excerpt: c.source_excerpt ?? null,
        confidence_reason: c.confidence_reason ?? undefined,
        evidence_map_verdict: judgement ? parseVerdict(judgement) : undefined,
        evidence_map_judgement: judgement ?? undefined,
      };
    });
}

/** Tally evidence states across claims for EvidenceStateSummary. */
export function countEvidenceStates(claims: ClaimRow[]): EvidenceStateSummaryCounts {
  const counts: EvidenceStateSummaryCounts = {
    verified: 0,
    "self-reported": 0,
    inferred: 0,
    unknown: 0,
    contested: 0,
  };
  for (const c of claims) {
    if (c.rejected) continue;
    counts[normalizeEvidenceState(c.confidence_tier, c.verified_at)] += 1;
  }
  return counts;
}
