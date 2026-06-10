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
  const { model, isLoading, setPendingPatch } = useWorkbench();

  // Build slim model summary for the agent — empty object while loading.
  // The runtime provider is always mounted so threads persist across loads.
  const modelSummary =
    model && !isLoading ? buildModelSummary(model) : {};

  function handleAgentValues(state: WorkbenchAgentState) {
    // When agent emits an updated artifact (confirmed model_patch applied on
    // Python side), sync it back to WorkbenchContext here.
    // TODO M0.9: call setModel(state.artifact) when patch confirmation panel done.
    const trace = state?.last_output?.reasoning_trace;
    if (trace?.length) {
      // reasoning_trace updates are handled by ReasoningTrace component via
      // the assistant-ui message stream — no explicit state write needed here yet.
      void trace;
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
