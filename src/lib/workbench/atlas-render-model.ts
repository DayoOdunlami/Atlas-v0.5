// Atlas Render Model — TypeScript types matching atlas_v10_render_models.json
// Source of truth: static JSON. No Supabase, no agent calls.

export type CanonicalQuestionId =
  | "cq.match.browse"
  | "cq.match.workbench"
  | "cq.match.act"
  | "cq.match.defend";

export type EvidenceState =
  | "verified"
  | "self-reported"
  | "inferred"
  | "unknown"
  | "contested";

export type Provenance = "stored" | "derived" | "live-gap";

export type GapMagnitude = "small" | "medium" | "large" | "unknown";

export type GapSeverity = "minor" | "significant" | "critical";

export type ConfidenceTier =
  | "Speculative"
  | "Indicative"
  | "Supported"
  | "Robust";

export type EvidenceVerdict =
  | "strong"
  | "partial"
  | "relevant"
  | "contextual"
  | "judgement"
  | "not mapped";

// ---------------------------------------------------------------------------
// Source / target objects
// ---------------------------------------------------------------------------

export interface SourceObject {
  type: "passport";
  id: string;
  title: string;
  summary: string;
}

export interface TargetObject {
  type: "project";
  id: string;
  title: string;
  funder?: string;
  status?: string;
  funding_amount?: number;
  lead_org?: string;
  abstract?: string;
}

// ---------------------------------------------------------------------------
// Decision spine
// ---------------------------------------------------------------------------

export interface DecisionSpine {
  recommendation: string;
  decision: string;
  summary: string;
  confidence_tier: ConfidenceTier;
  confidence_cap_reason: string;
  score: number;
  economic_gap_value?: number;
}

// ---------------------------------------------------------------------------
// Block content types
// ---------------------------------------------------------------------------

export interface GapItem {
  id: string;
  gap_type: string;
  title: string;
  magnitude: GapMagnitude;
  severity: GapSeverity;
  description: string;
  provenance: Provenance;
  evidence_state: EvidenceState;
  what_would_change?: string;
}

export interface MatchBenchItem {
  id: string;
  claim_id: string;
  claim_text: string;
  verdict: EvidenceVerdict;
  judgement: string;
  evidence_state: EvidenceState;
  provenance: Provenance;
  source_excerpt?: string | null;
  confidence_reason?: string;
}

export interface ClaimLedgerItem {
  id: string;
  claim_id: string;
  claim_text: string;
  domain: string;
  role: string;
  conditions?: string | null;
  evidence_state: EvidenceState;
  provenance: Provenance;
  source_excerpt?: string | null;
  confidence_reason?: string;
  match_note?: string;
  evidence_map_verdict?: EvidenceVerdict;
  evidence_map_judgement?: string;
}

export interface ActionPlanItem {
  action: string;
  linked_gap: string;
  owner: string;
  sequence: number;
}

export interface ObjectionResponseItem {
  challenge: string;
  response: string;
  evidence_state: EvidenceState;
  provenance: Provenance;
  linked_gap_ids?: string[];
  linked_claim_ids?: string[];
  linked_evidence_ids?: string[];
}

export interface ProvenanceTraceContent {
  path: string[];
  evidence_map_items: MatchBenchItem[];
}

export interface MatchListItem {
  match_id: string;
  passport: string;
  target: string;
  score: number;
  funder?: string;
  status?: string;
}

export interface ContextCardContent {
  source: {
    id: string;
    title: string;
    summary: string;
  };
  target: {
    id: string;
    title: string;
    funder?: string;
    lead_org?: string;
    funding_amount?: number;
    status?: string;
    abstract?: string;
  };
}

// ---------------------------------------------------------------------------
// EconomicCaseBlock — Five Case Model (M1.0)
// Produced by the economic_analysis route when a user asks a value question.
// The agent emits a ModelPatchProposal containing this block.
// ---------------------------------------------------------------------------

export type ValueVerdict = "positive" | "neutral" | "negative" | "insufficient_data";

