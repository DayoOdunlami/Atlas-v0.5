"use client";

/**
 * WorkbenchAgentBridge
 *
 * Thin inner component that reads the loaded AtlasRenderModel from WorkbenchContext
 * and mounts WorkbenchRuntimeProvider with the correct model_summary.
 *
 * Why a separate component rather than inlining into AtlasWorkbenchPage:
 *   WorkbenchRuntimeProvider needs model_summary from WorkbenchContext, but
 *   WorkbenchProvider (which populates the context) must be an ancestor.
 *   This bridge sits INSIDE WorkbenchProvider and reads the model once it loads.
 *
 * Patch confirmation (M0.9):
 *   When the agent takes the "propose" route it emits a ModelPatchProposal.
 *   handlePatchProposal calls setPendingPatch() which surfaces
 *   PatchConfirmationPanel.  Confirming calls applyPatch() in context.
 *
 * Five Case / economic_analysis (M1.0):
 *   The same flow will carry EconomicCaseBlock ops — no new bridge code needed.
 */

import { useWorkbench } from "@/lib/workbench/workbench-context";
import {
  WorkbenchRuntimeProvider,
  buildModelSummary,
} from "./workbench-runtime-provider";
import type { WorkbenchAgentState } from "@/lib/workbench/workbench-agent-contract";
import type { ModelPatchProposal } from "@/lib/workbench/workbench-agent-contract";
import type { ReactNode } from "react";

interface WorkbenchAgentBridgeProps {
  children: ReactNode;
}

export function WorkbenchAgentBridge({ children }: WorkbenchAgentBridgeProps) {
  const {
    model,
    isLoading,
    setPendingPatch,
    setReasoningSteps,
    setLastRoute,
    setLastCitations,
  } = useWorkbench();

  // Build slim model summary for the agent — empty object while loading.
  // The runtime provider is always mounted so threads persist across loads.
  const modelSummary =
    model && !isLoading ? buildModelSummary(model) : {};

  function handleAgentValues(state: WorkbenchAgentState) {
    // Sync reasoning trace steps into context so ArtifactCanvas can display
    // live progress alongside the chat stream.
    const trace = state?.last_output?.reasoning_trace;
    if (Array.isArray(trace) && trace.length > 0) {
      setReasoningSteps(trace);
    }
    // Track route for mode indicator (M1.4)
    const route = state?.last_output?.route;
    if (route) setLastRoute(route);
    // Sync corpus citations (search/explore routes)
    const cits = state?.last_output?.corpus_citations;
    if (Array.isArray(cits) && cits.length > 0) {
      setLastCitations(cits);
    } else if (route && route !== "search" && route !== "explore") {
      setLastCitations([]); // clear on non-search turns
    }
  }

  function handlePatchProposal(patch: ModelPatchProposal) {
    // Surface the PatchConfirmationPanel — the user reviews the diff and
    // either confirms (applyPatch) or dismisses.
    setPendingPatch(patch);
  }

  return (
    <WorkbenchRuntimeProvider
      modelSummary={modelSummary}
      lens="CPC"
      onAgentValues={handleAgentValues}
      onPatchProposal={handlePatchProposal}
    >
      {children}
    </WorkbenchRuntimeProvider>
  );
}
