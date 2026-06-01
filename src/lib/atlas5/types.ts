/**
 * Atlas 5 — shared types.
 *
 * These types are shared between the Next.js frontend and the Python
 * agent service (via Zod → JSON Schema → Pydantic codegen).
 *
 * DO NOT import server-only modules here — this file is imported by
 * both client and server components.
 */

// ---------------------------------------------------------------------------
// Agent + Lens identifiers
// ---------------------------------------------------------------------------

export type AgentId = "ATLAS" | "JARVIS" | "CICERONE" | "HYVE";

export type LensId = "CPC" | "Atlas" | "Ecosystem" | "Funder" | "Mode";

// ---------------------------------------------------------------------------
// Surface state (emitted by the surface gateway hook on every switch)
// ---------------------------------------------------------------------------

/**
 * Surface render mode.
 * - chat: two-pane layout (chat + artifact) — default
 * - canvas: tldraw full-screen, chat + artifact panes hidden
 */
export type SurfaceMode = "chat" | "canvas";

/**
 * SurfaceState is written to sessionStorage under the key "surface_state.json"
 * on every agent/lens/mode switch. The Playwright eval spec reads it from there.
 */
export interface SurfaceState {
  /** Which agent is currently active */
  active_agent: AgentId;
  /** Which lens is currently active */
  active_lens: LensId;
  /** Render mode: chat (default) or canvas (full-screen tldraw) */
  mode: SurfaceMode;
  /** CopilotKit / LangGraph thread id — null before first message */
  thread_id: string | null;
  /** ISO 8601 timestamp of last state change */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Confidence tier (carried on every agent response)
// ---------------------------------------------------------------------------

export type ConfidenceTier =
  | "Speculative"
  | "Indicative"
  | "Supported"
  | "Robust";

// ---------------------------------------------------------------------------
// Chart types (self-contained within atlas5 — no dependency on legacy lib)
// ---------------------------------------------------------------------------

export type ChartDataRecord = Record<string, string | number>;

export type LineChartSpec = {
  type: "line";
  title: string;
  x: string;
  y: string;
};
export type BarChartSpec = { type: "bar"; title: string; x: string; y: string };
export type PieChartSpec = { type: "pie"; title: string; x: string; y: string };
export type ChartSpec = LineChartSpec | BarChartSpec | PieChartSpec;

/** A chart spec with embedded data — travels with an artefact. */
export type Chart = ChartSpec & { data: ChartDataRecord[] };

// ---------------------------------------------------------------------------
// RecipeType — explicit render surface selector
// ---------------------------------------------------------------------------

export type RecipeType =
  | "brief_five_case"
  | "evidence_panel"
  | "stats_dashboard"
  | "scenario_stress_test"
  | "cpc_capability_assessment"
  | "cpc_portfolio_comparison"
  | "cpc_market_alignment"
  | "cpc_evidence_gaps"
  | "orient"
  | "connect"
  | "diagnose"
  | "act"
  | "defend";

// ---------------------------------------------------------------------------
// Claim state — Principle 3 (claim states are first-class citizens)
// ---------------------------------------------------------------------------

/**
 * Epistemic status of a citation, gap row, or assertion.
 *
 * stated    = directly extracted from a cited source
 * inferred  = agent-derived from adjacent evidence
 * unknown   = no data found
 * contested = sources conflict
 */
export type ClaimState = "stated" | "inferred" | "unknown" | "contested";

// ---------------------------------------------------------------------------
// CPC Capability Intelligence types
// ---------------------------------------------------------------------------

export type CpcClaimLevel = 1 | 2 | 3;

export interface CpcClaim {
  id: string;
  text: string;
  level: CpcClaimLevel;
  confidence_tier: ConfidenceTier;
  source_project?: string;
  source_excerpt?: string;
  business_unit?: string;
}

export interface CpcBusinessUnit {
  name: string;
  project_count: number;
  claim_count: number;
  l1_claims: number;
  l2_claims: number;
  l3_claims: number;
  evidence_links: number;
}

export interface CpcGap {
  area: string;
  severity: "low" | "medium" | "high";
  description: string;
  project_count?: number;
  claim_count?: number;
}

export type RecommendationAction = "bid" | "partner" | "monitor" | "reject";

// ---------------------------------------------------------------------------
// Source type (for citations)
// ---------------------------------------------------------------------------

export type SourceType =
  | "project"
  | "live_call"
  | "knowledge_doc"
  | "knowledge_chunk"
  | "hive_chunk"
  | "hive_article";

// ---------------------------------------------------------------------------
// Citation types
// ---------------------------------------------------------------------------

/** A verified citation from the CPC corpus */
export interface CorpusCitation {
  /** Record UUID — verified against DB before storage (H1 hardening) */
  id: string;
  title: string;
  /**
   * Semantic similarity score 0–1.
   * Required on artefact citations rendered in recipes.
   * Optional for prior_citations in context packets (context-only, not scored).
   */
  score?: number;
  source_type?: SourceType;
  // project
  organisation?: string;
  relevance_note?: string;
  // live_call
  funder?: string;
  deadline?: string | null;
  // knowledge types
  chunk_id?: string;
  document_id?: string;
  publisher?: string;
  // hive types
  article_id?: string;
  /** Epistemic status — Principle 3 */
  claim_state?: ClaimState;
  /** Rationale for inferred/contested states, shown in tooltip */
  claim_rationale?: string;
}

/** A verified citation from hive.articles */
export interface HiveCitation {
  /** hive.articles.id — UUID, verified in DB at agent runtime */
  article_id: string;
  /** hive.articles.project_title (fallback: measure_title) */
  title: string;
  /** Similarity score from vector search (0–1) */
  score?: number;
  /** hive.document_chunks.id — optional provenance */
  chunk_id?: string;
  transport_mode?: string;
  relevance_note?: string;
  /** Epistemic status — Principle 3 */
  claim_state?: ClaimState;
  /** Rationale for inferred/contested states, shown in tooltip */
  claim_rationale?: string;
}

// ---------------------------------------------------------------------------
// DecisionSpine — structured decision object (every substantive response)
// ---------------------------------------------------------------------------

export interface DecisionSpine {
  decision: string;
  recommendation: string;
  confidence_tier: ConfidenceTier;
  key_assumption: string;
  next_action: string;
  framework?: string;
  strongest_objection?: string;
  would_change_if?: string;
}

// ---------------------------------------------------------------------------
// External Evidence Router — lane / provider / tool taxonomy
// ---------------------------------------------------------------------------

/**
 * WHY are we searching? (intent lane)
 * Maps to recommended_source_lane on AtlasRoutingGap.
 */
export type RoutingLane =
  | "internal_precedent" // re-query Atlas corpus with a different strategy
  | "official_policy" // government policy, regulation, statistics
  | "funding" // innovation grants, R&D programmes, calls
  | "procurement" // contracts, tenders
  | "research" // academic, UKRI-funded, methodology
  | "market_discovery" // operator demand, WTP, commercial analogues
  | "ingestion_backlog"; // source found; queue for corpus enrichment

/**
 * WHO has the evidence? (source identity — not the search tool)
 * DfT/CCAV documents may be on GOV.UK, but the provider is DfT/CCAV.
 */
export type RoutingProvider =
  | "InnovateUK"
  | "DfT"
  | "NationalHighways"
  | "CCAV"
  | "UKRI"
  | "HorizonEurope"
  | "FindATender"
  | "Exa" // last resort for non-government sources
  | "GovUK" // only if no specific publisher can be identified
  | "CPC_Corpus";

/**
 * HOW do we call it today? (honest about capability)
 * "future_*" = not yet integrated.  "none_yet" = no tool exists.
 */
export type AvailableTool =
  | "cpc_corpus"
  | "live_calls"
  | "govuk_search"
  | "exa_search"
  | "future_innovateuk_api"
  | "future_tender_api"
  | "none_yet";

/**
 * A structured evidence gap from ATLAS corpus retrieval analysis.
 * Three routing concepts kept separate:
 *   recommended_source_lane  — WHY (intent)
 *   recommended_provider     — WHO (source identity)
 *   available_tool           — HOW today (honest)
 */
export interface AtlasRoutingGap {
  type: "retrieval_gap" | "corpus_gap" | "landscape_gap";
  topic: string;
  severity: "low" | "medium" | "high";
  reason: string;
  recommended_action: string;
  recommended_source_lane: RoutingLane;
  recommended_provider: RoutingProvider;
  available_tool: AvailableTool;
  /** Will retrieving this evidence raise the confidence_tier? */
  can_lift_confidence: boolean;
  /** "direct" = cite; "candidate" = flag for review; "background" = context only */
  citation_status: "direct" | "candidate" | "background";
}

// ---------------------------------------------------------------------------
// External Evidence — results from govuk_search / exa_search
// ---------------------------------------------------------------------------

/**
 * A result from an external evidence search (govuk_search or exa_search).
 * Kept separate from corpus_citations — external results require human review.
 * recommended_provider is the actual publisher, not the search tool.
 */
export interface ExternalCitation {
  url: string;
  title: string;
  snippet?: string;
  /** Actual publisher: DfT, CCAV, UKRI etc. — NOT "GovUK" or "Exa" unless unknown */
  recommended_provider: RoutingProvider;
  retrieval_tool: "govuk_search" | "exa_search";
  /** Always "candidate" or "background" — external results need human review */
  citation_status: "candidate" | "background";
  score?: number;
  published_date?: string;
}

// ---------------------------------------------------------------------------
// EvidenceCoverage — computed by set_artifact_block from verified citations
// ---------------------------------------------------------------------------

export interface EvidenceCoverage {
  projects_found: number;
  live_calls_found: number;
  knowledge_docs_found: number;
  hive_chunks_found: number;
  source_diversity: number;
  top_similarity: number;
  average_similarity: number;
  evidence_gaps: string[];
  suggested_confidence_tier: ConfidenceTier;
  coverage_note: "thin" | "adequate" | "strong";
}

// ---------------------------------------------------------------------------
// Context packet (assembled by the context assembler at D2)
// ---------------------------------------------------------------------------

export interface ContextPacket {
  thread_id: string;
  active_agent: AgentId;
  active_lens: LensId;
  /** Contents of skills/*.md files relevant to the active agent */
  active_skills: Array<{ name: string; content: string }>;
  /** Recent citations from atlas.briefs for this thread */
  prior_citations: CorpusCitation[];
}
