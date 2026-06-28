import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";

export const CASE_CLAIM_KINDS = [
  "fact",
  "domain",
  "constraint",
  "hypothesis",
  "uncertainty",
] as const;

export type CaseClaimKind = (typeof CASE_CLAIM_KINDS)[number];

export type CaseClaimReviewStatus = "pending" | "confirmed" | "rejected";

export type CaseClaim = {
  id: string;
  text: string;
  kind: CaseClaimKind;
  review_status: CaseClaimReviewStatus;
  confidence_tier?: string;
  source: "declared";
};

export type CaseFileSnapshot = {
  thread_id: string;
  case_entity_id: string | null;
  claims: CaseClaim[];
  persist_enabled: boolean;
};

export type CaseEntitySummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  claim_count: number;
};

const KIND_RE = /Stated by user · (\w+) · max Indicative/;

export function parseKindFromCaveat(caveat?: string): CaseClaimKind {
  const m = caveat?.match(KIND_RE);
  const raw = m?.[1]?.toLowerCase();
  if (raw && CASE_CLAIM_KINDS.includes(raw as CaseClaimKind)) {
    return raw as CaseClaimKind;
  }
  return "fact";
}

export function declaredClaimsFromSpec(spec: AnswerSpec | null): CaseClaim[] {
  if (!spec?.claims?.length) return [];
  return spec.claims
    .filter((c) => c.source === "declared")
    .map((c) => ({
      id: c.id,
      text: c.text,
      kind: parseKindFromCaveat(c.caveat),
      review_status:
        c.claim_state === "stated"
          ? "confirmed"
          : c.claim_state === "unknown"
            ? "rejected"
            : "pending",
      confidence_tier: c.tier,
      source: "declared" as const,
    }));
}

export function mergeDeclaredClaims(
  primary: CaseClaim[],
  fallback: CaseClaim[],
): CaseClaim[] {
  const byId = new Map<string, CaseClaim>();
  for (const c of fallback) byId.set(c.id, c);
  for (const c of primary) byId.set(c.id, c);
  return Array.from(byId.values()).slice(0, 12);
}

export const CASE_CLAIM_KIND_LABELS: Record<CaseClaimKind, string> = {
  fact: "Fact",
  domain: "Domain",
  constraint: "Constraint",
  hypothesis: "Hypothesis",
  uncertainty: "Uncertainty",
};

export const SWOT_ON_CLAIMS_PROMPT =
  "Run a SWOT analysis on my stated case file claims — map strengths, weaknesses, opportunities, and threats from what I declared, and add corpus evidence only where it clearly supports or challenges a claim.";
