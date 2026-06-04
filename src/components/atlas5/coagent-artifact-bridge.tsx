"use client";

/**
 * Bridges CopilotKit useCoAgent state → Zustand artifact store.
 * Required on any page that uses ChatPane + ArtifactPane without MainLayout
 * (e.g. /atlas5-test Playwright harness).
 */
import { useEffect, useRef } from "react";
import { useCoAgent } from "@copilotkit/react-core";
import { AgentState, initialState } from "@/lib/types";
import { useSurfaceStore } from "@/lib/atlas5/surface-gateway";
import {
  useArtifactStore,
  buildArtifactFromAtlas,
  type ReasoningStep,
} from "@/lib/atlas5/artifact-store";
import type { AgentId } from "@/lib/atlas5/types";

const COAGENT_NAME: Record<AgentId, string> = {
  ATLAS: "atlas",
  JARVIS: "jarvis",
  CICERONE: "cicerone",
  HYVE: "hyve",
};

function syncArtifactFromCoagent(
  raw: Record<string, unknown>,
  handlers: {
    setArtifact: ReturnType<typeof useArtifactStore.getState>["setArtifact"];
    setPartialArtifact: ReturnType<
      typeof useArtifactStore.getState
    >["setPartialArtifact"];
    setLoading: ReturnType<typeof useArtifactStore.getState>["setLoading"];
  },
) {
  const stage = raw._run_stage as string | undefined;
  const built = buildArtifactFromAtlas(raw);
  const hasSections =
    raw.sections && Object.keys(raw.sections as object).length > 0;
  const hasCitations =
    Array.isArray(raw.corpus_citations) && raw.corpus_citations.length > 0;
  const hasHeadline = Boolean(raw.headline || raw.insight_card);
  const hasEntityProfile = Boolean(raw.entity_profile);

  if (
    stage === "complete" ||
    (raw.visual_blocks && (raw.visual_blocks as unknown[]).length > 0) ||
    hasEntityProfile
  ) {
    handlers.setArtifact(built);
    return;
  }
  if (stage === "search" && hasCitations) {
    handlers.setPartialArtifact(built);
    handlers.setLoading(true);
    return;
  }
  if (stage === "build" && (hasSections || hasHeadline)) {
    handlers.setPartialArtifact(built);
    handlers.setLoading(true);
    return;
  }
  if (hasSections || hasEntityProfile) {
    handlers.setArtifact(built);
  }
}

export function CoAgentArtifactBridge() {
  const activeCoagentName = useSurfaceStore(
    (s) => COAGENT_NAME[s.surface.active_agent] ?? "atlas",
  );

  const { state } = useCoAgent<AgentState>({
    name: activeCoagentName,
    initialState,
  });

  const {
    setArtifact,
    setPartialArtifact,
    setLoading,
    startRun,
    setReasoningTrace,
    setStatusText,
    reasoningTrace,
  } = useArtifactStore();

  const runStartedRef = useRef(false);

  useEffect(() => {
    const agentState = state as Record<string, unknown> | undefined;
    if (!agentState) return;

    const trace = agentState.reasoning_trace;
    if (Array.isArray(trace) && trace.length > 0) {
      setReasoningTrace(trace as ReasoningStep[]);
      const last = trace[trace.length - 1] as Record<string, unknown>;
      if (typeof last.thought === "string") {
        setStatusText(last.thought);
      }
      const pipelineNodes = new Set([
        "reset_analyze_state",
        "select_recipe_intent",
        "search_corpus",
        "build_five_case",
      ]);
      const isPipeline = trace.some(
        (t: Record<string, unknown>) => pipelineNodes.has(String(t.node ?? "")),
      );
      if (isPipeline && !runStartedRef.current) {
        startRun();
        runStartedRef.current = true;
      }
    } else {
      runStartedRef.current = false;
    }

    const ab = agentState.artifact_block;
    if (ab && typeof ab === "object" && !Array.isArray(ab)) {
      syncArtifactFromCoagent(ab as Record<string, unknown>, {
        setArtifact,
        setPartialArtifact,
        setLoading,
      });
      const stage = (ab as Record<string, unknown>)._run_stage;
      if (stage === "complete") {
        runStartedRef.current = false;
        setLoading(false);
      }
    }
  }, [
    state,
    setArtifact,
    setPartialArtifact,
    setLoading,
    startRun,
    setReasoningTrace,
    setStatusText,
    reasoningTrace,
  ]);

  return null;
}
