/**
 * Main dashboard layout.
 * - Syncs agent state from CopilotKit (useCoAgent)
 * - Bridges reasoning_trace + progressive artifact_block → ArtifactStore
 */
"use client";

import { useEffect, useRef } from "react";
import { useCoAgent, useCopilotReadable, useCoAgentStateRender } from "@copilotkit/react-core";
import { AgentState, initialState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useChartActions, useSearchActions } from "@/components/chat/actions";
import { SurfaceSwitcher } from "@/components/dashboard/layout/surface-switcher";
import { useSurfaceGateway, useSurfaceStore } from "@/lib/atlas5/surface-gateway";
import {
  useArtifactStore,
  buildArtifactFromAtlas,
  type ReasoningStep,
} from "@/lib/atlas5/artifact-store";
import { ArtifactPane } from "@/components/atlas5/artifact-pane";
import { RunProgress } from "@/components/atlas5/run-progress";
import type { AgentId } from "@/lib/atlas5/types";

/** Same mapping as CopilotKitProvider — must stay in sync with agents/server.py. */
const COAGENT_NAME: Record<AgentId, string> = {
  ATLAS:    "atlas",
  JARVIS:   "jarvis",
  CICERONE: "cicerone",
  HYVE:     "hyve",
};

const AGENT_DESCRIPTIONS: Record<string, string> = {
  ATLAS: `The user is in ATLAS mode. Choose the artifact recipe based on query intent — do NOT default to brief_five_case for CPC-inward queries:

INWARD-FACING (about CPC's own evidence, capabilities, or portfolio):
- "What can CPC evidence support?" / "Where is CPC strongest?" → recipe='cpc_capability_assessment'
- "Compare CPC business units / domains" / "Which units are evidence-ready?" → recipe='cpc_portfolio_comparison'
- "Which live calls match CPC evidence?" / "Should CPC bid on X?" → recipe='cpc_market_alignment'
- "What evidence gaps exist?" / "What should CPC enrich?" → recipe='cpc_evidence_gaps'

OUTWARD-FACING (investment appraisal for an external programme or third-party initiative):
- "Build a Five Case brief for [external topic]" / "What is the strategic case for [programme]?" → recipe='brief_five_case' with NPV analysis at 3.5% STPR

DEFAULT: if the query mentions CPC capabilities, CPC projects, CPC portfolio, or CPC evidence readiness → use the appropriate cpc_* recipe. Only use brief_five_case for external investment appraisals.`,

  JARVIS:
    "The user is in JARVIS mode. Surface ranked evidence from the corpus with citations. Focus on search_corpus_* tools. Use set_artifact_block with recipe='evidence_panel'.",
  CICERONE:
    "The user is in CICERONE mode. Evaluate cross-sector transferability. Score 0-100 and identify HAVE/PARTIAL/MISSING evidence gaps. Use set_artifact_block with recipe='evidence_panel'.",
  HYVE:
    "The user is in HYVE mode. Surface HIVE case studies on climate adaptation and transport resilience. Use search_hive_evidence. Use set_artifact_block with recipe='evidence_panel'.",
};

const LENS_DESCRIPTIONS: Record<string, string> = {
  CPC: "Focus on Connected Places Catapult's own project portfolio and capability evidence.",
  Atlas: "Draw on the full Atlas innovation corpus across all CPC themes.",
  Ecosystem: "Focus on ecosystem partners, consortia, and collaboration opportunities.",
  Funder: "Focus on funding landscape, live calls, and investment opportunities.",
  Mode: "Focus on transport mode-specific evidence (rail, road, active travel, freight, etc.).",
};

function syncArtifactFromCoagent(
  raw: Record<string, unknown>,
  handlers: {
    setArtifact: ReturnType<typeof useArtifactStore.getState>["setArtifact"];
    setPartialArtifact: ReturnType<typeof useArtifactStore.getState>["setPartialArtifact"];
    setLoading: ReturnType<typeof useArtifactStore.getState>["setLoading"];
  },
) {
  const stage = raw._run_stage as string | undefined;
  const built = buildArtifactFromAtlas(raw);
  const hasSections = raw.sections && Object.keys(raw.sections as object).length > 0;
  const hasCitations = Array.isArray(raw.corpus_citations) && raw.corpus_citations.length > 0;
  const hasHeadline = Boolean(raw.headline || raw.insight_card);

  if (stage === "complete" || (raw.visual_blocks && (raw.visual_blocks as unknown[]).length > 0)) {
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
  if (hasSections) {
    handlers.setArtifact(built);
  }
}

export function MainLayout({ className }: { className?: string }) {
  const activeCoagentName = useSurfaceStore(
    (s) => COAGENT_NAME[s.surface.active_agent] ?? "atlas",
  );

  const { state, setState } = useCoAgent<AgentState>({
    name: activeCoagentName,
    initialState,
  });

  const { surface } = useSurfaceGateway();

  const agentHint = AGENT_DESCRIPTIONS[surface.active_agent] ?? AGENT_DESCRIPTIONS.ATLAS;
  const lensHint = LENS_DESCRIPTIONS[surface.active_lens] ?? LENS_DESCRIPTIONS.CPC;

  useCopilotReadable({
    description: "Active Atlas agent mode and lens",
    value: `${agentHint} ${lensHint}`,
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

  useCoAgentStateRender({
    name: activeCoagentName,
    render: ({ status, state: agentState }) => {
      if (status !== "inProgress") return null;
      const trace = (agentState as Record<string, unknown>)?.reasoning_trace;
      const steps = Array.isArray(trace) ? (trace as ReasoningStep[]) : reasoningTrace;
      return (
        <div className="px-2 py-1">
          <RunProgress steps={steps} active compact />
        </div>
      );
    },
  });

  useChartActions({ state, setState });
  useSearchActions();

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
      }
    }
  }, [state, setArtifact, setPartialArtifact, setLoading, startRun, setReasoningTrace, setStatusText]);

  return (
    <div className={cn("h-full flex flex-col overflow-hidden bg-muted/5", className)}>
      <SurfaceSwitcher state={state} setState={setState} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <ArtifactPane />
      </div>
    </div>
  );
}
