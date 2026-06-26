"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useCoAgent } from "@copilotkit/react-core";

import { AtlasAnswerSurface } from "@/components/atlas/atlas-answer-surface";
import type { AtlasReasoningStep } from "@/components/atlas/shell/canvas-thinking";
import type { AtlasDevMeta } from "@/components/atlas/shell/dev-overlay";
import type { ChatMessage } from "@/components/atlas/shell/so-what-rail";
import {
  AtlasThreadSidebar,
  readHistorySidebarOpen,
  writeHistorySidebarOpen,
} from "@/components/atlas/shell/atlas-thread-sidebar";
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
  ensureThread,
  fetchThreadDetail,
  fetchThreadList,
  persistTurn,
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
import { startNewAtlasV5Thread, readAtlasV5ThreadId, setAtlasV5ThreadId } from "@/components/copilotkit-provider";

type AtlasV5CoState = {
  answer_spec_envelope?: AnswerSpecEnvelope;
  answer_dev_meta?: AtlasDevMeta;
  canvas_cleared?: boolean;
  query?: string;
  reasoning_trace?: AtlasReasoningStep[];
  turn_active?: boolean;
  ux_prefs?: Record<string, boolean>;
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

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    setState?.({
      answer_spec_envelope: initialEnvelope,
      canvas_cleared: !initialSpec,
    });
  }, [initialEnvelope, initialSpec, setState]);

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
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [restoredMessages, setRestoredMessages] = useState<ChatMessage[]>([]);
  const lastPersistedKeyRef = useRef<string>("");
  const threadInitRef = useRef(false);

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
      setDevMeta((prev) => ({
        ...prev,
        ...state.answer_dev_meta,
        partial_stage: state.answer_dev_meta?.partial_stage ?? prev?.partial_stage,
        route: state.answer_dev_meta?.route ?? prev?.route,
        route_source: state.answer_dev_meta?.route_source ?? prev?.route_source,
      }));
      if (state.answer_dev_meta?.route || state.answer_dev_meta?.disposition) {
        setDataSource("brain");
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
      setTurnTiming((prev) => ({ ...prev, running: true }));
      const id = window.setInterval(() => {
        if (turnStartedAtRef.current !== null) {
          setTurnTiming({
            running: true,
            elapsedMs: Date.now() - turnStartedAtRef.current,
          });
        }
      }, 200);
      return () => window.clearInterval(id);
    }

    if (turnStartedAtRef.current !== null) {
      const elapsedMs = Date.now() - turnStartedAtRef.current;
      turnStartedAtRef.current = null;
      setTurnTiming({ running: false, elapsedMs });
    }
  }, [chatPending, turnActive, envelopeStatus]);

  useEffect(() => {
    setHistoryOpen(readHistorySidebarOpen());
  }, []);

  const refreshThreadList = useCallback(async () => {
    setThreadsLoading(true);
    try {
      setThreads(await fetchThreadList());
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  const rehydrateThread = useCallback(
    async (threadId: string) => {
      const detail = await fetchThreadDetail(threadId);
      if (!detail) return;

      const msgs: ChatMessage[] = [];
      let lastSpec: AnswerSpec | null = null;
      for (const turn of detail.turns) {
        if (turn.user_message?.trim()) {
          msgs.push({ role: "user", content: turn.user_message });
        }
        if (turn.assistant_reply?.trim()) {
          msgs.push({ role: "assistant", content: turn.assistant_reply });
        }
        if (turn.answer_spec) {
          const validated = validateFinalAnswerSpec(turn.answer_spec);
          if (validated.success) lastSpec = validated.data;
        }
      }

      setRestoredMessages(msgs);
      lastPersistedKeyRef.current = `${detail.turns.length}:${msgs.length}`;

      if (lastSpec) {
        setSpec(lastSpec);
        setDataSource("brain");
        setState?.({
          answer_spec_envelope: {
            revision: detail.turns.length,
            status: "final",
            spec: lastSpec,
          },
          canvas_cleared: false,
        });
        lastRevisionRef.current = detail.turns.length;
      }
    },
    [setState],
  );

  useEffect(() => {
    if (threadInitRef.current) return;
    threadInitRef.current = true;

    const tid = initialThreadId?.trim() || readAtlasV5ThreadId();
    setActiveThreadId(tid);
    setAtlasV5ThreadId(tid);

    void refreshThreadList();
    if (initialThreadId?.trim()) {
      void rehydrateThread(tid);
    }

    const q = bootstrapQuery?.trim();
    if (q && !initialThreadId?.trim()) {
      void ensureThread(tid, titleFromQuery(q));
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("thread") !== tid) {
        params.set("thread", tid);
        router.replace(`/atlas?${params.toString()}`, { scroll: false });
      }
    }
  }, [bootstrapQuery, initialThreadId, rehydrateThread, refreshThreadList, router]);

  useEffect(() => {
    if (chatPending || turnActive) return;
    const envelope = state?.answer_spec_envelope;
    if (!envelope || envelope.status !== "final") return;

    const revision = envelope.revision ?? 0;
    const liveMessages: ChatMessage[] =
      messages.length > 0
        ? messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.parts.map((p) => p.text).join(""),
          }))
        : restoredMessages;

    const lastUser = [...liveMessages].reverse().find((m) => m.role === "user");
    const lastAssistant = [...liveMessages]
      .reverse()
      .find((m) => m.role === "assistant");

    if (!lastUser && !lastAssistant) return;

    const persistKey = `${revision}:${liveMessages.length}:${lastAssistant?.content?.slice(0, 40) ?? ""}`;
    if (persistKey === lastPersistedKeyRef.current) return;

    const threadId = activeThreadId ?? readAtlasV5ThreadId();
    const userText = lastUser?.content ?? state?.query ?? bootstrapQuery ?? "";
    void (async () => {
      await ensureThread(threadId, titleFromQuery(userText));
      const ok = await persistTurn(threadId, {
        user_message: userText,
        assistant_reply: lastAssistant?.content ?? "",
        route: devMeta?.route ?? null,
        outcome_hint:
          (devMeta as { outcome_hint?: string } | null)?.outcome_hint ?? null,
        answer_spec: state?.canvas_cleared ? null : spec,
        answer_dev_meta: devMeta,
        layout_signals: extractLayoutSignals(
          state?.canvas_cleared ? null : spec,
          devMeta,
        ),
        latency_ms: turnTiming.elapsedMs,
      });
      if (ok) {
        lastPersistedKeyRef.current = persistKey;
        void refreshThreadList();
      }
    })();
  }, [
    activeThreadId,
    bootstrapQuery,
    chatPending,
    devMeta,
    messages,
    restoredMessages,
    spec,
    state?.answer_spec_envelope,
    state?.canvas_cleared,
    state?.query,
    turnActive,
    turnTiming.elapsedMs,
    refreshThreadList,
  ]);

  useEffect(() => {
    const q = bootstrapQuery?.trim();
    if (!q) return;
    if (bootstrapBootRef.current) return;

    const fromEntry = consumePendingBootstrap(q);
    if (!fromEntry && wasBootstrapSent(q)) {
      bootstrapBootRef.current = true;
      return;
    }

    if (fromEntry) {
      writeAtlasSessionQuery(q);
      const tid = startNewAtlasV5Thread();
      setActiveThreadId(tid);
      void ensureThread(tid, titleFromQuery(q));
    } else if (readAtlasSessionQuery() !== q) {
      writeAtlasSessionQuery(q);
      const tid = startNewAtlasV5Thread();
      setActiveThreadId(tid);
      void ensureThread(tid, titleFromQuery(q));
    }

    bootstrapBootRef.current = true;
    markBootstrapSent(q);

    const delayMs = fromEntry ? 450 : 150;
    const timer = window.setTimeout(() => {
      sendMessageRef.current({
        role: "user",
        parts: [{ type: "text", text: q }],
      });
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [bootstrapQuery]);

  const chatMessages: ChatMessage[] = useMemo(() => {
    const fromRuntime =
      messages.length > 0
        ? messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.parts.map((p) => p.text).join(""),
          }))
        : restoredMessages;

    if (fromRuntime.length > 0) return fromRuntime;

    const q = bootstrapQuery?.trim();
    if (q) return [{ role: "user", content: q }];

    return [];
  }, [bootstrapQuery, messages, restoredMessages]);

  const handleFollowUp = useCallback(
    (message: string) => {
      turnStartedAtRef.current = Date.now();
      setTurnTiming({ running: true, elapsedMs: 0 });
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: message }],
      });
    },
    [sendMessage],
  );

  const showcaseOptions = devMeta?.showcase?.options;

  const handleShowcaseSelect = useCallback(
    (command: string) => {
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: command }],
      });
    },
    [sendMessage],
  );

  const handleNewSession = useCallback(() => {
    if (chatPending) return;
    writeAtlasSessionQuery("");
    clearBootstrapSent();
    bootstrapBootRef.current = false;
    lastPersistedKeyRef.current = "";
    setRestoredMessages([]);
    setSpec(null);
    setDevMeta(null);
    setReasoningTrace([]);
    setEnvelopeStatus("final");
    lastRevisionRef.current = 0;
    setState?.({
      answer_spec_envelope: { revision: 0, status: "final" },
      canvas_cleared: true,
      answer_dev_meta: {},
      reasoning_trace: [],
      turn_active: false,
    });
    const tid = startNewAtlasV5Thread();
    setActiveThreadId(tid);
    void ensureThread(tid, "New session");
    void refreshThreadList();
    router.push(`/atlas?thread=${tid}`);
  }, [chatPending, refreshThreadList, router, setState]);

  const handleSelectThread = useCallback(
    (threadId: string) => {
      if (chatPending) return;
      setAtlasV5ThreadId(threadId);
      setActiveThreadId(threadId);
      setRestoredMessages([]);
      setSpec(null);
      setDevMeta(null);
      setReasoningTrace([]);
      lastRevisionRef.current = 0;
      lastPersistedKeyRef.current = "";
      setState?.({
        answer_spec_envelope: { revision: 0, status: "final" },
        canvas_cleared: true,
        answer_dev_meta: {},
        reasoning_trace: [],
        turn_active: false,
      });
      router.push(`/atlas?thread=${threadId}`);
      void rehydrateThread(threadId);
    },
    [chatPending, rehydrateThread, router, setState],
  );

  const handleToggleHistory = useCallback(() => {
    setHistoryOpen((open) => {
      const next = !open;
      writeHistorySidebarOpen(next);
      return next;
    });
  }, []);

  const handleNewThreadFromSidebar = useCallback(() => {
    handleNewSession();
  }, [handleNewSession]);

  const handleUxPrefsChange = useCallback(
    (patch: Partial<AtlasUxPrefs>) => {
      const next = patchAtlasUxPrefs(patch);
      setUxPrefs(next);
      setState?.((prev) => ({
        ...prev,
        ux_prefs: uxPrefsForAgent(next),
      }));
    },
    [setState],
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
      onNewSession={handleNewSession}
      collapsibleCot={uxPrefs.collapsibleCot}
      progressLine={progressLine}
      uxPrefs={uxPrefs}
      onUxPrefsChange={handleUxPrefsChange}
      turnTiming={turnTiming}
      activeThreadId={activeThreadId}
      threads={threads}
      threadsLoading={threadsLoading}
      historyOpen={historyOpen}
      onToggleHistory={handleToggleHistory}
      onSelectThread={handleSelectThread}
      onNewThread={handleNewThreadFromSidebar}
      historyDisabled={chatPending}
    />
  );
}

/** @deprecated Use AtlasCopilotShell — REST path kept for tests. */
export { AtlasCopilotShell as AtlasClientShell };
