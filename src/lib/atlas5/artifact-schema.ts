/**
 * Atlas 5 — Zod schemas for artefact contract validation (Tier 2)
 *
 * These schemas mirror the TypeScript interfaces in types.ts and the
 * ArtifactBlock shape in artifact-store.ts. They are the authoritative
 * machine-readable contract between Python agents and the Next.js frontend.
 *
 * Usage:
 *   import { ArtifactBlockSchema } from "@/lib/atlas5/artifact-schema";
 *   const result = ArtifactBlockSchema.safeParse(payload);
 *   if (!result.success) console.warn(result.error.issues);
 *
 * Security: no Next.js server-module imports — safe to use in client components.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitive enums
// ---------------------------------------------------------------------------

export const ConfidenceTierSchema = z.enum([
  "Speculative",
  "Indicative",
  "Supported",
  "Robust",
]);

/**
 * Claim state — epistemic status of a citation, gap row, or assertion.
 * Principle 3: "Never show a claim without its state."
 *
 * stated    = directly extracted from a cited source
 * inferred  = agent-derived from adjacent evidence; tooltip shows rationale
 * unknown   = no data found
 * contested = sources conflict; tooltip shows both positions
 */
export const ClaimStateSchema = z.enum([
  "stated",
  "inferred",
  "unknown",
  "contested",
]);

export const RecipeTypeSchema = z.enum([
  "brief_five_case",
  "evidence_panel",
  "stats_dashboard",
  "scenario_stress_test",
  "orient",
  "connect",
  "diagnose",
  "act",
  "defend",
  "organisation_profile",
]);

export const SourceTypeSchema = z.enum([
  "project",
  "live_call",
  "knowledge_doc",
  "knowledge_chunk",
  "hive_chunk",
  "hive_article",
]);

// ---------------------------------------------------------------------------
// Citation schemas
// ---------------------------------------------------------------------------

export const CorpusCitationSchema = z.object({
  /** Record UUID — verified against atlas.projects in DB (H1 hardening) */
  id: z.string().uuid("corpus citation id must be a UUID"),
  title: z.string().min(1),
  /**
   * Semantic similarity score 0–1.
   * Required on artefact citations; optional for context-only prior_citations.
   */
  score: z.number().min(0).max(1).optional(),
  source_type: SourceTypeSchema.optional(),
  organisation: z.string().optional(),
  relevance_note: z.string().optional(),
  funder: z.string().optional(),
  deadline: z.string().nullable().optional(),
  chunk_id: z.string().optional(),
  document_id: z.string().optional(),
  publisher: z.string().optional(),
  article_id: z.string().optional(),
  /** Epistemic status of this citation — Principle 3 */
  claim_state: ClaimStateSchema.optional(),
  /** Rationale for inferred/contested states — shown in tooltip */
  claim_rationale: z.string().optional(),
});

