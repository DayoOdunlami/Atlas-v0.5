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
  | ContextCardBlock;
  // ---------------------------------------------------------------------------
  // STAGED — Five Case Model blocks (M1.0)
  //
  // When a user asks a value/economic question the workbench agent will:
  //  1. Run Five Case analysis with the match + passport as context
  //  2. Emit a model_patch adding EconomicCaseBlock to the artifact
  //  3. npv_waterfall visual already exists in block-vocabulary.ts
  //
  // Data foundation already present:
  //  - atlas.matches.gap_value_estimate (42/85 rows populated)
  //  - DecisionSpine.economic_gap_value (slot reserved)
  //  - npv_waterfall block visual in block-vocabulary.ts (status: ready)
  //
  // Mapping:
  //  Strategic Case  → RecommendationConfidence (EXISTS — no new block needed)
  //  Economic Case   → EconomicCaseBlock        (needs: type + content + visual)
  //  Commercial Case → CommercialCaseBlock       (needs: new data + block + visual)
  //  Financial Case  → FinancialCaseBlock        (needs: new data + block + visual)
  //  Management Case → ActionPlan (partial fit)  (extend ActionPlanBlock first)
  //
  // DO NOT add these block types until the workbench agent's economic_analysis
  // route is built and the model_patch pattern is proven (post M0.9).
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
