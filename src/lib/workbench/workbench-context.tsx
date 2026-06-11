"use client";

// Workbench state — client-only.
//
// Source of truth: AtlasRenderModel (currently static JSON; async load coming next).
//
// Session model:
//   matchId      — the atlas.matches UUID being viewed (null = static demo)
//   sessionId    — future: thread_id created by the backend on first load
//   artifactVersion — the model_version from the current AtlasRenderModel
//
// When the backend is wired:
//   WorkbenchProvider will receive initialMatchId from URL params,
//   fetch the model via GET /api/workbench/render-model, and populate
//   matchId / sessionId from the response.

import * as React from "react";
import type {
  AtlasRenderModel,
  CanonicalQuestionId,
  RenderModelMap,
  RenderBlock,
  ReasoningStep,
} from "./atlas-render-model";
import type { ModelPatchProposal, ModelPatchOp } from "./workbench-agent-contract";
import { normalizePatchProposal } from "./patch-normalize";
import renderModels from "@/data/atlas-v10-render-models.json";

const MODELS = renderModels as RenderModelMap;

const CQ_IDS: CanonicalQuestionId[] = [
  "cq.home",
  "cq.match.browse",
  "cq.match.workbench",
  "cq.match.act",
  "cq.match.defend",
];

export const CQ_LABELS: Record<CanonicalQuestionId, string> = {
  "cq.home": "Home",
  "cq.match.browse": "Browse",
  "cq.match.workbench": "Workbench",
  "cq.match.act": "Act",
  "cq.match.defend": "Defend",
};

/** CQs that require a loaded match (source/target context) */
export const MATCH_CQ_IDS: CanonicalQuestionId[] = [
  "cq.match.browse",
  "cq.match.workbench",
  "cq.match.act",
  "cq.match.defend",
];

/** True when this CQ requires a loaded match to be meaningful */
export function isMatchCq(id: CanonicalQuestionId): boolean {
  return MATCH_CQ_IDS.includes(id);
}

// ---------------------------------------------------------------------------
// WorkbenchSession — the session/persistence contract.
// ---------------------------------------------------------------------------

export interface WorkbenchSession {
  /** atlas.matches UUID. null = demo/static mode */
  matchId: string | null;
  /** Future: LangGraph / backend thread_id. null until first backend load */
  sessionId: string | null;
  /** atlas.passports UUID for the source object */
  passportId: string | null;
  /** atlas.projects or atlas.live_calls UUID for the target */
  targetId: string | null;
  /** model_version from the current AtlasRenderModel */
  artifactVersion: string;
  /** artifact_id from the current AtlasRenderModel */
  artifactId: string;
  /** The active canonical question */
  canonicalQuestionId: CanonicalQuestionId;
}

// ---------------------------------------------------------------------------
// WorkbenchChatMessage — chat message contract
//
// Defined here so CopilotKit / AG-UI message adapters write to this shape.
// When backend is wired, replace INITIAL_MESSAGES with live data.
// ---------------------------------------------------------------------------

export interface WorkbenchChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Collapsible reasoning trace for this message */
  reasoning?: { content: string; duration?: number };
  /** Corpus citations attached to this message */
  citations?: Array<{ id: string; title: string; score: number }>;
  timestamp: string;
}

const INITIAL_MESSAGES: WorkbenchChatMessage[] = [];

// ---------------------------------------------------------------------------
// SessionListItem — entry shape for the sidebar sessions list
//
// Defined now so the sidebar socket is data-ready when Supabase is wired.
// ---------------------------------------------------------------------------

export interface SessionListItem {
  id: string;
  /** LangGraph thread_id — null until backend creates a thread */
  threadId: string | null;
  /** Auto-generated or user-set title */
  title: string;
  /** Source passport title */
  passportTitle: string;
  /** Target project title */
  targetTitle: string;
  cqId: CanonicalQuestionId;
  updatedAt: string;
  messageCount: number;
}