export interface ValueDriver {
  name: string;
  description: string;
  direction: "benefit" | "cost" | "uncertain";
  /** Qualitative magnitude — used when no quantified value exists */
  magnitude: "high" | "medium" | "low";
  /** Quantified value in £ if available */
  quantified_value?: number;
  evidence_state: EvidenceState;
  assumption?: string;
}

export interface NpvWaterfallItem {
  label: string;
  value: number;  // positive = benefit, negative = cost
  type: "benefit" | "cost" | "npv";
  evidence_state: EvidenceState;
}

export interface Assumption {
  name: string;
  value: string;
  sensitivity: "high" | "medium" | "low";  // how much would changing this flip the case?
  evidence_state: EvidenceState;
  note?: string;
}

export interface FiveCaseSectionScore {
  case: "strategic" | "economic" | "commercial" | "financial" | "management";
  label: string;
  score: number;       // 0-1
  summary: string;
  evidence_state: EvidenceState;
}

export interface EconomicCaseContent {
  /** Top-level verdict on the economic case */
  verdict: ValueVerdict;
  verdict_summary: string;
  confidence_tier: ConfidenceTier;
  confidence_cap_reason?: string;

  /** Net Present Value at 3.5% STPR — null when data insufficient */
  npv_value?: number | null;
  /** Benefit-Cost Ratio — null when data insufficient */
  bcr?: number | null;
  discount_rate: number;   // 0.035 = 3.5%
  appraisal_period_years?: number;

  /** Five Case section scores (0-1 per case) */
  section_scores: FiveCaseSectionScore[];

  /** Value drivers — always present, quantified when data allows */
  value_drivers: ValueDriver[];

  /** NPV waterfall items — only when quantified data exists */
  npv_waterfall?: NpvWaterfallItem[];

  /** Assumptions underpinning the case */
  assumptions: Assumption[];

  /** What single change would most change the verdict */
  sensitivity_note: string;

  /** Corpus citations used in the analysis */
  corpus_citations: Array<{
    id: string;
    title: string;
    organisation: string;
    score: number;
  }>;

  /** Skills applied */
  skills_applied: string[];
}

export interface EvidenceStateSummaryCounts {
  verified: number;
  "self-reported": number;
  inferred: number;
  unknown: number;
  contested: number;
}

export interface EvidenceStateSummaryContent {
  counts: EvidenceStateSummaryCounts;
  total_claims: number;
  cap_reason: string;
}

export interface RecommendationConfidenceContent {
  decision: string;
  summary: string;
  score: number;
  confidence_tier: ConfidenceTier;
  confidence_cap_reason: string;
}

// ---------------------------------------------------------------------------
// Discriminated block union
// ---------------------------------------------------------------------------

interface BaseBlock {
  id: string;
  state: "core" | "collapsed" | "hidden";
  headline: string;
}

export interface RecommendationConfidenceBlock extends BaseBlock {
  type: "RecommendationConfidence";
  visual: "decision_card";
  content: RecommendationConfidenceContent;
}

export interface EvidenceStateSummaryBlock extends BaseBlock {
  type: "EvidenceStateSummary";
  visual: "evidence_state_bar";
  content: EvidenceStateSummaryContent;
}

export interface DimensionGapBlock extends BaseBlock {
  type: "DimensionGap";
  visual: "source_target_gap_rows";
  content: GapItem[];
}

export interface MatchBenchBlock extends BaseBlock {
  type: "MatchBench";
  visual: "evidence_map_table";
  content: MatchBenchItem[];
}

export interface ClaimLedgerBlock extends BaseBlock {
  type: "ClaimLedger";
  visual: "claim_audit_ledger";
  content: ClaimLedgerItem[];
}

export interface ActionPlanBlock extends BaseBlock {
  type: "ActionPlan";
  visual: "gap_to_action_timeline";
  content: ActionPlanItem[];
}

export interface ObjectionResponseBlock extends BaseBlock {
  type: "ObjectionResponse";
  visual: "objection_response_table";
  content: ObjectionResponseItem[];
}

export interface ProvenanceTraceBlock extends BaseBlock {
  type: "ProvenanceTrace";
  visual: "evidence_trail";
  content: ProvenanceTraceContent;
}

