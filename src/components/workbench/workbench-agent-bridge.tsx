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
 * Patch routing (M2.0 — act-don't-ask):
 *   When the agent takes the "propose" route it emits a ModelPatchProposal.
 *   We hand it to proposePatch() which classifies destructiveness:
 *     - additive (add_block, edits on unpinned blocks) → auto-applies + undo toast
 *     - destructive (edits/removes on PINNED blocks)   → opens hard-confirm panel
 *   The analyst pins a block to claim it as their own; until they do, the
 *   agent acts freely and the toast provides a 6-second window to undo.
 */

import { useWorkbench } from "@/lib/workbench/workbench-context";
import {
  WorkbenchRuntimeProvider,
  buildModelSummary,
} from "./workbench-runtime-provider";
import type { WorkbenchAgentState } from "@/lib/workbench/workbench-agent-contract";
import type { ModelPatchProposal } from "@/lib/workbench/workbench-agent-contract";
import { extractAgentOutput } from "@/lib/workbench/extract-agent-output";
import type { ReactNode } from "react";
import { useRef } from "react";
import { toast } from "sonner";

interface WorkbenchAgentBridgeProps {
  children: ReactNode;
}

export function WorkbenchAgentBridge({ children }: WorkbenchAgentBridgeProps) {
  const {
    model,
    isLoading,
    proposePatch,
    undo,
    setReasoningSteps,
    setLastRoute,
    setLastCitations,
  } = useWorkbench();

  const modelSummary =
    model && !isLoading ? buildModelSummary(model) : {};
  const lastPatchKeyRef = useRef<string | null>(null);

  function handleAgentValues(state: WorkbenchAgentState) {
    const output = extractAgentOutput(state as unknown as Record<string, unknown>);
    const trace = output?.reasoning_trace ?? state?.last_output?.reasoning_trace;
    if (Array.isArray(trace) && trace.length > 0) {
      setReasoningSteps(trace);
    }
    const route = output?.route ?? state?.last_output?.route;
    if (route) setLastRoute(route);
    const cits = output?.corpus_citations ?? state?.last_output?.corpus_citations;
    if (Array.isArray(cits) && cits.length > 0) {
      setLastCitations(cits);
    } else if (route && route !== "search" && route !== "explore") {
      setLastCitations([]);
    }
  }

  function handlePatchProposal(patch: ModelPatchProposal) {
    const patchKey = JSON.stringify(patch.ops);
    if (lastPatchKeyRef.current === patchKey) return;
    lastPatchKeyRef.current = patchKey;

    const tier = proposePatch(patch);
    if (tier === "auto" || tier === "soft") {
      // Patch already applied. Surface an undo affordance.
      // Prefer the agent's narration (past-tense, human) for the description.
      const opCount = patch.ops?.length ?? 0;
      const summary =
        patch.stage_narration ||
        (patch.rationale?.length && patch.rationale.length < 100
          ? patch.rationale
          : `${opCount} change${opCount !== 1 ? "s" : ""} applied`);
      toast.success("Artifact updated", {
        description: summary,
        duration: 6000,
        action: {
          label: "Undo",
          onClick: () => {
            const ok = undo();
            if (ok) toast.message("Reverted last change");
          },
        },
      });
    }
    // tier === "hard":   PatchConfirmationPanel surfaces via pendingPatch.
    // tier === "branch": BranchConfirmChip surfaces via pendingBranch.
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
