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
 * Artifact sync:
 *   onAgentValues receives WorkbenchAgentState from the agent via onValues.
 *   When the agent has confirmed a model_patch, the updated artifact is written
 *   back to WorkbenchContext via setSnapshot (M0.9 — patch confirmation panel).
 *
 * Five Case / economic_analysis:
 *   onPatchProposal will eventually surface an EconomicCaseBlock diff panel.
 *   STAGED M1.0 — no UI wired yet, proposal is logged to console for now.
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
  const { snapshot, isLoading } = useWorkbench();

  // Build slim model summary for the agent — empty object while loading.
  // The runtime provider is always mounted so threads persist across loads.
  const modelSummary =
    snapshot && !isLoading ? buildModelSummary(snapshot) : {};

  function handleAgentValues(state: WorkbenchAgentState) {
    // When agent emits an updated artifact (confirmed model_patch applied on
    // Python side), sync it back to WorkbenchContext here.
    // TODO M0.9: call setSnapshot(state.artifact) when patch confirmation panel done.
    if (state?.reasoning_trace?.length) {
      // reasoning_trace updates are handled by ChatPanel via onValues indirectly
      // through the assistant-ui message stream — no explicit state write needed here.
    }
  }

  function handlePatchProposal(patch: ModelPatchProposal) {
    // STAGED M1.0: Show a confirmation diff panel before applying.
    // For now, log so we can verify the contract fires correctly.
    console.info("[WorkbenchAgentBridge] model_patch proposal received:", {
      rationale: patch.rationale,
      ops: patch.ops?.length ?? 0,
      confidence_tier: patch.confidence_tier,
    });
    // TODO M0.9: dispatch to patch confirmation panel component
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
