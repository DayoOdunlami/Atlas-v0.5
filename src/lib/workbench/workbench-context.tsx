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
} from "./atlas-render-model";
import renderModels from "@/data/atlas-v10-render-models.json";

const MODELS = renderModels as RenderModelMap;

const CQ_IDS: CanonicalQuestionId[] = [
  "cq.match.browse",
  "cq.match.workbench",
  "cq.match.act",
  "cq.match.defend",
];

export const CQ_LABELS: Record<CanonicalQuestionId, string> = {
  "cq.match.browse": "Browse",
  "cq.match.workbench": "Workbench",
  "cq.match.act": "Act",
  "cq.match.defend": "Defend",
};

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

const INITIAL_MESSAGES: WorkbenchChatMessage[] = [
  {
    id: "demo-1",
    role: "assistant",
    content:
      "The artifact on the right is the source of truth. I can help you navigate and explain it.",
    timestamp: new Date().toISOString(),
  },
  {
    id: "demo-2",
    role: "assistant",
    content:
      "The RAPPID match is strong thematically, but confidence is capped at **Indicative** because all 10 passport claims are self-reported.",
    timestamp: new Date().toISOString(),
  },
  {
    id: "demo-3",
    role: "assistant",
    content:
      "Three large gaps are holding back a higher score: platform method, GPS-denied evidence, and no independent safety case evidence.",
    timestamp: new Date().toISOString(),
  },
];

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
}

export function WorkbenchProvider({
  children,
  initialMatchId = null,
  initialCqId,
}: WorkbenchProviderProps) {
  const resolvedInitialCq: CanonicalQuestionId =
    initialCqId && CQ_IDS.includes(initialCqId) ? initialCqId : "cq.match.workbench";

  const [cqId, setCqIdState] = React.useState<CanonicalQuestionId>(resolvedInitialCq);
  const [inspectorKey, setInspectorKey] = React.useState<string | null>(null);
  const [snapshotOpen, setSnapshotOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<WorkbenchChatMessage[]>(INITIAL_MESSAGES);

  // DB-backed model state. When initialMatchId is set, the model is fetched
  // from /api/workbench/render-model; otherwise the static fixture is used.
  const isDbBacked = Boolean(initialMatchId);
  const [dbModel, setDbModel] = React.useState<AtlasRenderModel | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(isDbBacked);
  const [error, setError] = React.useState<string | null>(null);

  // Active model: DB model when available, static fixture otherwise.
  // The fixture also serves as a placeholder while the DB model loads —
  // consumers should gate display on `isLoading` rather than reading content.
  const model: AtlasRenderModel = isDbBacked
    ? (dbModel ?? MODELS[cqId])
    : MODELS[cqId];

  const [session, setSessionState] = React.useState<WorkbenchSession>({
    matchId: initialMatchId ?? null,
    sessionId: null,
    passportId: MODELS[resolvedInitialCq].source_object.id,
    targetId: MODELS[resolvedInitialCq].target_object.id,
    artifactVersion: MODELS[resolvedInitialCq].model_version,
    artifactId: MODELS[resolvedInitialCq].artifact_id,
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
