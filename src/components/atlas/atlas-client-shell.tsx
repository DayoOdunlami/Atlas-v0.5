"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useCoAgent } from "@copilotkit/react-core";

import { AtlasAnswerSurface } from "@/components/atlas/atlas-answer-surface";
import type { AtlasReasoningStep } from "@/components/atlas/shell/canvas-thinking";
import type { AtlasDevMeta } from "@/components/atlas/shell/dev-overlay";
import type { ChatMessage } from "@/components/atlas/shell/so-what-rail";
import { latestReasoningProgress } from "@/components/atlas/shell/canvas-thinking";
import { useAtlas5Chat } from "@/hooks/use-atlas5-chat";
import {
  formatZodError,
  validateFinalAnswerSpec,
  validatePartialAnswerSpec,
  type AnswerSpec,
  type AnswerSpecEnvelope,
} from "@/lib/atlas/contracts/answer-spec.schema";
import type { AnswerSpecSource } from "@/lib/atlas/fetch-answer-spec";
import { extractLayoutSignals, titleFromQuery } from "@/lib/atlas/layout-signals";
import {
  archiveThread,
  ensureThread,
  fetchThreadDetail,
  fetchThreadList,
  patchThreadTitle,
  persistTurn,
  turnsToChatMessages,
  turnsToSessionHistory,
  type PersistStatus,
  type ThreadSummary,
} from "@/lib/atlas/thread-client";
import {
  clearBootstrapSent,
  consumePendingBootstrap,
  markBootstrapSent,
  readAtlasSessionQuery,
  wasBootstrapSent,
  writeAtlasSessionQuery,
} from "@/lib/atlas/session";
import {
  readAtlasUxPrefs,
  patchAtlasUxPrefs,
  uxPrefsForAgent,
  type AtlasUxPrefs,
} from "@/lib/atlas/ux-preferences";
import {
  clearCachedThreadList,
  readCachedThreadList,
  removeCachedThread,
  upsertCachedThread,
  writeCachedThreadList,
} from "@/lib/atlas/thread-list-cache";
import { buildAtlasBootstrapUrl, buildAtlasThreadUrl } from "@/lib/atlas/thread-navigation";
import { readAtlasV5ThreadId, setAtlasV5ThreadId } from "@/components/copilotkit-provider";

type AtlasV5CoState = {
  answer_spec_envelope?: AnswerSpecEnvelope;
  answer_dev_meta?: AtlasDevMeta;
  canvas_cleared?: boolean;
  query?: string;
  reasoning_trace?: AtlasReasoningStep[];
  turn_active?: boolean;
  ux_prefs?: Record<string, boolean>;
  session_history?: Array<{ role: "user" | "assistant"; content: string }>;
  thread_id?: string | null;
  case_entity_id?: string | null;
};

function mergePartialIntoSpec(
  base: AnswerSpec | null,
  partial: Partial<AnswerSpec>,
): AnswerSpec | null {
  if (!base) {
    const full = validateFinalAnswerSpec(partial);
    return full.success ? full.data : null;
  }
  const merged = {
    ...base,
    ...partial,
    verdict: partial.verdict ? { ...base.verdict, ...partial.verdict } : base.verdict,
    instrument: partial.instrument ?? base.instrument,
    chart: partial.chart ?? base.chart,
    canvas: partial.canvas
      ? { ...(base.canvas ?? {}), ...partial.canvas }
      : base.canvas,
    soWhat: partial.soWhat ? { ...base.soWhat, ...partial.soWhat } : base.soWhat,
  };
  const validated = validateFinalAnswerSpec(merged);
  return validated.success ? validated.data : null;
}

