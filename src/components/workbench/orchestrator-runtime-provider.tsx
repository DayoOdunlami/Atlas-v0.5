"use client";

/**
 * OrchestratorRuntimeProvider
 *
 * Syncs orchestrator coAgent state into the workbench canvas.
 * Bidirectional: pushes artifact_summary back to Python on each canvas update.
 */

import { useCoAgent } from "@copilotkit/react-core";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

interface OrchestratorRuntimeProviderProps {
  children: ReactNode;
  onRenderModel?: (model: Record<string, unknown>) => void;
}

export function OrchestratorRuntimeProvider({
  children,
  onRenderModel,
}: OrchestratorRuntimeProviderProps) {
  return (
    <OrchestratorStateSync onRenderModel={onRenderModel}>
      {children}
    </OrchestratorStateSync>
  );
}

interface OrchestratorStateSyncProps {
  children: ReactNode;
  onRenderModel?: (model: Record<string, unknown>) => void;
}

function OrchestratorStateSync({
  children,
  onRenderModel,
}: OrchestratorStateSyncProps) {
  useOrchestratorState(onRenderModel);
  return <>{children}</>;
}

function buildArtifactSummary(model: Record<string, unknown>) {
  const blocksData = (model.blocks_data as Record<string, unknown>) ?? {};
  const blockIds =
    (model.blocks as string[] | undefined) ?? Object.keys(blocksData);
  const esBlock = blocksData.executive_summary as Record<string, unknown> | undefined;
  const dsBlock = blocksData.decision_spine as Record<string, unknown> | undefined;
  const es =
    (model.executive_summary as string | undefined) ??
    (esBlock?.summary as string | undefined) ??
    (dsBlock?.summary as string | undefined) ??
    (model.insight_card as string | undefined) ??
    "";
  return {
    headline: (model.headline as string) ?? "",
    outcome: (model.outcome as string) ?? "",
    confidence_tier: (model.confidence_tier as string) ?? "",
    is_demo_comparison: Boolean(model.is_demo_comparison),
    executive_summary: es.slice(0, 600),
    block_ids: blockIds.slice(0, 16),
    citation_count: Array.isArray(model.corpus_citations)
      ? model.corpus_citations.length
      : 0,
    artifact_id:
      (model.artifact_id as string) ??
      (model.thread_id as string) ??
      "",
  };
}

function renderModelSyncKey(
  model: Record<string, unknown>,
  query: string,
  outcome: string,
): string {
  const headline = String(model.headline ?? "");
  const mode = String(model.outcome ?? outcome);
  const refined = model.refined ? "1" : "0";
  const blocks = Array.isArray(model.blocks)
    ? (model.blocks as string[]).join(",")
    : Object.keys((model.blocks_data as object) ?? {}).join(",");
  const plan = (model.presentation_plan as Record<string, unknown>) ?? {};
  const dominant = String(plan.dominant_visual_id ?? "");
  const ts = String(model.generated_at ?? model.updated_at ?? Date.now());
  return `${query}|${mode}|${refined}|${headline}|${blocks}|${dominant}|${ts}`;
}

function useOrchestratorState(
  onRenderModel?: (model: Record<string, unknown>) => void,
) {
  const { state, setState } = useCoAgent<{
    render_model: Record<string, unknown> | null;
    effort: string;
    outcome: string;
    query: string;
    artifact_summary?: Record<string, unknown>;
  }>({
    name: "workbench",
    initialState: {
      render_model: null,
      effort: "analyze",
      outcome: "orient",
      query: "",
      artifact_summary: {},
    },
  });

  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!state.render_model || !onRenderModel) return;
    const key = renderModelSyncKey(
      state.render_model,
      state.query ?? "",
      state.outcome ?? "",
    );
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    onRenderModel(state.render_model);

    const summary = buildArtifactSummary(state.render_model);
    setState((prev) => ({
      ...prev,
      artifact_summary: summary,
      outcome:
        (state.render_model?.outcome as string | undefined) ??
        prev.outcome,
    }));
  }, [state.render_model, state.query, state.outcome, onRenderModel, setState]);
}

export interface GateInterruptPayload {
  type: "gate";
  question: string;
  research_plan: string[];
  effort: string;
  outcome: string;
}

interface OrchestratorGateCardProps {
  payload: GateInterruptPayload;
  onConfirm: () => void;
  onRefine: (message: string) => void;
  onDecline: () => void;
}

export function OrchestratorGateCard({
  payload,
  onConfirm,
  onRefine,
  onDecline,
}: OrchestratorGateCardProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3 text-sm">
      <p className="font-medium text-amber-900">{payload.question}</p>
      {payload.research_plan.length > 0 && (
        <ul className="list-disc pl-4 space-y-1 text-amber-800">
          {payload.research_plan.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onConfirm}
          className="px-3 py-1.5 rounded bg-amber-600 text-white text-xs font-medium hover:bg-amber-700"
        >
          Go ahead
        </button>
        <button
          onClick={() => onRefine("actually")}
          className="px-3 py-1.5 rounded border border-amber-400 text-amber-800 text-xs hover:bg-amber-100"
        >
          Refine
        </button>
        <button
          onClick={onDecline}
          className="px-3 py-1.5 rounded text-amber-700 text-xs hover:underline"
        >
          Skip deep research
        </button>
      </div>
    </div>
  );
}
