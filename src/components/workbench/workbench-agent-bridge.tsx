"use client";

/**
 * WorkbenchAgentBridge
 *
 * Routes to OrchestratorRuntimeProvider (ADR-0001) when
 * NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1=true, otherwise legacy assistant-ui path.
 */

import { useWorkbench } from "@/lib/workbench/workbench-context";
import {
  WorkbenchRuntimeProvider,
  buildModelSummary,
} from "./workbench-runtime-provider";
import { OrchestratorRuntimeProvider } from "./orchestrator-runtime-provider";
import { orchestratorToAtlasRenderModel } from "@/lib/workbench/orchestrator-adapter";
import { parsePresentationPlan } from "@/lib/workbench/presentation-plan";
import type { WorkbenchAgentState } from "@/lib/workbench/workbench-agent-contract";
import type { ModelPatchProposal } from "@/lib/workbench/workbench-agent-contract";
import { extractAgentOutput } from "@/lib/workbench/extract-agent-output";
import type { ReactNode } from "react";
import { useRef, useCallback } from "react";
import { toast } from "sonner";

const ORCHESTRATOR_V1 =
  process.env.NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1 === "true";

interface WorkbenchAgentBridgeProps {
  children: ReactNode;
  /** D4.5 — force legacy assistant-ui path even when orchestrator flag is on */
  forceLegacy?: boolean;
}

export function WorkbenchAgentBridge({ children, forceLegacy = false }: WorkbenchAgentBridgeProps) {
  const {
    model,
    isLoading,
    proposePatch,
    undo,
    setReasoningSteps,
    setLastRoute,
    setLastCitations,
    setLiveModelFromOrchestrator,
    setRenderMode,
    setDocumentSections,
    setPresentationPlan,
  } = useWorkbench();

  const handleOrchestratorModel = useCallback(
    (raw: Record<string, unknown>) => {
      const mode = (raw.render_mode as string) ?? "blocks";
      if (mode === "document" || mode === "chart" || mode === "blocks") {
        setRenderMode(mode);
      }
      const sections = (raw.sections as Record<string, string>) ?? {};
      if (Object.keys(sections).length > 0) {
        setDocumentSections(sections);
      }

      setPresentationPlan(parsePresentationPlan(raw.presentation_plan));

      if (!raw.render_blocks && !raw.blocks_data && mode !== "document") return;

      const adapted = orchestratorToAtlasRenderModel(raw);
      setLiveModelFromOrchestrator(adapted);
      setLastRoute(String(raw.outcome ?? "diagnose"));
      const cits = raw.corpus_citations;
      if (Array.isArray(cits) && cits.length > 0) {
        setLastCitations(
          cits.map((c: Record<string, unknown>) => ({
            id: String(c.id ?? ""),
            title: String(c.title ?? ""),
            organisation: String(c.organisation ?? ""),
            score: typeof c.score === "number" ? c.score : undefined,
          })),
        );
      }
      const steps = raw.reasoning_steps;
      if (Array.isArray(steps) && steps.length > 0) {
        setReasoningSteps(
          steps.map((s: Record<string, unknown>) => ({
            label: String(s.label ?? ""),
            detail: s.detail ? String(s.detail) : undefined,
            status: (s.status as "pending" | "active" | "complete" | "error") ?? "complete",
          })),
        );
      } else {
        setReasoningSteps([
          {
            label: "Value translation complete",
            detail: String(raw.headline ?? ""),
            status: "complete",
          },
        ]);
      }
    },
    [
      setLiveModelFromOrchestrator,
      setLastRoute,
      setLastCitations,
      setReasoningSteps,
      setRenderMode,
      setDocumentSections,
      setPresentationPlan,
    ],
  );

  if (ORCHESTRATOR_V1 && !forceLegacy) {
    return (
      <OrchestratorRuntimeProvider onRenderModel={handleOrchestratorModel}>
        {children}
      </OrchestratorRuntimeProvider>
    );
  }

  return (
    <LegacyWorkbenchBridge
      model={model}
      isLoading={isLoading}
      proposePatch={proposePatch}
      undo={undo}
      setReasoningSteps={setReasoningSteps}
      setLastRoute={setLastRoute}
      setLastCitations={setLastCitations}
    >
      {children}
    </LegacyWorkbenchBridge>
  );
}

interface LegacyProps {
  children: ReactNode;
  model: ReturnType<typeof useWorkbench>["model"];
  isLoading: boolean;
  proposePatch: ReturnType<typeof useWorkbench>["proposePatch"];
  undo: ReturnType<typeof useWorkbench>["undo"];
  setReasoningSteps: ReturnType<typeof useWorkbench>["setReasoningSteps"];
  setLastRoute: ReturnType<typeof useWorkbench>["setLastRoute"];
  setLastCitations: ReturnType<typeof useWorkbench>["setLastCitations"];
}

function LegacyWorkbenchBridge({
  children,
  model,
  isLoading,
  proposePatch,
  undo,
  setReasoningSteps,
  setLastRoute,
  setLastCitations,
}: LegacyProps) {
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
