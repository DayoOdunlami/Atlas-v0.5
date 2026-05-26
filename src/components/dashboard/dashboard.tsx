/**
 * Main dashboard layout.
 * - Syncs agent state from CopilotKit (useCoAgent)
 * - Exposes active agent + lens to the LLM via useCopilotReadable
 *   so the Python graph knows which mode it should be in
 */
"use client";

import { useCoAgent, useCopilotReadable } from "@copilotkit/react-core";
import { AgentState, initialState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PinnedMetrics } from "@/components/dashboard/layout/metrics";
import { Charts } from "@/components/dashboard/layout/charts";
import { useChartActions, useSearchActions } from "@/components/chat/actions";
import { SurfaceSwitcher } from "@/components/dashboard/layout/surface-switcher";
import { DecisionSpineCard } from "@/components/dashboard/layout/decision-spine";
import { ArtifactPanel } from "@/components/dashboard/layout/artifact-panel";
import { TrustRail } from "@/components/dashboard/layout/trust-rail";
import { useSurfaceGateway } from "@/lib/atlas5/surface-gateway";

const AGENT_DESCRIPTIONS: Record<string, string> = {
  ATLAS:
    "The user is in ATLAS mode. Focus on building a Five Case Model investment brief with NPV analysis, grounded in corpus evidence. Use set_artifact_block with recipe='brief_five_case'.",
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
  const { state, setState } = useCoAgent<AgentState>({
    name: "my_agent",
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

  // Setup tool rendering and front-end tools
  useChartActions({ state, setState });
  useSearchActions();

  const artifact = state?.artifact_block;
  const spine = state?.decision_spine;
  const hasCharts = (state?.charts?.length ?? 0) > 0;

  return (
    <div
      className={cn("min-h-screen bg-background text-foreground", className)}
    >
      <div className="max-w-6xl mx-auto p-4 grid gap-4">
        {/* Atlas surface controls */}
        <SurfaceSwitcher state={state} setState={setState} />

        {/* Decision Spine */}
        {spine && <DecisionSpineCard spine={spine} />}

        {/* Artifact + Trust rail side by side */}
        {artifact && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <ArtifactPanel artifact={artifact} />
            </div>
            <div className="lg:col-span-1">
              <TrustRail artifact={artifact} />
            </div>
          </div>
        )}

        {/* Secondary: metrics */}
        <PinnedMetrics state={state} setState={setState} />

        {/* Secondary: charts (only shown when agent has populated them) */}
        {hasCharts && <Charts state={state} setState={setState} />}
      </div>
    </div>
  );
}