export interface ComparisonMatrixBlock extends BaseBlock {
  type: "ComparisonMatrix";
  visual: "stored_match_list";
  content: MatchListItem[];
}

export interface ContextCardBlock extends BaseBlock {
  type: "ContextCard";
  visual: "paired_context_cards";
  content: ContextCardContent;
}

export interface EconomicCaseBlock extends BaseBlock {
  type: "EconomicCase";
  /** npv_waterfall when quantified, value_driver_cards when qualitative only */
  visual: "npv_waterfall" | "value_driver_cards";
  content: EconomicCaseContent;
}

export type RenderBlock =
  | RecommendationConfidenceBlock
  | EvidenceStateSummaryBlock
  | DimensionGapBlock
  | MatchBenchBlock
  | ClaimLedgerBlock
  | ActionPlanBlock
  | ObjectionResponseBlock
  | ProvenanceTraceBlock
  | ComparisonMatrixBlock
  | ContextCardBlock
  | EconomicCaseBlock;
  // ---------------------------------------------------------------------------
  // Five Case Model mapping (M1.0 — EconomicCaseBlock implemented)
  //
  //  Strategic Case  → RecommendationConfidence (EXISTS)
  //  Economic Case   → EconomicCaseBlock        (LIVE — M1.0)
  //  Commercial Case → CommercialCaseBlock       (STAGED M1.1 — needs new passport data)
  //  Financial Case  → FinancialCaseBlock        (STAGED M1.1 — needs new passport data)
  //  Management Case → ActionPlanBlock           (partial fit — extend in M1.1)
  // ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Inspector index
// ---------------------------------------------------------------------------

export interface InspectorEntry {
  title: string;
  kind: "claim" | "gap" | "evidence_map" | "confidence";
  content: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export interface SnapshotMeta {
  title: string;
  included_blocks: string[];
  must_include: string[];
}

// ---------------------------------------------------------------------------
// Top-level render model
// ---------------------------------------------------------------------------

export interface AtlasRenderModel {
  artifact_id: string;
  model_version: string;
  generated_at: string;
  canonical_question_id: CanonicalQuestionId;
  layout_template: string;
  mode: string;
  source_object: SourceObject;
  target_object: TargetObject;
  decision_spine: DecisionSpine;
  blocks: RenderBlock[];
  inspector_index: Record<string, InspectorEntry>;
  snapshot: SnapshotMeta;
  data_quality_notes: string[];
}

export type RenderModelMap = Record<CanonicalQuestionId, AtlasRenderModel>;

// ---------------------------------------------------------------------------
// Stream event types (stream-ready contract — not yet wired to a backend)
//
// These types describe the structured events that the backend will eventually
// emit when buildAtlasRenderModel() runs. The UI uses these shapes now so
// that wiring the backend later requires only data hookup, not type changes.
// ---------------------------------------------------------------------------

/** A single reasoning step emitted during model build. */
export interface ReasoningStep {
  /** Short label for the step (e.g. "Loading match data") */
  label: string;
  /** Optional detail shown below the label */
  detail?: string;
  /** Supabase / DB row IDs referenced by this step */
  evidence_ids?: string[];
  /** Lifecycle status of this step */
  status: "pending" | "active" | "complete" | "error";
}

export type WorkbenchStreamEvent =
  | {
      type: "status";
      /** Human-readable status update (e.g. "Loading match data…") */
      message: string;
    }
  | {
      type: "reasoning_trace";
      /** A single reasoning step appended to the visible trace */
      step: ReasoningStep;
    }
  | {
      type: "model_patch";
      /** Partial AtlasRenderModel to merge into current state */
      patch: Partial<AtlasRenderModel>;
    }
  | {
      type: "inspector_hint";
      /** Inspector key to pre-open or highlight */
      key: string;
    }
  | {
      type: "chat_token";
      /** Streaming chat token (chat lane only) */
      token: string;
    }
  | {
      type: "final_model";
      /** Fully-built, committed AtlasRenderModel */
      model: AtlasRenderModel;
    }
  | {
      type: "error";
      message: string;
    };
