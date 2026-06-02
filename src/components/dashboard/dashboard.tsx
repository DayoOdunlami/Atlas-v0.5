/**
 * Main dashboard layout.
 * - Syncs agent state from CopilotKit (useCoAgent)
 * - Exposes active agent + lens to the LLM via useCopilotReadable
 *   so the Python graph knows which mode it should be in
 */
"use client";

import { useEffect } from "react";
import { useCoAgent, useCopilotReadable, useCoAgentStateRender } from "@copilotkit/react-core";
import { AgentState, initialState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useChartActions, useSearchActions } from "@/components/chat/actions";
import { SurfaceSwitcher } from "@/components/dashboard/layout/surface-switcher";
import { useSurfaceGateway, useSurfaceStore } from "@/lib/atlas5/surface-gateway";
import { useArtifactStore, buildArtifactFromAtlas } from "@/lib/atlas5/artifact-store";
import { ArtifactPane } from "@/components/atlas5/artifact-pane";
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

export function MainLayout({ className }: { className?: string }) {
  // Derive the coagent name from the active agent in the surface store.
  // This must match the CopilotKitProvider AGENT_NAME mapping so that
  // <CopilotKit agent={X}> and useCoAgent({ name: X }) are always in sync.
  const activeCoagentName = useSurfaceStore(
    (s) => COAGENT_NAME[s.surface.active_agent] ?? "atlas",
  );

  const { state, setState } = useCoAgent<AgentState>({
    name: activeCoagentName,
    initialState,
  });

  const { surface } = useSurfaceGateway();

  // Inject active agent + lens context into the LLM's readable context
  const agentHint = AGENT_DESCRIPTIONS[surface.active_agent] ?? AGENT_DESCRIPTIONS.ATLAS;
  const lensHint = LENS_DESCRIPTIONS[surface.active_lens] ?? LENS_DESCRIPTIONS.CPC;

  useCopilotReadable({
    description: "Active Atlas agent mode and lens",
    value: `${agentHint} ${lensHint}`,
  });

  // Suppress CopilotKit's default raw-JSON state render in the chat panel.
  // Without this, CopilotKit renders a ```json code block for every STATE_SNAPSHOT.
  // We render the output through the structured artifact panel instead.
  // reasoning_trace is written by each graph node — show the last entry's thought
  // as a plain-English status message while the agent runs.
  useCoAgentStateRender({
    name: activeCoagentName,
    render: ({ status, state: agentState }) => {
      if (status === "inProgress") {
        const trace = (agentState as Record<string, unknown>)?.reasoning_trace;
        const entries = Array.isArray(trace) ? trace as Array<Record<string, unknown>> : [];
        const last = entries.length > 0 ? entries[entries.length - 1] : null;
        const thought = last?.thought as string | undefined;
        return (
          <div className="text-sm text-muted-foreground px-3 py-2 animate-pulse">
            {thought ? thought : "Analysing evidence…"}
          </div>
        );
      }
      return null;
    },
  });

  // Setup tool rendering and front-end tools
  useChartActions({ state, setState });
  useSearchActions();

  // Bridge coagent artifact_block → shared ArtifactStore so ArtifactPane can render it
  const { setArtifact, startRun } = useArtifactStore();

  useEffect(() => {
    const ab = (state as Record<string, unknown> | undefined)?.artifact_block;
    if (ab && typeof ab === "object" && !Array.isArray(ab)) {
      const raw = ab as Record<string, unknown>;
      if (raw.sections && Object.keys(raw.sections as object).length > 0) {
        setArtifact(buildArtifactFromAtlas(raw));
      }
    } else if (ab === null || ab === undefined) {
      // Only call startRun when the agent is actively running
    }
  }, [(state as Record<string, unknown> | undefined)?.artifact_block, setArtifact]);

  return (
    <div className={cn("h-full flex flex-col overflow-hidden bg-muted/5", className)}>
      <SurfaceSwitcher state={state} setState={setState} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <ArtifactPane />
      </div>
    </div>
  );
}