/** Demo sessions — replaced by real Supabase query at step 5 of build sequence */
const DEMO_SESSIONS: SessionListItem[] = [
  {
    id: "demo-session-1",
    threadId: null,
    title: "Crossrail Readiness — RAPPID match",
    passportTitle: "Crossrail Readiness Passport",
    targetTitle: "RAPPID Positioning System",
    cqId: "cq.match.workbench",
    updatedAt: new Date().toISOString(),
    messageCount: 3,
  },
];

// ---------------------------------------------------------------------------
// WorkbenchState — full context shape
// ---------------------------------------------------------------------------

/**
 * (M3) A snapshot of a past stage composition. Pushed onto stageHistory
 * whenever a `branch` patch is applied. Lets the user scrub back through
 * compositions, not just single-op undo.
 */
export interface StageSnapshot {
  /** The model at the moment of branching */
  model: AtlasRenderModel;
  /** Patches applied at the time of the branch */
  appliedPatches: ModelPatchProposal[];
  /** Short label describing what was lost (e.g. "GPS-Denied analysis") */
  label: string;
  /** When the snapshot was taken */
  snappedAt: string;
}

/**
 * (M3) A `branch` patch held pending a 3-second auto-confirm chip.
 * The user can cancel (drops the branch) or wait (auto-applies).
 */
export interface PendingBranchState {
  patch: ModelPatchProposal;
  /** Short topic label inferred from the rationale or stage_narration */
  topicLabel: string;
  /** Wall-clock ms when the chip appeared (drives the countdown) */
  startedAt: number;
  /** Auto-confirm delay in ms */
  timeoutMs: number;
}

interface WorkbenchState {
  // Session
  session: WorkbenchSession;
  setSession: (patch: Partial<WorkbenchSession>) => void;
  /** Reset session and clear messages — "New Chat" action */
  resetSession: () => void;

  // CQ selection
  cqId: CanonicalQuestionId;
  setCqId: (id: CanonicalQuestionId) => void;
  cqIds: CanonicalQuestionId[];

  // Active model
  model: AtlasRenderModel;
  /** True while a DB-backed model is being fetched */
  isLoading: boolean;
  /** Error message from the last failed fetch, or null */
  error: string | null;
  /** True when rendering a real DB-backed model (match_id supplied) */
  isDbBacked: boolean;

  // Chat messages
  messages: WorkbenchChatMessage[];
  addMessage: (msg: WorkbenchChatMessage) => void;

  // Sessions list (sidebar)
  recentSessions: SessionListItem[];

  // Inspector
  inspectorKey: string | null;
  openInspector: (key: string) => void;
  closeInspector: () => void;

  // Snapshot
  snapshotOpen: boolean;
  setSnapshotOpen: (v: boolean) => void;

  // Reasoning trace (M1.1)
  /** Live reasoning steps from the last agent turn — empty between turns */
  reasoningSteps: ReasoningStep[];
  setReasoningSteps: (steps: ReasoningStep[]) => void;

  // Route mode indicator + corpus citations (M1.4)
  /** The route the agent used on the last completed turn */
  lastRoute: string | null;
  setLastRoute: (route: string | null) => void;
  /** Citations returned by the last search/explore turn */
  lastCitations: Array<{ id: string; title?: string; organisation?: string; score?: number; relevanceNote?: string }>;
  setLastCitations: (c: Array<{ id: string; title?: string; organisation?: string; score?: number; relevanceNote?: string }>) => void;

  // Patch confirmation (M0.9 — kept for hard-confirm overwrite case)
  /** Pending model_patch proposal from the agent — null when none in flight */
  pendingPatch: ModelPatchProposal | null;
  /** Set by WorkbenchAgentBridge when the agent emits a propose route output */
  setPendingPatch: (patch: ModelPatchProposal | null) => void;
  /** Apply the pending patch to the active model and clear pendingPatch */
  applyPatch: (patch: ModelPatchProposal) => void;
  /** Dismiss the pending patch without applying */
  dismissPatch: () => void;