export const HiveCitationSchema = z.object({
  /** hive.articles.id UUID — verified in DB at agent runtime */
  article_id: z.string().uuid("hive citation article_id must be a UUID"),
  title: z.string().min(1),
  score: z.number().min(0).max(1).optional(),
  chunk_id: z.string().optional(),
  transport_mode: z.string().optional(),
  relevance_note: z.string().optional(),
  /** Epistemic status of this citation — Principle 3 */
  claim_state: ClaimStateSchema.optional(),
  /** Rationale for inferred/contested states — shown in tooltip */
  claim_rationale: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Chart schemas
// ---------------------------------------------------------------------------

export const ChartDataRecordSchema = z.record(
  z.string(),
  z.union([z.string(), z.number()]),
);

export const LineChartSpecSchema = z.object({
  type: z.literal("line"),
  title: z.string(),
  x: z.string(),
  y: z.string(),
});

export const BarChartSpecSchema = z.object({
  type: z.literal("bar"),
  title: z.string(),
  x: z.string(),
  y: z.string(),
});

export const PieChartSpecSchema = z.object({
  type: z.literal("pie"),
  title: z.string(),
  x: z.string(),
  y: z.string(),
});

export const ChartSpecSchema = z.discriminatedUnion("type", [
  LineChartSpecSchema,
  BarChartSpecSchema,
  PieChartSpecSchema,
]);

/** A chart spec with embedded data — travels with the artefact */
export const ChartSchema = z.intersection(
  ChartSpecSchema,
  z.object({ data: z.array(ChartDataRecordSchema) }),
);

// ---------------------------------------------------------------------------
// DecisionSpine schema
// ---------------------------------------------------------------------------

export const DecisionSpineSchema = z.object({
  decision: z.string().min(1),
  recommendation: z.string().min(1),
  confidence_tier: ConfidenceTierSchema,
  key_assumption: z.string().min(1),
  next_action: z.string().min(1),
  framework: z.string().optional(),
  strongest_objection: z.string().optional(),
  would_change_if: z.string().optional(),
});

// ---------------------------------------------------------------------------
// EvidenceCoverage schema
// ---------------------------------------------------------------------------

export const EvidenceCoverageSchema = z.object({
  projects_found: z.number().int().min(0),
  live_calls_found: z.number().int().min(0),
  knowledge_docs_found: z.number().int().min(0),
  hive_chunks_found: z.number().int().min(0),
  source_diversity: z.number().min(0).max(1),
  top_similarity: z.number().min(0).max(1),
  average_similarity: z.number().min(0).max(1),
  evidence_gaps: z.array(z.string()),
  suggested_confidence_tier: ConfidenceTierSchema,
  coverage_note: z.enum(["thin", "adequate", "strong"]),
});

// ---------------------------------------------------------------------------
// EvidenceGap schema (CICERONE: HAVE / PARTIAL / MISSING)
// ---------------------------------------------------------------------------

export const EvidenceGapSchema = z.object({
  area: z.string(),
  status: z.enum(["HAVE", "PARTIAL", "MISSING"]),
  note: z.string(),
});

// ---------------------------------------------------------------------------
// AtlasRoutingGap schema (ATLAS: lane / provider / tool shape)
//
// Three routing concepts — never conflated:
//   recommended_source_lane  WHY  (intent)
//   recommended_provider     WHO  (source identity, not the search tool)
//   available_tool           HOW  (honest about today's capability)
//
// GovUK is an ACCESS ROUTE, not a provider identity for known publishers.
// DfT/CCAV/NationalHighways documents hosted on GOV.UK use govuk_search
// as available_tool but have their real publisher as recommended_provider.
// ---------------------------------------------------------------------------

export const RoutingLaneSchema = z.enum([
  "internal_precedent",
  "official_policy",
  "funding",
  "procurement",
  "research",
  "market_discovery",
  "ingestion_backlog",
]);

export const RoutingProviderSchema = z.enum([
  "InnovateUK",
  "DfT",
  "NationalHighways",
  "CCAV",
  "UKRI",
  "HorizonEurope",
  "FindATender",
  "Exa",
  "GovUK", // fallback only — prefer specific publisher
  "CPC_Corpus",
]);

export const AvailableToolSchema = z.enum([
  "cpc_corpus",
  "live_calls",
  "govuk_search", // DfT / CCAV / NH access route
  "exa_search", // market_discovery / landscape gaps
  "future_innovateuk_api", // not yet integrated
  "future_tender_api", // not yet integrated
  "none_yet", // no tool exists today
]);

export const AtlasRoutingGapSchema = z.object({
  type: z.enum(["retrieval_gap", "corpus_gap", "landscape_gap"]),
  topic: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  reason: z.string(),
  recommended_action: z.string(),
  recommended_source_lane: RoutingLaneSchema,
  recommended_provider: RoutingProviderSchema,
  available_tool: AvailableToolSchema,
  /** Will finding this evidence raise the confidence_tier? */
  can_lift_confidence: z.boolean(),
  /** "direct" = cite; "candidate" = human review; "background" = context only */
  citation_status: z.enum(["direct", "candidate", "background"]),
});

// ---------------------------------------------------------------------------
// ExternalCitation schema (govuk_search / exa_search results)
// Kept separate from corpus_citations — require human review before citing.
// ---------------------------------------------------------------------------

export const ExternalCitationSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  snippet: z.string().optional(),
  /** Actual publisher — NOT the search tool (govuk_search → DfT/CCAV, not GovUK) */
  recommended_provider: RoutingProviderSchema,
  retrieval_tool: z.enum(["govuk_search", "exa_search"]),
  citation_status: z.enum(["candidate", "background"]),
  score: z.number().min(0).max(1).optional(),
  published_date: z.string().optional(),
});

// ---------------------------------------------------------------------------
// ArtifactBlock schema
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sprint UX surface-specific schemas
// ---------------------------------------------------------------------------

export const OrientDomainSchema = z.object({
  domain: z.string(),
  evidence_count: z.number().int().min(0),
  cpc_projects: z.number().int().min(0).optional(),
  open_calls: z.number().int().min(0).optional(),
  maturity: z.enum(["low", "medium", "high"]).optional(),
});

export const ConnectOpportunitySchema = z.object({
  id: z.string(),
  title: z.string(),
  funder: z.string().optional(),
  fit_reason: z.string(),
  fit_band: z.enum(["Strong", "Moderate", "Weak"]),
  entry_friction_tags: z.array(z.string()),
  deadline: z.string().nullable().optional(),
  value_gbm: z.number().optional(),
  claim_state: ClaimStateSchema.optional(),
  claim_rationale: z.string().optional(),
});

