/**
 * display-messages.ts
 *
 * Shared transform: CopilotKit visibleMessages → DisplayMessage[].
 * Extracted from lab-chat.tsx so the shell and lab panels both use
 * identical logic. Import toDisplayMessages wherever you need it.
 */

import {
  TextMessage,
  MessageRole,
  ActionExecutionMessage,
  AgentStateMessage,
  ResultMessage,
} from "@copilotkit/runtime-client-gql";
import type { useCopilotChat } from "@copilotkit/react-core";
import type { DisplayMessage, ToolCallDisplay, TraceToolCall } from "@/components/lab/types";

export type CpkMessage =
  ReturnType<typeof useCopilotChat>["visibleMessages"][number];

// ---------------------------------------------------------------------------
// Node label map — human-readable names for every known graph node
// ---------------------------------------------------------------------------

export const NODE_LABELS: Record<string, string> = {
  // ATLAS
  extract_query:            "Extracting query intent",
  classify_intent:          "Classifying intent",
  select_recipe_intent:     "Selecting recipe intent",
  search_corpus:            "Searching CPC corpus",
  external_evidence_search: "Searching external evidence",
  build_five_case:          "Building Five Case brief",
  select_visual_recipe:     "Selecting visual recipe",
  verify_citations:         "Verifying citations",
  // JARVIS
  search_projects:          "Searching corpus projects",
  search_live_calls:        "Searching live funding calls",
  retrieve_evidence:        "Retrieving evidence",
  reason_and_cite:          "Reasoning and citing",
  // CICERONE
  evaluate_transfer:        "Evaluating transferability",
  score_transfer:           "Scoring transferability",
  // HYVE
  search_hive:              "Searching HIVE case studies",
  map_transport_modes:      "Mapping transport modes",
};

/** Routing artefacts — never surfaced in CoT. */
export const HIDDEN_NODES = new Set([
  "__start__", "__end__", "_route_after_intent",
  "route_after_intent", "router",
]);

/** Returns true for CopilotKit raw JSON state snapshots (suppress in UI). */
export function isRawStateContent(content: string): boolean {
  const trimmed = content.trim();
  let inner = trimmed;
  if (trimmed.startsWith("```")) {
    inner = trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
  }
  if (!inner.startsWith("{")) return false;
  return (
    inner.includes('"sections"') ||
    inner.includes('"corpus_citations"') ||
    inner.includes('"decision_spine"') ||
    inner.includes('"confidence_tier"') ||
    inner.includes('"artifact_block"') ||
    inner.includes('"five_case_model"') ||
    inner.includes('"evidence_gaps"')
  );
}

// ---------------------------------------------------------------------------
// toDisplayMessages — the main transform
// ---------------------------------------------------------------------------

export function toDisplayMessages(raw: CpkMessage[]): DisplayMessage[] {
  const result: DisplayMessage[] = [];
  let pendingNodes: ToolCallDisplay[] = [];
  let pendingActions: ToolCallDisplay[] = [];

  for (const m of raw) {
    if (m.isAgentStateMessage()) {
      const asm = m as AgentStateMessage;
      const stateObj = (asm as unknown as { state?: Record<string, unknown> }).state;

      // Scan the ENTIRE reasoning_trace — CopilotKit may send one final
      // AgentStateMessage with the full state snapshot (not one per node).
      const traceArr = Array.isArray(stateObj?.reasoning_trace)
        ? (stateObj!.reasoning_trace as Array<Record<string, unknown>>)
        : [];

      for (const traceEntry of traceArr) {
        const node = traceEntry.node as string | undefined;
        if (!node || HIDDEN_NODES.has(node)) continue;

        const existing = pendingNodes.findIndex((n) => n.id === node);
        const step: ToolCallDisplay = {
          id: node,
          name: NODE_LABELS[node] ?? node.replace(/_/g, " "),
          args: "",
          kind: "node",
          trace: {
            thought: traceEntry.thought as string | undefined,
            tool_calls: traceEntry.tool_calls as TraceToolCall[] | undefined,
            status: traceEntry.status as "ok" | "error" | undefined,
          },
        };
        if (existing >= 0) {
          pendingNodes[existing] = step;
        } else {
          pendingNodes.push(step);
        }
      }

      // Handle nodes that fire but write nothing to reasoning_trace yet
      const node = asm.nodeName;
      if (node && !HIDDEN_NODES.has(node)) {
        const alreadyInTrace = pendingNodes.some((n) => n.id === node);
        if (!alreadyInTrace) {
          pendingNodes.push({
            id: node,
            name: NODE_LABELS[node] ?? node.replace(/_/g, " "),
            args: "",
            kind: "node",
            trace: undefined,
          });
        }
      }
    } else if (m.isResultMessage()) {
      const rm = m as ResultMessage;
      const idx = pendingActions.findIndex((a) => a.id === rm.actionExecutionId);
      if (idx >= 0) {
        pendingActions[idx] = {
          ...pendingActions[idx],
          trace: {
            thought: `Result: ${String(rm.result ?? "").slice(0, 200)}`,
            status: "ok",
          },
        };
      }
    } else if (m.isActionExecutionMessage()) {
      const aem = m as ActionExecutionMessage;
      pendingActions.push({
        id: aem.id ?? crypto.randomUUID(),
        name: aem.name ?? "unknown_tool",
        args: JSON.stringify(aem.arguments ?? {}),
        kind: "action",
      });
    } else if (m.isTextMessage()) {
      const tm = m as TextMessage;
      if (tm.role === MessageRole.User) {
        pendingNodes = [];
        pendingActions = [];
        result.push({
          id: tm.id ?? crypto.randomUUID(),
          role: "user",
          content: tm.content ?? "",
        });
      } else if (tm.role === MessageRole.Assistant) {
        const content = tm.content ?? "";
        if (isRawStateContent(content)) continue;
        const allCalls = [...pendingNodes, ...pendingActions];
        result.push({
          id: tm.id ?? crypto.randomUUID(),
          role: "assistant",
          content,
          toolCalls: allCalls.length > 0 ? allCalls : undefined,
        });
        pendingNodes = [];
        pendingActions = [];
      }
    }
  }

  // Streaming sentinel: nodes accumulated but no final TextMessage yet →
  // show in-flight CoT so the user sees progress immediately.
  if (pendingNodes.length > 0 || pendingActions.length > 0) {
    result.push({
      id: "__streaming__",
      role: "assistant",
      content: "",
      toolCalls: [...pendingNodes, ...pendingActions],
    });
  }

  return result;
}
