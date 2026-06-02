/**
 * Atlas 5 — Artifact store (D7)
 *
 * Zustand store that holds the current structured agent output
 * (artifact_block.json contract). Populated by useAtlas5Chat when
 * the /api/copilotkit route emits a data annotation.
 *
 * JSON contract (from CLAUDE.md):
 * {
 *   type: 'brief' | 'evidence' | 'chart',
 *   sections?: Record<string, string>,            // Five Case Model
 *   corpus_citations?: CorpusCitation[],
 *   hive_citations?: HiveCitation[],
 *   npv_value?: number,
 *   discount_rate?: number,
 *   optimism_bias?: number,
 *   confidence_tier: ConfidenceTier,
 *   analysis?: string,
 *   chart_spec?: object,
 *   // CICERONE-specific
 *   transferability_score?: number,
 *   sector_analogues?: string[],
 *   evidence_gaps?: EvidenceGap[],
 *   // HYVE-specific
 *   transport_mode?: string,
 *   agent?: string,
 *   timestamp?: string,
 * }
 */
"use client";

import { create } from "zustand";

import type {
  AtlasRoutingGap,
  Chart,
  ConfidenceTier,
  CorpusCitation,
  CpcBusinessUnit,
  CpcClaim,
  CpcGap,
  DecisionSpine,
  EvidenceCoverage,
  ExternalCitation,
  HiveCitation,
  RecommendationAction,
  RecipeType,
  VisualBlock,
} from "./types";

export type { VisualBlock };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** CICERONE gap shape (transferability analysis: HAVE / PARTIAL / MISSING) */
export interface EvidenceGap {
  area: string;
  status: "HAVE" | "PARTIAL" | "MISSING";
  note: string;
}

// Re-export ATLAS routing types for consumers that only import from artifact-store
export type { AtlasRoutingGap, ExternalCitation } from "./types";

export interface ArtifactBlock {
  type: "brief" | "evidence" | "chart" | "scenario";

  // ── Recipe (explicit render surface selector) ───────────────────────────
  // Preferred over section-name inference. Set by the agent via set_artifact_block().
  recipe?: RecipeType;

  // ── Content ────────────────────────────────────────────────────────────
  // sections keys use Title Case: "Strategic Case", "Economic Case", etc.
  // (legacy lowercase keys "strategic", "economic" still handled by BriefView fallback)
  sections?: Record<string, string>;
  npv_value?: number | null;
  discount_rate?: number;
  optimism_bias?: number | null;

  // ── Citations ──────────────────────────────────────────────────────────
  corpus_citations?: CorpusCitation[];
  hive_citations?: HiveCitation[];

  // ── Charts (artefact-owned — travel with the artefact) ─────────────────
  // Distinct from workspace charts on AgentState.charts.
  chart_specs?: Chart[];

  // ── Visual blocks (art director output — supersedes chart_specs) ────────
  // Emitted by build_visual_blocks() in verify_citations.
  // Rendered by BlockRenderer; falls back to chart_specs if absent.
  visual_blocks?: VisualBlock[];

  // ── ATLAS evidence routing gaps ────────────────────────────────────────
  // Structured gaps from detect_evidence_gaps() + LLM domain analysis.
  // Uses the lane/provider/tool shape (NOT the CICERONE HAVE/PARTIAL/MISSING shape).
  routing_gaps?: AtlasRoutingGap[];

  // ── External evidence (Commit 2: govuk_search + exa_search) ────────────
  // Kept separate from corpus_citations — require human review before citing.
  external_citations?: ExternalCitation[];

  // ── Transferability (CICERONE) ─────────────────────────────────────────
  transferability_score?: number;
  sector_analogues?: string[];
  evidence_gaps?: EvidenceGap[];

  // ── HYVE ───────────────────────────────────────────────────────────────
  transport_mode?: string;

  // ── CPC Capability Intelligence ────────────────────────────────────────
  cpc_claims?: CpcClaim[];
  cpc_portfolio?: CpcBusinessUnit[];
  cpc_gaps?: CpcGap[];
  recommendation_action?: RecommendationAction;
  recommendation_rationale?: string;

