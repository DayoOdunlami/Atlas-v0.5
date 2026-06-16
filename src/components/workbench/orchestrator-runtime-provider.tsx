"use client";

/**
 * OrchestratorRuntimeProvider
 *
 * Syncs orchestrator coAgent state into the workbench canvas.
 * CopilotKit context comes from the root CopilotKitProvider (agent=workbench
 * on /workbench and /lab/orchestrator routes) — do not nest a second provider.
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

function useOrchestratorState(
  onRenderModel?: (model: Record<string, unknown>) => void,
) {
  const { state } = useCoAgent<{
    render_model: Record<string, unknown> | null;
    effort: string;
    outcome: string;
    query: string;
  }>({
    name: "workbench",
    initialState: {
      render_model: null,
      effort: "analyze",
      outcome: "orient",
      query: "",
    },
  });

  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!state.render_model || !onRenderModel) return;
    const key = JSON.stringify(state.render_model);
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    onRenderModel(state.render_model);
  }, [state.render_model, onRenderModel]);
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