  // Act-don't-ask (M2.0) — undo stack + tiered confirmation routing
  /**
   * Receive a patch from the agent. Classifies destructiveness:
   *  - `auto` (default for additive: add_block, update_spine, unpinned edits) → applies immediately
   *  - `hard` (overwriting a pinned block) → surfaces PatchConfirmationPanel
   * Returns the chosen tier so the caller can fire an undo toast on auto.
   */
  proposePatch: (patch: ModelPatchProposal) => ConfirmTier;
  /** History of applied patches (oldest first) — source of truth for undo */
  appliedPatches: ModelPatchProposal[];
  /** True when there is a patch available to undo */
  canUndo: boolean;
  /** True when there is a patch available to redo */
  canRedo: boolean;
  /** Pop the most recent applied patch and replay the rest */
  undo: () => boolean;
  /** Re-apply the most recently undone patch */
  redo: () => boolean;
  /** Pin a block so it can't be overwritten without a hard confirm */
  togglePin: (blockId: string) => void;

  // ----------------------------------------------------------------
  // M3 — Stage model: branch confirmation + stage history
  // ----------------------------------------------------------------
  /** A `branch` patch awaiting the 3-sec auto-confirm chip decision. */
  pendingBranch: PendingBranchState | null;
  /** User clicked "Keep this view" — drops the branch entirely. */
  cancelPendingBranch: () => void;
  /** Snapshots of previous stage compositions (one per branch). */
  stageHistory: StageSnapshot[];
  /** Pop the most recent stage snapshot and restore its composition. */
  restorePreviousStage: () => boolean;

  /**
   * True when this provider was mounted with a demo fixture.
   * UI surfaces use this to: (a) show a demo banner, (b) disable composer
   * submit, (c) skip the agent bridge.
   */
  demoMode: boolean;
}

// ---------------------------------------------------------------------------
// Pure helpers (M2.0)
// ---------------------------------------------------------------------------

/**
 * Apply a single patch to a model, returning the new model.
 * Pure — does not mutate inputs. Supports all M3 patch ops:
 *   add_block / update_block / remove_block / update_spine
 *   set_block_role / archive_block
 * `pinned` and `role` flags are preserved across updates unless the
 * patch explicitly sets them.
 */
export function applyPatchToModel(
  base: AtlasRenderModel,
  patch: ModelPatchProposal,
): AtlasRenderModel {
  let blocks = [...base.blocks];
  let spine = { ...base.decision_spine };

  for (const op of patch.ops as ModelPatchOp[]) {
    if (op.op === "add_block") {
      const idx = typeof op.at_index === "number" ? op.at_index : blocks.length;
      // New blocks default to focus role unless the agent specified one
      const newBlock = {
        role: "focus",
        ...(op.block as RenderBlock),
      } as RenderBlock;
      blocks = [...blocks.slice(0, idx), newBlock, ...blocks.slice(idx)];
    } else if (op.op === "update_block") {
      blocks = blocks.map((b) =>
        b.id === op.block_id
          ? ({ ...b, ...(op.patch as Record<string, unknown>) } as RenderBlock)
          : b,
      );
    } else if (op.op === "remove_block") {
      blocks = blocks.filter((b) => b.id !== op.block_id);
    } else if (op.op === "update_spine") {
      spine = { ...spine, ...(op.patch as typeof spine) };
    } else if (op.op === "set_block_role") {
      blocks = blocks.map((b) =>
        b.id === op.block_id ? ({ ...b, role: op.role } as RenderBlock) : b,
      );
    } else if (op.op === "archive_block") {
      blocks = blocks.map((b) =>
        b.id === op.block_id ? ({ ...b, role: "archived" } as RenderBlock) : b,
      );
    }
  }

  return { ...base, blocks, decision_spine: spine };
}

