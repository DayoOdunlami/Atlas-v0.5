/**
 * Atlas Workbench Agent — TypeScript contract
 *
 * This file defines the locked input/output shapes that the workbench LangGraph
 * agent (agents/workbench/graph.py) must produce. It is the authoritative source
 * of truth — the Python Pydantic models are generated from these types.
 *
 * Transport: assistant-ui → LangGraph CLI (port 2024)
 * Thread persistence: LangGraph MemorySaver (thread_id per workbench session)
 * Artifact sync: onValues callback in MyRuntimeProvider reads agent_state.artifact
 *
 * Five Case Model staging
 * -----------------------
 * M0.6 (now):    explain | search | propose routes ONLY
 * M1.0 (later):  add economic_analysis route → EconomicCaseBlock model_patch
 * See atlas-render-model.ts STAGED section for full Five Case mapping.
 */

import type { AtlasRenderModel, BlockRole, RenderBlock } from "./atlas-render-model";

// ---------------------------------------------------------------------------
// Route discriminator
// ---------------------------------------------------------------------------

/**
 * The agent classifies every user message into one of these routes.
 * The route drives which tools are called and what output is produced.
 *
 * explain         — Read model context, answer with citations. Cheap, fast.
 *                   No corpus search, no model_patch.
 *
 * search          — Corpus search + answer. User explicitly wants evidence
 *                   FOR this specific match (comparators, corroboration).
 *
 * explore         — Browse the corpus BEYOND this match. Handles broader
 *                   questions: "what else is in the corpus on X?",
 *                   "tell me about this technology", "what other projects...".
 *                   M1.4 universal interface.
 *
 * propose         — Agent proposes a model_patch to update the artifact.
 *                   Requires user confirmation before the patch is applied.
 *
 * economic_analysis — Run Five Case Model with match context.
 *                   Produces EconomicCaseBlock model_patch with NPV/BCR.
 *
 * conversational  — Greetings / meta / off-topic. No tools, instant reply.
 */
export type WorkbenchRoute =
  | "explain"
  | "search"
  | "explore"           // M1.4 — corpus-wide exploration
  | "translate"         // M1.5 — transfer lanes from match evidence
  | "propose"
  | "economic_analysis"
  | "conversational";

// ---------------------------------------------------------------------------
// Context packet — assembled by WorkbenchContext, sent with every user message
// ---------------------------------------------------------------------------

/**
 * Slim summary of the current AtlasRenderModel, injected into the agent's
 * system prompt so it can answer "explain" questions without a DB round-trip.
 *
 * Keep this small — it goes in the message payload on every turn.
 * Full model is stored in the agent state (see WorkbenchAgentState below).
 */
export interface WorkbenchModelSummary {
  artifact_id: string;
  match_id: string;
  canonical_question_id: string;
  source_label: string;         // e.g. "TfL Digital Wayfinding"
  target_label: string;         // e.g. "Smart Ticketing — Southeast"
  recommendation: string;       // decision_spine.recommendation
  confidence_tier: string;      // e.g. "Indicative"
  confidence_cap_reason: string | null;
  top_gaps: string[];           // top 3 gap descriptions
  evidence_counts: {
    verified: number;
    partial: number;
    missing: number;
    total: number;
  };
}

// ---------------------------------------------------------------------------
// Input to the workbench agent (sent per turn via assistant-ui)
// ---------------------------------------------------------------------------

export interface WorkbenchAgentInput {
  /** User's natural language message */
  query: string;
  /** Slim model summary injected into system prompt */
  model_summary: WorkbenchModelSummary;
  /** Full render model — stored in thread state, not sent every turn */
  full_model?: AtlasRenderModel;
  /** Active lens e.g. "CPC" | "Atlas" | "Ecosystem" | "Funder" | "Mode" */
  lens: string;
  /** Optional corpus search override */
  search_override?: string;
}

// ---------------------------------------------------------------------------
// Model patch — proposed by the agent, confirmed by the user
// ---------------------------------------------------------------------------

/**
 * A patch proposal that the agent emits when route = "propose".
 * The frontend shows a diff confirmation before applying it to the artifact.
 *
 * Patch types:
 *   add_block       — insert a new block at the given index
 *   update_block    — replace fields on a block (matched by block_id)
 *   remove_block    — remove a block
 *   update_spine    — update specific fields in decision_spine
 *   set_block_role  — (M3) move a block into a different stage zone
 *   archive_block   — (M3) hide a block off-stage (recoverable via undo / history)
 */
