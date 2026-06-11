/**
 * Extract workbench agent output from LangGraph thread values.
 *
 * The graph stores output fields at the TOP LEVEL of state (model_patch, route,
 * chat_response). The TypeScript contract also documents last_output — we read
 * both so patch routing works regardless of graph version.
 */

import type { ModelPatchProposal, WorkbenchAgentOutput, WorkbenchRoute } from "./workbench-agent-contract";

export interface RawAgentValues {
  last_output?: Partial<WorkbenchAgentOutput> | null;
  model_patch?: ModelPatchProposal | null;
  route?: WorkbenchRoute | string | null;
  chat_response?: string | null;
  corpus_citations?: WorkbenchAgentOutput["corpus_citations"];
  confidence_tier?: WorkbenchAgentOutput["confidence_tier"];
  reasoning_trace?: WorkbenchAgentOutput["reasoning_trace"];
  error?: string | null;
}

/** Merge top-level state fields with last_output (top-level wins when set). */
export function extractAgentOutput(values: RawAgentValues): WorkbenchAgentOutput | null {
  const lo = values.last_output ?? {};
  const route = (values.route ?? lo.route) as WorkbenchRoute | undefined;
  const model_patch = (values.model_patch ?? lo.model_patch) as ModelPatchProposal | undefined;
  const chat_response = values.chat_response ?? lo.chat_response;

  if (!route && !model_patch && !chat_response) return null;

  return {
    route: route ?? "conversational",
    chat_response: chat_response ?? "",
    model_patch,
    corpus_citations: values.corpus_citations ?? lo.corpus_citations,
    confidence_tier: (values.confidence_tier ?? lo.confidence_tier ?? "Speculative") as WorkbenchAgentOutput["confidence_tier"],
    reasoning_trace: values.reasoning_trace ?? lo.reasoning_trace ?? [],
    error: values.error ?? lo.error ?? null,
  };
}