/** Replay an ordered list of patches against a base model. */
function replayPatches(
  base: AtlasRenderModel,
  patches: ModelPatchProposal[],
): AtlasRenderModel {
  return patches.reduce(applyPatchToModel, base);
}

export type ConfirmTier = "auto" | "soft" | "hard" | "branch";

/**
 * Decide the confirmation tier for an incoming patch.
 *
 * Rules (additive-vs-destructive, NOT stakes):
 *  - `add_block`                              → additive (auto)
 *  - `update_block` on a pinned block         → destructive (hard)
 *  - `remove_block` on a pinned block         → destructive (hard)
 *  - `update_block` on an unpinned block      → additive (auto + undo toast)
 *  - `remove_block` on an unpinned block      → additive (auto + undo toast)
 *  - `update_spine`                           → additive (auto)
 *
 * "Pinned" = analyst has explicitly locked this block from agent overwrite.
 * If ANY op in the patch is destructive, the entire patch is hard-confirmed.
 */
function classifyPatchTier(
  patch: ModelPatchProposal,
  currentModel: AtlasRenderModel,
): ConfirmTier {
  for (const op of patch.ops as ModelPatchOp[]) {
    if (op.op === "update_block" || op.op === "remove_block") {
      const target = currentModel.blocks.find((b) => b.id === op.block_id) as
        | (RenderBlock & { pinned?: boolean })
        | undefined;
      if (target?.pinned) return "hard";
    }
  }
  return "auto";
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const WorkbenchContext = React.createContext<WorkbenchState | null>(null);

export interface WorkbenchProviderProps {
  children: React.ReactNode;
  /**
   * Initial match_id from URL params.
   * null = load from static JSON fixture (demo mode).
   * When the backend is wired, a non-null matchId triggers an async model fetch.
   */
  initialMatchId?: string | null;
  /**
   * Initial canonical question from URL params.
   * Falls back to "cq.match.workbench" if not provided or invalid.
   */
  initialCqId?: CanonicalQuestionId | null;
  /**
   * Demo mode — when set, the provider uses the supplied model as the base
   * for ALL CQs and seeds the chat with `initialMessages`. The LangGraph
   * bridge is bypassed (the demo workbench page does not mount the agent
   * runtime). This unblocks UI evaluation when the corpus is unreachable.
   */
  initialModel?: AtlasRenderModel | null;
  initialMessages?: WorkbenchChatMessage[];
  initialRoute?: string | null;
  initialCitations?: WorkbenchState["lastCitations"];
  demoMode?: boolean;
}

export function WorkbenchProvider({
  children,
  initialMatchId = null,
  initialCqId,
  initialModel = null,
  initialMessages,
  initialRoute = null,
  initialCitations,
  demoMode = false,
}: WorkbenchProviderProps) {
  // Default behaviour:
  //   - If a match_id is in the URL → start in Browse (match-loaded)
  //   - Otherwise → start at Home (no match required; "ask anything" landing)
  // Explicit cq param always wins.
  const resolvedInitialCq: CanonicalQuestionId =
    initialCqId && CQ_IDS.includes(initialCqId)
      ? initialCqId
      : initialMatchId
        ? "cq.match.browse"
        : "cq.home";

  const [cqId, setCqIdState] = React.useState<CanonicalQuestionId>(resolvedInitialCq);
  const [inspectorKey, setInspectorKey] = React.useState<string | null>(null);
  const [snapshotOpen, setSnapshotOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<WorkbenchChatMessage[]>(
    initialMessages && initialMessages.length > 0
      ? initialMessages
      : INITIAL_MESSAGES,
  );

  // Reasoning trace state (M1.1)
  const [reasoningSteps, setReasoningSteps] = React.useState<ReasoningStep[]>([]);
  // Route mode indicator + citations (M1.4)
  const [lastRoute, setLastRoute] = React.useState<string | null>(initialRoute);
  const [lastCitations, setLastCitations] = React.useState<Array<{ id: string; title?: string; organisation?: string; score?: number; relevanceNote?: string }>>(
    initialCitations ?? [],
  );

  // Patch confirmation state (M0.9 + M2.0)
  const [pendingPatch, setPendingPatch] = React.useState<ModelPatchProposal | null>(null);
  // Applied patch history — replayed deterministically from baseModel.
  // appliedPatches[0] is the oldest, appliedPatches[last] is the most recent.
  const [appliedPatches, setAppliedPatches] = React.useState<ModelPatchProposal[]>([]);
  // Patches that have been undone — pushed back on redo
  const [redoStack, setRedoStack] = React.useState<ModelPatchProposal[]>([]);
  // M3 — Stage history snapshots (one per branch)
  const [stageHistory, setStageHistory] = React.useState<StageSnapshot[]>([]);
  // M3 — Branch chip pending decision
  const [pendingBranch, setPendingBranch] = React.useState<PendingBranchState | null>(null);
  const branchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // DB-backed model state. When initialMatchId is set, the model is fetched
  // from /api/workbench/render-model; otherwise the static fixture is used.
  const isDbBacked = Boolean(initialMatchId);
  const [dbModel, setDbModel] = React.useState<AtlasRenderModel | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(isDbBacked);
  const [error, setError] = React.useState<string | null>(null);

  // Base model resolution priority (highest first):
  //   1. demo fixture (initialModel)  — overrides everything; seeds all CQs
  //   2. DB-backed model              — when match_id supplied
  //   3. static JSON fixture          — keyed by current CQ
  const baseModel: AtlasRenderModel = initialModel
    ? initialModel
    : isDbBacked
      ? (dbModel ?? MODELS[cqId])
      : MODELS[cqId];

  // Derive the current model by replaying all applied patches from baseModel.
  // This keeps undo deterministic — pop a patch and the model recomputes.
  const model: AtlasRenderModel = React.useMemo(
    () => replayPatches(baseModel, appliedPatches),
    [baseModel, appliedPatches],
  );

  // Clear patch history + stage history when cq or match changes so stale state doesn't persist
  React.useEffect(() => {
    setAppliedPatches([]);
    setRedoStack([]);
    setStageHistory([]);
    setPendingBranch(null);
  }, [cqId, initialMatchId]);

  // Seed the session from the demo fixture if supplied, otherwise from the
  // static MODELS map. This keeps the artifact summary card / snapshot
  // metadata coherent with the actual model on first paint.
  const seedModel = initialModel ?? MODELS[resolvedInitialCq];
  const [session, setSessionState] = React.useState<WorkbenchSession>({
    matchId: initialMatchId ?? null,
    sessionId: null,
    passportId: seedModel.source_object.id,
    targetId: seedModel.target_object.id,
    artifactVersion: seedModel.model_version,
    artifactId: seedModel.artifact_id,
    canonicalQuestionId: resolvedInitialCq,
  });

  const setSession = React.useCallback((patch: Partial<WorkbenchSession>) => {
    setSessionState((prev) => ({ ...prev, ...patch }));
  }, []);

  // Fetch the DB-backed model when match_id or cq changes.
  // Stale requests are aborted via the effect cleanup (AbortController).
  React.useEffect(() => {
    if (!initialMatchId) {
      setDbModel(null);
      setIsLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetch(
      `/api/workbench/render-model?match_id=${encodeURIComponent(initialMatchId)}&cq=${encodeURIComponent(cqId)}`,
      { signal: controller.signal },
    )
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        return (await res.json()) as AtlasRenderModel;
      })
      .then((m) => {
        setDbModel(m);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [initialMatchId, cqId]);

  // Keep session metadata in sync with the active model (DB or static).
  React.useEffect(() => {
    setSessionState((prev) => ({
      ...prev,
      matchId: initialMatchId ?? prev.matchId,
      canonicalQuestionId: cqId,
      artifactId: model.artifact_id,
      artifactVersion: model.model_version,
      passportId: model.source_object.id,
      targetId: model.target_object.id,
    }));
  }, [model, cqId, initialMatchId]);

  // "New Chat" — clears messages and resets thread, keeps match context
  const resetSession = React.useCallback(() => {
    setSessionState((prev) => ({ ...prev, sessionId: null }));
    setMessages([]);
  }, []);

  const addMessage = React.useCallback((msg: WorkbenchChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  // Session metadata is synced from the active model via effect above,
  // so setCqId only needs to update the CQ. For DB-backed mode this also
  // re-triggers the fetch effect (cq is in its dependency array).
  const setCqId = React.useCallback((id: CanonicalQuestionId) => {
    setCqIdState(id);
  }, []);

  const openInspector = React.useCallback((key: string) => {
    setInspectorKey(key);
  }, []);

  const closeInspector = React.useCallback(() => {
    setInspectorKey(null);
  }, []);

  // ---------------------------------------------------------------------
  // Patch routing (M2.0 — act-don't-ask)
  // ---------------------------------------------------------------------
  //
  // Apply pushes a patch onto the appliedPatches history. The current model
  // is always replayPatches(baseModel, appliedPatches) — so undo is just a
  // history pop. This guarantees consistency across undo/redo/cq changes.

  const applyPatch = React.useCallback((patch: ModelPatchProposal) => {
    const normalized = normalizePatchProposal(patch);
    setAppliedPatches((prev) => [...prev, normalized]);
    setRedoStack([]); // new action invalidates redo stack
    setPendingPatch(null);
  }, []);

  const dismissPatch = React.useCallback(() => {
    setPendingPatch(null);
  }, []);

  // M3 — Stage history & branch handling
  // -------------------------------------------------------------------
  // When the agent emits stage_intent="branch", we hold the patch in
  // pendingBranch and surface a 3-sec auto-confirm chip. If the timer
  // fires, we snapshot the current composition and apply the patch.
  // If the user cancels, we drop the patch entirely.

  const clearBranchTimer = React.useCallback(() => {
    if (branchTimerRef.current) {
      clearTimeout(branchTimerRef.current);
      branchTimerRef.current = null;
    }
  }, []);

  const _applyBranchInternal = React.useCallback(
    (patch: ModelPatchProposal, currentModel: AtlasRenderModel, currentPatches: ModelPatchProposal[]) => {
      // Snapshot the current composition so the user can restore it later
      const focusBlocks = currentModel.blocks.filter(
        (b) => !b.role || b.role === "focus",
      );
      const label =
        focusBlocks[0]?.headline ??
        currentModel.source_object?.title ??
        "Previous stage";
      const snapshot: StageSnapshot = {
        model: currentModel,
        appliedPatches: [...currentPatches],
        label: label.slice(0, 60),
        snappedAt: new Date().toISOString(),
      };
      setStageHistory((prev) => [...prev, snapshot]);
      // Apply the branch patch as a fresh stage
      applyPatch(patch);
    },
    [applyPatch],
  );

  const cancelPendingBranch = React.useCallback(() => {
    clearBranchTimer();
    setPendingBranch(null);
  }, [clearBranchTimer]);

  const restorePreviousStage = React.useCallback((): boolean => {
    let didRestore = false;
    setStageHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setAppliedPatches(last.appliedPatches);
      setRedoStack([]);
      didRestore = true;
      return prev.slice(0, -1);
    });
    return didRestore;
  }, []);

  // proposePatch: receives an incoming patch from the agent and decides
  // the confirmation tier based on destructiveness AND stage intent.
  //  - branch  (M3) → surfaces a 3-sec auto-confirm chip
  //  - hard         → surfaces PatchConfirmationPanel for pinned-block overwrite
  //  - auto / soft  → applies immediately with undo toast
  const proposePatch = React.useCallback((patch: ModelPatchProposal): ConfirmTier => {
    // M3 — branch intent always confirms first
    if (patch.stage_intent === "branch") {
      clearBranchTimer();
      const topicLabel =
        patch.stage_narration ??
        patch.rationale.slice(0, 60) ??
        "new topic";
      setPendingBranch({
        patch,
        topicLabel,
        startedAt: Date.now(),
        timeoutMs: 3000,
      });
      // Capture closure-stable refs for the auto-fire
      const snapshotModel = model;
      const snapshotPatches = appliedPatches;
      branchTimerRef.current = setTimeout(() => {
        _applyBranchInternal(patch, snapshotModel, snapshotPatches);
        setPendingBranch(null);
        branchTimerRef.current = null;
      }, 3000);
      return "branch";
    }

    const tier = classifyPatchTier(patch, model);
    if (tier === "hard") {
      setPendingPatch(patch);
      return tier;
    }
    // auto / soft: apply immediately. The toast (fired by the bridge) surfaces
    // the undo affordance.
    applyPatch(patch);
    return tier;
  }, [model, appliedPatches, applyPatch, clearBranchTimer, _applyBranchInternal]);

  // Cleanup branch timer on unmount
  React.useEffect(() => () => clearBranchTimer(), [clearBranchTimer]);

  const canUndo = appliedPatches.length > 0;
  const canRedo = redoStack.length > 0;

  const undo = React.useCallback((): boolean => {
    let didUndo = false;
    setAppliedPatches((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [...r, last]);
      didUndo = true;
      return prev.slice(0, -1);
    });
    return didUndo;
  }, []);

  const redo = React.useCallback((): boolean => {
    let didRedo = false;
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setAppliedPatches((p) => [...p, last]);
      didRedo = true;
      return prev.slice(0, -1);
    });
    return didRedo;
  }, []);

  // Pinning a block: emit a virtual update_block patch that flips `pinned`.
  // Stored as a history entry so unpinning is also undoable.
  const togglePin = React.useCallback((blockId: string) => {
    const target = model.blocks.find((b) => b.id === blockId);
    if (!target) return;
    const nextPinned = !((target as RenderBlock & { pinned?: boolean }).pinned);
    const pinPatch: ModelPatchProposal = {
      rationale: nextPinned ? `Pinned block ${blockId}` : `Unpinned block ${blockId}`,
      ops: [
        {
          op: "update_block",
          block_id: blockId,
          patch: { pinned: nextPinned } as Partial<RenderBlock>,
        },
      ],
      confidence_tier: "Robust",
      corpus_citations: [],
    };
    applyPatch(pinPatch);
  }, [model.blocks, applyPatch]);

  // Global keyboard listener for Cmd+Z / Ctrl+Z (undo), Cmd+Shift+Z (redo)
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      // Ignore when typing in an input/textarea/contentEditable
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  return (
    <WorkbenchContext.Provider
      value={{
        session,
        setSession,
        resetSession,
        cqId,
        setCqId,
        model,
        isLoading,
        error,
        isDbBacked,
        cqIds: CQ_IDS,
        messages,
        addMessage,
        recentSessions: DEMO_SESSIONS,
        inspectorKey,
        openInspector,
        closeInspector,
        snapshotOpen,
        setSnapshotOpen,
        reasoningSteps,
        setReasoningSteps,
        lastRoute,
        setLastRoute,
        lastCitations,
        setLastCitations,
        pendingPatch,
        setPendingPatch,
        applyPatch,
        dismissPatch,
        proposePatch,
        appliedPatches,
        canUndo,
        canRedo,
        undo,
        redo,
        togglePin,
        // M3 — stage model
        pendingBranch,
        cancelPendingBranch,
        stageHistory,
        restorePreviousStage,
        demoMode,
      }}
    >
      {children}
    </WorkbenchContext.Provider>
  );
}

export function useWorkbench() {
  const ctx = React.useContext(WorkbenchContext);
  if (!ctx) throw new Error("useWorkbench must be used within WorkbenchProvider");
  return ctx;
}