function envelopeToSpec(
  envelope: AnswerSpecEnvelope,
  canvasCleared: boolean,
  prior: AnswerSpec | null,
): { spec: AnswerSpec | null; zodError?: string } {
  if (canvasCleared) return { spec: null };
  if (envelope.status === "error") {
    return { spec: prior, zodError: envelope.error ?? "envelope error" };
  }
  if (!envelope.spec) return { spec: prior };

  if (envelope.status === "partial") {
    const partial = validatePartialAnswerSpec(envelope.spec);
    if (!partial.success) {
      return { spec: prior, zodError: formatZodError(partial.error) };
    }
    const merged = mergePartialIntoSpec(prior, partial.data);
    if (merged) return { spec: merged };
    return { spec: prior, zodError: "partial merge failed full validation" };
  }

  const validated = validateFinalAnswerSpec(envelope.spec);
  if (validated.success) return { spec: validated.data };
  return { spec: prior, zodError: formatZodError(validated.error) };
}

export function AtlasCopilotShell({
  initialSpec,
  initialDataSource,
  bootstrapQuery,
  initialThreadId,
}: {
  initialSpec: AnswerSpec | null;
  initialDataSource: AnswerSpecSource;
  bootstrapQuery?: string;
  initialThreadId?: string;
}) {
  const router = useRouter();
  const [uxPrefs, setUxPrefs] = useState<AtlasUxPrefs>(() => readAtlasUxPrefs());
  const initialEnvelope: AnswerSpecEnvelope = useMemo(
    () =>
      initialSpec
        ? {
            revision: 1,
            status: "final",
            spec: initialSpec,
          }
        : {
            revision: 0,
            status: "final",
          },
    [initialSpec],
  );

  const { state, setState } = useCoAgent<AtlasV5CoState>({
    name: "atlas_v5",
    initialState: {
      answer_spec_envelope: initialEnvelope,
      answer_dev_meta: {},
      canvas_cleared: !initialSpec,
      reasoning_trace: [],
      turn_active: false,
      ux_prefs: uxPrefsForAgent(uxPrefs),
    },
  });

  const seededRef = useRef(false);
  const bootstrapBootRef = useRef(false);
  const setStateRef = useRef(setState);
  useEffect(() => {
    setStateRef.current = setState;
  }, [setState]);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    setStateRef.current?.({
      answer_spec_envelope: initialEnvelope,
      canvas_cleared: !initialSpec,
    });
  }, [initialEnvelope, initialSpec]);

  const [spec, setSpec] = useState<AnswerSpec | null>(initialSpec);
  const [dataSource, setDataSource] = useState(initialDataSource);
  const [devMeta, setDevMeta] = useState<AtlasDevMeta | null>(null);
  const [reasoningTrace, setReasoningTrace] = useState<AtlasReasoningStep[]>([]);
  const [envelopeStatus, setEnvelopeStatus] = useState<AnswerSpecEnvelope["status"]>("final");
  const lastRevisionRef = useRef(0);
  const specRef = useRef<AnswerSpec | null>(initialSpec);
  const turnStartedAtRef = useRef<number | null>(null);
  const [turnTiming, setTurnTiming] = useState<{
    elapsedMs: number | null;
    running: boolean;
  }>({ elapsedMs: null, running: false });

  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    initialThreadId ?? null,
  );
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [threadsSyncing, setThreadsSyncing] = useState(false);
  const threadsHydratedRef = useRef(false);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const [persistStatus, setPersistStatus] = useState<PersistStatus>("idle");
  const [persistConfigured, setPersistConfigured] = useState(true);
  const [restoredMessages, setRestoredMessages] = useState<ChatMessage[]>([]);
  const [rehydrating, setRehydrating] = useState(false);
  const lastPersistedKeyRef = useRef<string>("");
  const [copilotBoundThreadId, setCopilotBoundThreadId] = useState<string | null>(null);
  const [caseEntityId, setCaseEntityId] = useState<string | null>(null);
  const threadInitRef = useRef(false);
  const syncedUrlThreadRef = useRef<string | null>(null);

  const syncAgentThreadContext = useCallback(
    (threadId: string, entityId: string | null) => {
      setStateRef.current?.((prev) => {
        if (prev?.thread_id === threadId && prev?.case_entity_id === entityId) {
          return prev;
        }
        return {
          ...prev,
          thread_id: threadId,
          case_entity_id: entityId,
        };
      });
    },
    [],
  );

  const handleCaseEntityAttached = useCallback(
    (entityId: string | null) => {
      setCaseEntityId(entityId);
      if (activeThreadId) {
        syncAgentThreadContext(activeThreadId, entityId);
      }
    },
    [activeThreadId, syncAgentThreadContext],
  );

  useEffect(() => {
    specRef.current = spec;
  }, [spec]);

  useEffect(() => {
    if (state?.reasoning_trace && state.reasoning_trace.length > 0) {
      setReasoningTrace(state.reasoning_trace);
    }
  }, [state?.reasoning_trace]);

  useEffect(() => {
    if (state?.answer_dev_meta && Object.keys(state.answer_dev_meta).length > 0) {
      setDevMeta((prev) => {
        const incoming = state.answer_dev_meta!;
        const next = {
          ...prev,
          ...incoming,
          partial_stage: incoming.partial_stage ?? prev?.partial_stage,
          route: incoming.route ?? prev?.route,
          route_source: incoming.route_source ?? prev?.route_source,
        };
        if (
          prev &&
          prev.route === next.route &&
          prev.route_source === next.route_source &&
          prev.partial_stage === next.partial_stage &&
          prev.turn_stage === next.turn_stage &&
          JSON.stringify(prev.showcase) === JSON.stringify(next.showcase)
        ) {
          return prev;
        }
        return next;
      });
      if (state.answer_dev_meta?.route || state.answer_dev_meta?.disposition) {
        setDataSource((prev) => (prev === "brain" ? prev : "brain"));
      }
    }
  }, [state?.answer_dev_meta]);

  useEffect(() => {
    const envelope = state?.answer_spec_envelope;
    if (!envelope) return;

    setEnvelopeStatus(envelope.status ?? "final");

    const revision = envelope.revision ?? 0;
    const isPartial = envelope.status === "partial";
    if (revision <= lastRevisionRef.current && !isPartial && !state?.canvas_cleared) {
      return;
    }

    if (state?.canvas_cleared) {
      setSpec(null);
      setDataSource("brain");
      setEnvelopeStatus("final");
      lastRevisionRef.current = revision;
      return;
    }

    const { spec: next, zodError } = envelopeToSpec(
      envelope,
      Boolean(state?.canvas_cleared),
      specRef.current,
    );

    if (next) {
      const fp = `${next.mode}|${next.instrument?.recipe}|${next.verdict.sentence.slice(0, 40)}`;
      const prevFp = specRef.current
        ? `${specRef.current.mode}|${specRef.current.instrument?.recipe}|${specRef.current.verdict.sentence.slice(0, 40)}`
        : "";
      if (fp !== prevFp || revision > lastRevisionRef.current || isPartial) {
        setSpec(next);
        setDataSource("brain");
        setDevMeta((prev) => ({ ...prev, zod_error: undefined }));
      }
    } else if (zodError) {
      setDevMeta((prev) => ({
        ...prev,
        zod_error: zodError,
        gate_errors: [`Zod: ${zodError.slice(0, 120)}`],
      }));
      console.warn("[/atlas] AnswerSpec Zod validation failed:", zodError);
    }

    if (revision > 0 && !isPartial) {
      lastRevisionRef.current = revision;
    }
  }, [state?.answer_spec_envelope, state?.canvas_cleared]);

  const { messages, sendMessage, status } = useAtlas5Chat();
  const sendMessageRef = useRef(sendMessage);
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const chatPending = status === "streaming" || status === "submitted";
  const turnActive = Boolean(state?.turn_active ?? devMeta?.turn_active);
  const canvasThinking = chatPending || turnActive || envelopeStatus === "partial";

  useEffect(() => {
    const running = chatPending || turnActive || envelopeStatus === "partial";
    if (running) {
      if (turnStartedAtRef.current === null) {
        turnStartedAtRef.current = Date.now();
      }
      setTurnTiming((prev) => (prev.running ? prev : { ...prev, running: true }));
      const id = window.setInterval(() => {
        if (turnStartedAtRef.current !== null) {
          const elapsedMs = Date.now() - turnStartedAtRef.current;
          setTurnTiming((prev) =>
            prev.running && prev.elapsedMs === elapsedMs
              ? prev
              : { running: true, elapsedMs },
          );
        }
      }, 1000);
      return () => window.clearInterval(id);
    }

    if (turnStartedAtRef.current !== null) {
      const elapsedMs = Date.now() - turnStartedAtRef.current;
      turnStartedAtRef.current = null;
      setTurnTiming({ running: false, elapsedMs });
    }
  }, [chatPending, turnActive, envelopeStatus]);

  const refreshThreadList = useCallback(async () => {
    if (refreshInFlightRef.current) {
      await refreshInFlightRef.current;
      return;
    }

    const run = (async () => {
      setThreadsSyncing(true);
      try {
        const result = await fetchThreadList();
        setThreads(result.threads);
        writeCachedThreadList(result.threads);
        setPersistConfigured(result.configured);
        if (!result.configured) {
          setPersistStatus("unavailable");
        } else if (!result.authorized) {
          setPersistStatus("error");
        }
      } finally {
        setThreadsSyncing(false);
      }
    })();

    refreshInFlightRef.current = run.finally(() => {
      refreshInFlightRef.current = null;
    });
    await refreshInFlightRef.current;
  }, []);

  const rehydrateThread = useCallback(
    async (threadId: string) => {
      setRehydrating(true);
      setCopilotBoundThreadId(null);
      setCaseEntityId(null);
      setRestoredMessages([]);
      setSpec(null);
      setDevMeta(null);
      setReasoningTrace([]);
      setEnvelopeStatus("final");
      lastRevisionRef.current = 0;
      try {
        const detail = await fetchThreadDetail(threadId);
        if (!detail) {
          setRestoredMessages([]);
          setSpec(null);
          setDevMeta(null);
          setStateRef.current?.({
            answer_spec_envelope: { revision: 0, status: "final" },
            canvas_cleared: true,
            answer_dev_meta: {},
            reasoning_trace: [],
            turn_active: false,
            session_history: [],
            thread_id: threadId,
            case_entity_id: null,
          });
          return;
        }

        const msgs = turnsToChatMessages(detail.turns);
        const sessionHistory = turnsToSessionHistory(detail.turns);
        let lastSpec: AnswerSpec | null = null;
        let lastDevMeta: AtlasDevMeta | null = null;
        for (const turn of detail.turns) {
          if (turn.answer_dev_meta && Object.keys(turn.answer_dev_meta).length > 0) {
            lastDevMeta = turn.answer_dev_meta;
          }
          if (turn.answer_spec) {
            const validated = validateFinalAnswerSpec(turn.answer_spec);
            if (validated.success) lastSpec = validated.data;
          }
        }

        setRestoredMessages(msgs);
        setDevMeta(lastDevMeta);
        lastPersistedKeyRef.current = `${detail.turns.length}:${msgs.length}`;

        if (lastSpec) {
          setSpec(lastSpec);
          setDataSource("brain");
          setStateRef.current?.({
            session_history: sessionHistory,
            answer_spec_envelope: {
              revision: detail.turns.length,
              status: "final",
              spec: lastSpec,
            },
            canvas_cleared: false,
            answer_dev_meta: lastDevMeta ?? {},
            reasoning_trace: [],
            turn_active: false,
            thread_id: threadId,
            case_entity_id: null,
          });
          lastRevisionRef.current = detail.turns.length;
        } else {
          setSpec(null);
          setDataSource("brain");
          setStateRef.current?.({
            session_history: sessionHistory,
            answer_spec_envelope: { revision: detail.turns.length, status: "final" },
            canvas_cleared: true,
            answer_dev_meta: lastDevMeta ?? {},
            reasoning_trace: [],
            turn_active: false,
            thread_id: threadId,
            case_entity_id: null,
          });
          lastRevisionRef.current = detail.turns.length;
        }
      } finally {
        setRehydrating(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (threadInitRef.current) return;
    threadInitRef.current = true;
    void refreshThreadList();
  }, [refreshThreadList]);

  useEffect(() => {
    const urlThread = initialThreadId?.trim();
    if (!urlThread) return;
    if (syncedUrlThreadRef.current === urlThread) return;
    syncedUrlThreadRef.current = urlThread;

    setAtlasV5ThreadId(urlThread);
    setActiveThreadId(urlThread);
    syncAgentThreadContext(urlThread, null);
    setCopilotBoundThreadId(null);
    setReasoningTrace([]);
    lastPersistedKeyRef.current = "";

    void rehydrateThread(urlThread);
  }, [initialThreadId, rehydrateThread, syncAgentThreadContext]);

  useEffect(() => {
    const q = bootstrapQuery?.trim();
    if (!q || initialThreadId?.trim()) return;

    const fromEntry = consumePendingBootstrap(q);
    if (!fromEntry && wasBootstrapSent(q)) return;

    const tid = crypto.randomUUID();
    writeAtlasSessionQuery(q);
    router.replace(buildAtlasBootstrapUrl(tid, q), { scroll: false });
  }, [bootstrapQuery, initialThreadId, router]);

  const turnTimingRef = useRef(turnTiming);
  useEffect(() => {
    turnTimingRef.current = turnTiming;
  }, [turnTiming]);

  const beginUserTurn = useCallback(() => {
    setSpec(null);
    setDevMeta(null);
    setEnvelopeStatus("final");
    lastRevisionRef.current = 0;
    setStateRef.current?.({
      answer_spec_envelope: { revision: 0, status: "final" },
      canvas_cleared: true,
      turn_active: true,
      reasoning_trace: [],
    });
    turnStartedAtRef.current = Date.now();
    setTurnTiming({ running: true, elapsedMs: 0 });
  }, []);

  useEffect(() => {
    if (rehydrating) return;
    if (chatPending || turnActive || envelopeStatus === "partial") return;

    const useCopilotMessages =
      messages.length > 0 &&
      activeThreadId !== null &&
      copilotBoundThreadId === activeThreadId;

    const liveMessages: ChatMessage[] = useCopilotMessages
      ? messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.parts.map((p) => p.text).join(""),
        }))
      : restoredMessages;

    const lastUser = [...liveMessages].reverse().find((m) => m.role === "user");
    const lastAssistant = [...liveMessages]
      .reverse()
      .find((m) => m.role === "assistant");

    if (!lastUser?.content?.trim()) return;
    if (!lastAssistant?.content?.trim()) return;

    const revision = state?.answer_spec_envelope?.revision ?? liveMessages.length;
    const persistKey = `${revision}:${liveMessages.length}:${lastAssistant.content.slice(0, 40)}`;
    if (persistKey === lastPersistedKeyRef.current) return;

    const threadId = activeThreadId ?? readAtlasV5ThreadId();
    const userText = lastUser.content;
    void (async () => {
      if (!persistConfigured) {
        setPersistStatus("unavailable");
        return;
      }
      setPersistStatus("saving");
      await ensureThread(threadId, titleFromQuery(userText));
      const ok = await persistTurn(threadId, {
        user_message: userText,
        assistant_reply: lastAssistant.content,
        route: devMeta?.route ?? null,
        outcome_hint:
          (devMeta as { outcome_hint?: string } | null)?.outcome_hint ?? null,
        answer_spec: state?.canvas_cleared ? null : spec,
        answer_dev_meta: devMeta,
        layout_signals: extractLayoutSignals(
          state?.canvas_cleared ? null : spec,
          devMeta,
        ),
        latency_ms: turnTimingRef.current.elapsedMs,
      });
      if (ok) {
        lastPersistedKeyRef.current = persistKey;
        setPersistStatus("saved");
        void refreshThreadList();
        upsertCachedThread({
          id: threadId,
          title: titleFromQuery(userText),
          lens: "CPC",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else {
        setPersistStatus("error");
      }
    })();
  }, [
    activeThreadId,
    chatPending,
    copilotBoundThreadId,
    devMeta,
    messages,
    persistConfigured,
    restoredMessages,
    spec,
    state?.canvas_cleared,
    turnActive,
    envelopeStatus,
    rehydrating,
    refreshThreadList,
    state?.answer_spec_envelope?.revision,
  ]);

  useEffect(() => {
    const q = bootstrapQuery?.trim();
    const urlThread = initialThreadId?.trim();
    if (!q || !urlThread) return;
    if (bootstrapBootRef.current) return;

    const fromEntry = consumePendingBootstrap(q);
    if (!fromEntry && wasBootstrapSent(q)) {
      bootstrapBootRef.current = true;
      return;
    }

    bootstrapBootRef.current = true;
    void ensureThread(urlThread, titleFromQuery(q));

    const delayMs = fromEntry ? 700 : 400;
    const timer = window.setTimeout(() => {
      setCopilotBoundThreadId(urlThread);
      beginUserTurn();
      sendMessageRef.current({
        role: "user",
        parts: [{ type: "text", text: q }],
      });
      markBootstrapSent(q);
      router.replace(buildAtlasThreadUrl(urlThread), { scroll: false });
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [beginUserTurn, bootstrapQuery, initialThreadId, router]);

  const chatMessages: ChatMessage[] = useMemo(() => {
    const useCopilotMessages =
      messages.length > 0 &&
      activeThreadId !== null &&
      copilotBoundThreadId === activeThreadId;

    const fromRuntime = useCopilotMessages
      ? messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.parts.map((p) => p.text).join(""),
        }))
      : restoredMessages;

    if (fromRuntime.length > 0) return fromRuntime;

    const q = bootstrapQuery?.trim();
    if (q) return [{ role: "user", content: q }];

    return [];
  }, [activeThreadId, bootstrapQuery, copilotBoundThreadId, messages, restoredMessages]);

  const handleFollowUp = useCallback(
    (message: string) => {
      if (activeThreadId) {
        setCopilotBoundThreadId(activeThreadId);
      }
      beginUserTurn();
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: message }],
      });
    },
    [activeThreadId, beginUserTurn, sendMessage],
  );

  const showcaseOptions = devMeta?.showcase?.options;

  const handleShowcaseSelect = useCallback(
    (command: string) => {
      if (activeThreadId) {
        setCopilotBoundThreadId(activeThreadId);
      }
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: command }],
      });
    },
    [activeThreadId, sendMessage],
  );

  useLayoutEffect(() => {
    if (threadsHydratedRef.current) return;
    threadsHydratedRef.current = true;
    const cached = readCachedThreadList();
    if (cached.length > 0) {
      setThreads(cached);
    }
  }, []);

  const resetWorkbenchState = useCallback(() => {
    writeAtlasSessionQuery("");
    clearBootstrapSent();
    bootstrapBootRef.current = false;
    lastPersistedKeyRef.current = "";
    setCopilotBoundThreadId(null);
    setCaseEntityId(null);
    setRestoredMessages([]);
    setSpec(null);
    setDevMeta(null);
    setReasoningTrace([]);
    setEnvelopeStatus("final");
    lastRevisionRef.current = 0;
    setStateRef.current?.({
      answer_spec_envelope: { revision: 0, status: "final" },
      canvas_cleared: true,
      answer_dev_meta: {},
      reasoning_trace: [],
      turn_active: false,
      session_history: [],
    });
  }, []);

  const handleBackToEntry = useCallback(() => {
    if (chatPending) return;
    resetWorkbenchState();
    syncedUrlThreadRef.current = null;
    router.push("/atlas");
  }, [chatPending, resetWorkbenchState, router]);

  const handleNewQuestion = useCallback(() => {
    if (chatPending) return;
    resetWorkbenchState();
    syncedUrlThreadRef.current = null;
    const tid = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimistic: ThreadSummary = {
      id: tid,
      title: "New session",
      lens: "CPC",
      created_at: now,
      updated_at: now,
    };
    setThreads((prev) => {
      const next = [optimistic, ...prev.filter((t) => t.id !== tid)];
      writeCachedThreadList(next);
      return next;
    });
    void ensureThread(tid, "New session");
    void refreshThreadList();
    router.push(buildAtlasThreadUrl(tid));
  }, [chatPending, refreshThreadList, resetWorkbenchState, router]);

  const handleSelectThread = useCallback(
    (threadId: string) => {
      if (chatPending || rehydrating) return;
      if (threadId === activeThreadId) return;
      writeAtlasSessionQuery("");
      setCopilotBoundThreadId(null);
      syncedUrlThreadRef.current = "";
      router.push(buildAtlasThreadUrl(threadId));
    },
    [activeThreadId, chatPending, rehydrating, router],
  );

  const handleRenameThread = useCallback(
    async (threadId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const ok = await patchThreadTitle(threadId, trimmed);
      if (ok) {
        setThreads((prev) => {
          const next = prev.map((t) => (t.id === threadId ? { ...t, title: trimmed } : t));
          writeCachedThreadList(next);
          return next;
        });
        void refreshThreadList();
      }
    },
    [refreshThreadList],
  );

  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      if (chatPending) return;
      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== threadId);
        writeCachedThreadList(next);
        return next;
      });
      removeCachedThread(threadId);
      const ok = await archiveThread(threadId);
      if (!ok) {
        void refreshThreadList();
        return;
      }
      void refreshThreadList();
      if (threadId === activeThreadId) {
        handleNewQuestion();
      }
    },
    [activeThreadId, chatPending, handleNewQuestion, refreshThreadList],
  );

  const handleClearAllSessions = useCallback(async () => {
    if (chatPending || threads.length === 0) return;
    const ids = threads.map((t) => t.id);
    setThreads([]);
    clearCachedThreadList();
    await Promise.all(ids.map((id) => archiveThread(id)));
    void refreshThreadList();
    handleBackToEntry();
  }, [chatPending, handleBackToEntry, refreshThreadList, threads]);

  const handleUxPrefsChange = useCallback(
    (patch: Partial<AtlasUxPrefs>) => {
      const next = patchAtlasUxPrefs(patch);
      const nextAgentPrefs = uxPrefsForAgent(next);
      setUxPrefs(next);
      setStateRef.current?.((prev) => {
        const current = prev?.ux_prefs ?? {};
        if (
          current.streamInterimChat === nextAgentPrefs.streamInterimChat &&
          current.streamChatTokens === nextAgentPrefs.streamChatTokens &&
          current.streamCompose === nextAgentPrefs.streamCompose &&
          current.collapsibleCot === nextAgentPrefs.collapsibleCot
        ) {
          return prev;
        }
        return {
          ...prev,
          ux_prefs: nextAgentPrefs,
        };
      });
    },
    [],
  );

  const progressLine =
    canvasThinking && reasoningTrace.length > 0
      ? latestReasoningProgress(reasoningTrace)
      : null;

  return (
    <AtlasAnswerSurface
      spec={spec}
      dataSource={dataSource}
      onFollowUp={handleFollowUp}
      devMeta={devMeta}
      chatMessages={chatMessages}
      chatPending={chatPending}
      canvasThinking={canvasThinking}
      reasoningTrace={reasoningTrace}
      envelopePartial={envelopeStatus === "partial"}
      showcaseOptions={showcaseOptions}
      onShowcaseSelect={handleShowcaseSelect}
      bootstrapQuery={bootstrapQuery}
      onNewSession={handleBackToEntry}
      onNewThread={handleNewQuestion}
      onClearAllSessions={handleClearAllSessions}
      collapsibleCot={uxPrefs.collapsibleCot}
      progressLine={progressLine}
      uxPrefs={uxPrefs}
      onUxPrefsChange={handleUxPrefsChange}
      turnTiming={turnTiming}
      activeThreadId={activeThreadId}
      threads={threads}
      threadsSyncing={threadsSyncing}
      onSelectThread={handleSelectThread}
      historyDisabled={chatPending}
      persistStatus={persistStatus}
      persistConfigured={persistConfigured}
      onDeleteThread={handleDeleteThread}
      onRenameThread={handleRenameThread}
      rehydrating={rehydrating}
      onCaseFileSwot={handleFollowUp}
      onCaseEntityAttached={handleCaseEntityAttached}
    />
  );
}

/** @deprecated Use AtlasCopilotShell — REST path kept for tests. */
export { AtlasCopilotShell as AtlasClientShell };