export type ModelPatchOp =
  | {
      op: "add_block";
      block: RenderBlock;
      /** position in blocks array — undefined = append */
      at_index?: number;
    }
  | {
      op: "update_block";
      block_id: string;
      patch: Partial<RenderBlock>;
    }
  | {
      op: "remove_block";
      block_id: string;
    }
  | {
      op: "update_spine";
      patch: Record<string, unknown>;
    }
  | {
      op: "set_block_role";
      block_id: string;
      role: BlockRole;
    }
  | {
      op: "archive_block";
      block_id: string;
    };

/**
 * Stage intent (M3) — classifies how this patch reshapes the canvas.
 *
 *   extend    — add to the current stage without disturbing focus
 *   pivot     — new focus, demote current focus to context (preserves thread)
 *   recompose — same blocks, different visual / arrangement
 *   branch    — archive entire current stage, start fresh (with breadcrumb back)
 */
export type StageIntent = "extend" | "pivot" | "recompose" | "branch";

export interface ModelPatchProposal {
  /** human-readable summary of what this patch does */
  rationale: string;
  ops: ModelPatchOp[];
  /** confidence tier of the proposed change */
  confidence_tier: "Speculative" | "Indicative" | "Supported" | "Robust";
  /** citations backing the proposal */
  corpus_citations: Array<{
    id: string;
    title: string;
    organisation: string;
    score: number;
  }>;
  /**
   * (M3) How this patch reshapes the stage. Defaults to `extend` when absent.
   * Drives 200ms morph animation + branch confirm chip.
   */
  stage_intent?: StageIntent;
  /**
   * (M3) One-sentence narration of the stage move, shown alongside the chat
   * reply: "Brought the action plan forward, parked the recommendation as context."
   */
  stage_narration?: string;
}

// ---------------------------------------------------------------------------
// Output from the workbench agent (read via onValues / agent state)
// ---------------------------------------------------------------------------

export interface WorkbenchAgentOutput {
  /** The route the agent classified this turn into */
  route: WorkbenchRoute;

  /**
   * Chat response text.
   * Always present. Streamed as chat_token events, assembled here at end.
   */
  chat_response: string;

  /**
   * Present when route = "search" | "explore". Ranked corpus citations.
   */
  corpus_citations?: Array<{
    id: string;
    title: string;
    organisation: string;
    relevance_note: string;
    score: number;
  }>;

  /**
   * Present when route = "propose". Frontend shows diff confirmation.
   * User must confirm before WorkbenchContext applies the patch.
   *
   * STAGED: economic_analysis route (M1.0) will also produce a model_patch
   * containing EconomicCaseBlock with npv_value, section_scores, BCR.
   */
  model_patch?: ModelPatchProposal;

  /**
   * Confidence tier for this response (required on every agent output).
   * Rule: never higher than the model's existing confidence_tier.
   */
  confidence_tier: "Speculative" | "Indicative" | "Supported" | "Robust";

  /**
   * Reasoning trace steps (for ReasoningTrace component in ArtifactCanvas).
   */
  reasoning_trace: Array<{
    label: string;
    status: "pending" | "active" | "complete" | "error";
    detail?: string;
  }>;

  /** Error message if the agent failed */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Full agent state (stored in LangGraph thread, read via onValues)
// ---------------------------------------------------------------------------

/**
 * The shape the assistant-ui onValues callback receives.
 * Key field: agent_state.artifact — this is the mutable AtlasRenderModel
 * that WorkbenchContext reads to update the artifact canvas.
 *
 * Usage in MyRuntimeProvider:
 *   onValues: (state) => {
 *     setArtifact(state.artifact ?? currentModel);
 *     setReasoningTrace(state.reasoning_trace ?? []);
 *   }
 */
export interface WorkbenchAgentState {
  /** The working AtlasRenderModel — updated by confirmed model_patches */
  artifact: AtlasRenderModel | null;
  /** Latest output from the agent */
  last_output: WorkbenchAgentOutput | null;
  /** Full conversation history */
  messages: unknown[];
  /** Slim model summary (mirrors WorkbenchAgentInput.model_summary) */
  model_summary: WorkbenchModelSummary | null;
}
