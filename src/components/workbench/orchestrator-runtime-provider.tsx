"use client";

/**
 * OrchestratorRuntimeProvider
 *
 * CopilotKit runtime for the Atlas 5 orchestrator (ADR-0001).
 * Replaces WorkbenchRuntimeProvider when NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1=true.
 *
 * Architecture:
 *   Browser (React / CopilotKit)
 *     ↕ AG-UI event stream
 *   Next.js /api/copilotkit  (CopilotKit runtime + HttpAgent → /workbench)
 *     ↕ HTTP to FastAPI :8000/workbench
 *   agents/orchestrator/graph.py
 *
 * Key CopilotKit hooks used
 * -------------------------
 *   useCoAgent           — read/write orchestrator state (render_model, effort, outcome)
 *   useLangGraphInterrupt — handle HITL gate interrupt (deep research confirmation)
 *   useCopilotChatSuggestions — optional: surface quick-action suggestions
 *
 * Gate interrupt contract
 * -----------------------
 * When the orchestrator fires interrupt({ type: "gate", question, research_plan, ... })
 * useLangGraphInterrupt receives the payload and OrchestratorGateCard renders it.
 * The user can confirm / refine / decline; the response is sent back via resumeInterrupt.
 */

import { CopilotKit } from "@copilotkit/react-core";
import type { ReactNode } from "react";

interface OrchestratorRuntimeProviderProps {
  children: ReactNode;
  /**
   * Called when the orchestrator emits a verified render_model via coAgent state.
   * The workbench canvas reads this to update the artifact display.
   */
  onRenderModel?: (model: Record<string, unknown>) => void;
}

/**
 * Wraps the workbench page in a CopilotKit provider pointing to the
 * Next.js /api/copilotkit route, which forwards to the orchestrator
 * graph at /workbench via HttpAgent.
 *
 * Usage:
 *   <OrchestratorRuntimeProvider onRenderModel={handleModel}>
 *     <WorkbenchPage />
 *   </OrchestratorRuntimeProvider>
 */
export function OrchestratorRuntimeProvider({
  children,
  onRenderModel,
}: OrchestratorRuntimeProviderProps) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent="workbench"
    >
      <OrchestratorStateSync onRenderModel={onRenderModel}>
        {children}
      </OrchestratorStateSync>
    </CopilotKit>
  );
}

// ---------------------------------------------------------------------------
// OrchestratorStateSync — reads coAgent state and surfaces render_model
// ---------------------------------------------------------------------------

interface OrchestratorStateSyncProps {
  children: ReactNode;
  onRenderModel?: (model: Record<string, unknown>) => void;
}

function OrchestratorStateSync({
  children,
  onRenderModel,
}: OrchestratorStateSyncProps) {
  // Note: useCoAgent and useLangGraphInterrupt are imported lazily below
  // to keep this file compilable even when CopilotKit hooks are not yet
  // wired into a test environment.
  useOrchestratorState(onRenderModel);
  return <>{children}</>;
}

function useOrchestratorState(
  onRenderModel?: (model: Record<string, unknown>) => void,
) {
  const { useCoAgent } = require("@copilotkit/react-core");

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

  // Sync render_model to parent callback whenever it changes
  if (state.render_model && onRenderModel) {
    onRenderModel(state.render_model);
  }
}

// ---------------------------------------------------------------------------
// OrchestratorGateCard — HITL confirmation UI for deep-research gate
// ---------------------------------------------------------------------------
// Exported for use in WorkbenchChat or as a standalone overlay.

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