  // ── Defend mode ────────────────────────────────────────────────────────
  // entry_friction_tags from Diagnose mode (cpc_evidence_gaps recipe)
  entry_friction_tags?: string[];

  // ── Common ─────────────────────────────────────────────────────────────
  confidence_tier: ConfidenceTier;
  analysis?: string;
  /** @deprecated use chart_specs instead */
  chart_spec?: object;

  // ── Provenance ─────────────────────────────────────────────────────────
  agent?: string;
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface ReasoningStep {
  node?: string;
  thought: string;
  evidence_count?: number;
}

interface ArtifactState {
  artifact: ArtifactBlock | null;
  decisionSpine: DecisionSpine | null;
  evidenceCoverage: EvidenceCoverage | null;
  isLoading: boolean;
  statusText: string | undefined;
  /** Live reasoning trace — steps append as each LangGraph node completes. */
  reasoningTrace: ReasoningStep[];
  setArtifact: (block: ArtifactBlock) => void;
  /**
   * Set a partial (mid-run) artifact — does NOT clear isLoading or statusText.
   * Use for intermediate state from build_five_case before verify_citations runs.
   */
  setPartialArtifact: (block: ArtifactBlock) => void;
  setDecisionSpine: (spine: DecisionSpine) => void;
  setEvidenceCoverage: (coverage: EvidenceCoverage) => void;
  setLoading: (loading: boolean) => void;
  /** Clear the loading/thinking state without touching the artifact itself. */
  clearLoading: () => void;
  setStatusText: (text: string | undefined) => void;
  setReasoningTrace: (trace: ReasoningStep[]) => void;
  startRun: () => void;
  clearArtifact: () => void;
}

export const useArtifactStore = create<ArtifactState>((set) => ({
  artifact: null,
  decisionSpine: null,
  evidenceCoverage: null,
  isLoading: false,
  statusText: undefined,
  reasoningTrace: [],
  setArtifact: (block) => set({ artifact: block, isLoading: false, statusText: undefined }),
  setPartialArtifact: (block) => set({ artifact: block }), // keeps isLoading + statusText + reasoningTrace
  setDecisionSpine: (spine) => set({ decisionSpine: spine }),
  setEvidenceCoverage: (coverage) => set({ evidenceCoverage: coverage }),
  setLoading: (loading) => set({ isLoading: loading }),
  clearLoading: () => set({ isLoading: false, statusText: undefined, reasoningTrace: [] }),
  setStatusText: (text) => set({ statusText: text }),
  setReasoningTrace: (trace) => set({ reasoningTrace: trace }),
  startRun: () => set({ artifact: null, decisionSpine: null, evidenceCoverage: null, isLoading: true, statusText: undefined, reasoningTrace: [] }),
  clearArtifact: () =>
    set({
      artifact: null,
      decisionSpine: null,
      evidenceCoverage: null,
      isLoading: false,
      statusText: undefined,
      reasoningTrace: [],
    }),
}));

// ---------------------------------------------------------------------------
// Builder helpers — convert raw agent JSON to ArtifactBlock
// ---------------------------------------------------------------------------

/**
 * Derive the ArtifactBlock.type from an explicit recipe value.
 * Falls back to the agent-specific default when recipe is absent.
 */
function typeFromRecipe(
  recipe: RecipeType | undefined,
  fallback: ArtifactBlock["type"],
): ArtifactBlock["type"] {
  switch (recipe) {
    case "brief_five_case":
      return "brief";
    case "evidence_panel":
      return "evidence";
    case "stats_dashboard":
      return "chart";
    case "scenario_stress_test":
      return "scenario";
    default:
      return fallback;
  }
}

export function buildArtifactFromAtlas(
  data: Record<string, unknown>,
): ArtifactBlock {
  const recipe = data.recipe as RecipeType | undefined;

  // Bridge Defend mode claims[] to the shape DefendSurface reads (defend_evidence[])
  type RawClaim = { text?: string; state?: string; confidence_tier?: string; source?: string };
  const rawClaims = (data.claims as RawClaim[] | undefined) ?? [];
  const defendEvidence = rawClaims.length > 0
    ? rawClaims.map((c, i) => ({
        id: String(i),
        claim: c.text ?? "",
        claim_state: (c.state ?? "inferred") as import("./types").ClaimState,
        source: c.source ?? "",
      }))
    : undefined;

  const block: ArtifactBlock = {
    type: typeFromRecipe(recipe, "brief"),
    recipe,
    // Prefer title-case sections (run_atlas "sections" field) over legacy lowercase
    // five_case_model. Both are present in the payload; sections has correct keys.
    sections:
      (data.sections as Record<string, string> | undefined) ??
      (data.five_case_model as Record<string, string> | undefined) ??
      {},
    npv_value: data.npv_value as number | null | undefined,
    discount_rate: data.discount_rate as number | undefined,
    optimism_bias: data.optimism_bias as number | null | undefined,
    corpus_citations:
      (data.corpus_citations as CorpusCitation[] | undefined) ?? [],
    chart_specs: data.chart_specs as Chart[] | undefined,
    visual_blocks: data.visual_blocks as VisualBlock[] | undefined,
    confidence_tier: (data.confidence_tier as ConfidenceTier) ?? "Speculative",
    // Routing gaps from ATLAS evidence gap analysis (lane/provider/tool shape)
    routing_gaps: (data.evidence_gaps as AtlasRoutingGap[] | undefined) ?? [],
    // External citations (populated by Commit 2 external evidence router)
    external_citations:
      (data.external_citations as ExternalCitation[] | undefined) ?? [],
    // Diagnose mode (cpc_evidence_gaps)
    entry_friction_tags: data.entry_friction_tags as string[] | undefined,
    agent: "ATLAS",
    timestamp: new Date().toISOString(),
  };

  // Attach bridged defend_evidence via dynamic property (read by DefendSurface via `as any`)
  if (defendEvidence) {
    (block as unknown as Record<string, unknown>).defend_evidence = defendEvidence;
  }

  return block;
}

export function buildArtifactFromJarvis(
  data: Record<string, unknown>,
): ArtifactBlock {
  const recipe = data.recipe as RecipeType | undefined;
  return {
    type: typeFromRecipe(recipe, "evidence"),
    recipe,
    corpus_citations:
      (data.corpus_citations as CorpusCitation[] | undefined) ?? [],
    chart_specs: data.chart_specs as Chart[] | undefined,
    confidence_tier: (data.confidence_tier as ConfidenceTier) ?? "Speculative",
    analysis: data.analysis as string | undefined,
    agent: "JARVIS",
    timestamp: new Date().toISOString(),
  };
}

export function buildArtifactFromCicerone(
  data: Record<string, unknown>,
): ArtifactBlock {
  const recipe = data.recipe as RecipeType | undefined;
  return {
    type: typeFromRecipe(recipe, "evidence"),
    recipe,
    transferability_score: data.transferability_score as number | undefined,
    sector_analogues: (data.sector_analogues as string[] | undefined) ?? [],
    evidence_gaps: (data.evidence_gaps as EvidenceGap[] | undefined) ?? [],
    corpus_citations:
      (data.corpus_citations as CorpusCitation[] | undefined) ?? [],
    chart_specs: data.chart_specs as Chart[] | undefined,
    confidence_tier: (data.confidence_tier as ConfidenceTier) ?? "Speculative",
    analysis: data.analysis as string | undefined,
    agent: "CICERONE",
    timestamp: new Date().toISOString(),
  };
}

export function buildArtifactFromHyve(
  data: Record<string, unknown>,
): ArtifactBlock {
  const recipe = data.recipe as RecipeType | undefined;
  return {
    type: typeFromRecipe(recipe, "evidence"),
    recipe,
    hive_citations: (data.hive_citations as HiveCitation[] | undefined) ?? [],
    transport_mode: data.transport_mode as string | undefined,
    chart_specs: data.chart_specs as Chart[] | undefined,
    confidence_tier: (data.confidence_tier as ConfidenceTier) ?? "Speculative",
    analysis: data.analysis as string | undefined,
    agent: "HYVE",
    timestamp: new Date().toISOString(),
  };
}