export const DefendEvidenceItemSchema = z.object({
  id: z.string(),
  claim: z.string(),
  claim_state: ClaimStateSchema,
  source: z.string(),
  rationale: z.string().optional(),
});

export const DefendObjectionSchema = z.object({
  id: z.string(),
  objection: z.string(),
  response: z.string(),
  what_would_change: z.string(),
});

export const DefendAssumptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  confidence_tier: ConfidenceTierSchema,
  basis: z.string().optional(),
});

export const ArtifactBlockSchema = z.object({
  type: z.enum(["brief", "evidence", "chart", "scenario"]),
  recipe: RecipeTypeSchema.optional(),
  sections: z.record(z.string(), z.string()).optional(),
  npv_value: z.number().nullable().optional(),
  discount_rate: z.number().optional(),
  optimism_bias: z.number().nullable().optional(),
  corpus_citations: z.array(CorpusCitationSchema).optional(),
  hive_citations: z.array(HiveCitationSchema).optional(),
  chart_specs: z.array(ChartSchema).optional(),
  transferability_score: z.number().min(0).max(100).optional(),
  sector_analogues: z.array(z.string()).optional(),
  evidence_gaps: z.array(EvidenceGapSchema).optional(),
  /** ATLAS routing gaps — lane/provider/tool shape (distinct from CICERONE gaps) */
  routing_gaps: z.array(AtlasRoutingGapSchema).optional(),
  /** External search results — govuk_search / exa_search (human review required) */
  external_citations: z.array(ExternalCitationSchema).optional(),
  transport_mode: z.string().optional(),
  confidence_tier: ConfidenceTierSchema,
  analysis: z.string().optional(),
  /** @deprecated use chart_specs instead */
  chart_spec: z.record(z.string(), z.unknown()).optional(),
  agent: z.string().optional(),
  timestamp: z.string().optional(),

  // ── Sprint UX surface-specific optional fields ───────────────────────────
  // ORIENT
  orient_domains: z.array(OrientDomainSchema).optional(),
  cpc_position: z.object({
    lens: z.string(),
    strongest_domain: z.string().optional(),
    whitespace_domain: z.string().optional(),
    summary: z.string(),
  }).optional(),

  // CONNECT
  connect_opportunities: z.array(ConnectOpportunitySchema).optional(),
  connect_bridge: z.object({
    source_sector: z.string(),
    target_sector: z.string(),
    bridge_score: z.number().min(0).max(100),
    why_connected: z.string(),
    evidence_ids: z.array(z.string()).optional(),
  }).optional(),

  // DIAGNOSE
  diagnose_gaps: z.array(z.object({
    criterion: z.string(),
    response: z.string(),
    claim_state: ClaimStateSchema.optional(),
    claim_rationale: z.string().optional(),
    fit: z.enum(["Met", "Partial", "Gap", "Unknown"]),
    evidence_count: z.number().int().min(0),
  })).optional(),
  entry_friction_tags: z.array(z.string()).optional(),
  move_type: z.enum(["apply_now", "reposition", "evidence_build", "seek_partner", "monitor", "stop", "escalate"]).optional(),
  move_rationale: z.string().optional(),
  what_would_change: z.string().optional(),

  // DEFEND
  defend_evidence: z.array(DefendEvidenceItemSchema).optional(),
  defend_objections: z.array(DefendObjectionSchema).optional(),
  defend_assumptions: z.array(DefendAssumptionSchema).optional(),
});

// ---------------------------------------------------------------------------
// Annotation payload — partial schema for use-atlas5-chat.ts validation
//
// This validates only the fields most at risk of silent truncation:
// recipe, confidence_tier, chart_specs, and decision_spine.
// The full ArtifactBlock schema is for explicit validation contexts only.
// ---------------------------------------------------------------------------

export const AnnotationPayloadSchema = z
  .object({
    recipe: RecipeTypeSchema.optional(),
    confidence_tier: ConfidenceTierSchema.optional(),
    chart_specs: z
      .array(z.object({ type: z.string(), title: z.string() }).passthrough())
      .optional(),
    decision_spine: DecisionSpineSchema.optional(),
  })
  .passthrough(); // allow all other agent-specific fields through

// ---------------------------------------------------------------------------
// Inferred types (useful for strongly-typed test fixtures)
// ---------------------------------------------------------------------------

export type CorpusCitationInput = z.input<typeof CorpusCitationSchema>;
export type HiveCitationInput = z.input<typeof HiveCitationSchema>;
export type DecisionSpineInput = z.input<typeof DecisionSpineSchema>;
export type ArtifactBlockInput = z.input<typeof ArtifactBlockSchema>;
export type AtlasRoutingGapInput = z.input<typeof AtlasRoutingGapSchema>;
export type ExternalCitationInput = z.input<typeof ExternalCitationSchema>;
export type ClaimState = z.infer<typeof ClaimStateSchema>;
