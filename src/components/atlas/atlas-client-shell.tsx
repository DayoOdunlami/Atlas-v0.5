"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useCoAgent } from "@copilotkit/react-core";

import { AtlasAnswerSurface } from "@/components/atlas/atlas-answer-surface";
import type { AtlasReasoningStep } from "@/components/atlas/shell/canvas-thinking";
import type { AtlasDevMeta } from "@/components/atlas/shell/dev-overlay";
import type { ChatMessage } from "@/components/atlas/shell/so-what-rail";
import { startNewAtlasV5Thread } from "@/components/copilotkit-provider";
import { useAtlas5Chat } from "@/hooks/use-atlas5-chat";
import {
  formatZodError,
  validateFinalAnswerSpec,
  validatePartialAnswerSpec,
  type AnswerSpec,
  type AnswerSpecEnvelope,
} from "@/lib/atlas/contracts/answer-spec.schema";
import type { AnswerSpecSource } from "@/lib/atlas/fetch-answer-spec";
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
import { latestReasoningProgress } from "@/components/atlas/shell/canvas-thinking";

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
}: {
  initialSpec: AnswerSpec | null;
  initialDataSource: AnswerSpecSource;
  bootstrapQuery?: string;
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
    const q = bootstrapQuery?.trim();
    if (!q) return;
    if (bootstrapBootRef.current) return;
    if (wasBootstrapSent(q)) {
      bootstrapBootRef.current = true;
      return;
    }

    const fromEntry = consumePendingBootstrap(q);
    if (fromEntry) {
      writeAtlasSessionQuery(q);
      startNewAtlasV5Thread();
    } else if (readAtlasSessionQuery() !== q) {
      writeAtlasSessionQuery(q);
      startNewAtlasV5Thread();
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

  const chatMessages: ChatMessage[] =
    messages.length > 0
      ? messages.map((m) => ({
          role: m.role,
          content: m.parts.map((p) => p.text).join(""),
        }))
      : [];

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
    startNewAtlasV5Thread();
    router.push("/atlas");
  }, [chatPending, router, setState]);

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
    />
  );
}

/** @deprecated Use AtlasCopilotShell — REST path kept for tests. */
export { AtlasCopilotShell as AtlasClientShell };
