"use client";

/**
 * WorkbenchRuntimeProvider
 *
 * assistant-ui runtime scoped to the "workbench" LangGraph graph (port 2024).
 * Replaces the generic MyRuntimeProvider for the /workbench route.
 *
 * Key differences from MyRuntimeProvider:
 *  - Targets the "workbench" graph (not "atlas" or "jarvis")
 *  - Injects model_summary + lens into every run via sendWorkbenchMessage
 *  - onValues callback syncs agent state to WorkbenchContext (artifact + reasoning_trace)
 *
 * Five Case / economic_analysis:
 *  When route = "economic_analysis" the agent's onValues will eventually emit
 *  an EconomicCaseBlock model_patch. The onArtifactPatch prop handles confirmation.
 *  STAGED: not wired until M1.0.
 *
 * Transport: assistant-ui → LangGraph CLI server (NEXT_PUBLIC_LANGGRAPH_API_URL)
 * Default:   http://localhost:2024
 */

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";
import {
  createThread,
  getThreadState,
  getCheckpointId,
  sendWorkbenchMessage,
  listThreads,
  deleteThread,
  updateThreadTitle,
} from "@/lib/chatApi";
import type { LangChainMessage } from "@assistant-ui/react-langgraph";
import type { RemoteThreadListAdapter } from "@assistant-ui/react";
import type { WorkbenchAgentState, ModelPatchProposal } from "@/lib/workbench/workbench-agent-contract";
import type { AtlasRenderModel } from "@/lib/workbench/atlas-render-model";
import { useMemo, useRef, type ReactNode } from "react";

function deriveTitle(messages: LangChainMessage[]): string | null {
  const first = messages.find(
    (m) =>
      (m as { type?: string }).type === "human" ||
      (m as { role?: string }).role === "user",
  );
  if (!first) return null;
  const content = (first as { content?: unknown }).content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? (content as Array<{ text?: string }>).map((c) => c.text ?? "").join(" ")
        : null;
  if (!text) return null;
  return text.length > 60 ? text.slice(0, 57).trimEnd() + "…" : text;
}

interface WorkbenchRuntimeProviderProps {
  children: ReactNode;
  /** Slim model summary injected into every agent run */
  modelSummary: Record<string, unknown>;
  /** Active lens */
  lens?: string;
  /**
   * Called when the agent emits a new artifact or reasoning_trace via onValues.
   * WorkbenchContext uses this to update the artifact canvas.
   */
  onAgentValues?: (state: WorkbenchAgentState) => void;
  /**
   * Called when the agent proposes a model_patch (route = "propose").
   * STAGED: economic_analysis route will also use this in M1.0.
   * The UI should show a confirmation panel before calling applyPatch.
   */
  onPatchProposal?: (patch: ModelPatchProposal) => void;
}

export function WorkbenchRuntimeProvider({
  children,
  modelSummary,
  lens = "CPC",
  onAgentValues,
  onPatchProposal,
}: WorkbenchRuntimeProviderProps) {
  const titledThreads = useRef<Set<string>>(new Set());

  const threadListAdapter = useMemo((): RemoteThreadListAdapter => ({
    list: async () => {
      let threads: Awaited<ReturnType<typeof listThreads>> = [];
      try {
        threads = await listThreads(50);
      } catch {
        return { threads: [] };
      }
      threads.forEach((t) => {
        if (t.metadata?.title) titledThreads.current.add(t.thread_id);
      });
      return {
        threads: threads.map((t) => ({
          status: "regular" as const,
          remoteId: t.thread_id,
          externalId: t.thread_id,
          title: (t.metadata?.title as string | undefined) ?? undefined,
        })),
      };
    },
    initialize: async () => {
      const { thread_id } = await createThread();
      return { remoteId: thread_id, externalId: thread_id };
    },
    rename: async (remoteId, title) => {
      await updateThreadTitle(remoteId, title);
    },
    archive: async () => {},
    unarchive: async () => {},
    delete: async (remoteId) => {
      await deleteThread(remoteId);
    },
    fetch: async (threadId) => {
      let t: Awaited<ReturnType<typeof listThreads>>[number] | undefined;
      try {
        const threads = await listThreads(1);
        t = threads.find((x) => x.thread_id === threadId);
      } catch {}
      return {
        status: "regular" as const,
        remoteId: threadId,
        externalId: threadId,
        title: (t?.metadata?.title as string | undefined) ?? undefined,
      };
    },
    generateTitle: async () =>
      new ReadableStream({ start(c) { c.close(); } }) as never,
  }), []);

  const runtime = useLangGraphRuntime({
    unstable_threadListAdapter: threadListAdapter,
    unstable_allowCancellation: true,

    stream: async function* (messages, { initialize, ...config }) {
      const { externalId } = await initialize();
      if (!externalId) throw new Error("Thread not found");
      yield* sendWorkbenchMessage({
        threadId: externalId,
        messages,
        modelSummary,
        lens,
        config,
      });
      if (!titledThreads.current.has(externalId)) {
        const title = deriveTitle(messages);
        if (title) {
          titledThreads.current.add(externalId);
          updateThreadTitle(externalId, title).catch(() => {});
        }
      }
    },

    load: async (externalId) => {
      const state = await getThreadState(externalId);
      if (onAgentValues && state.values) {
        onAgentValues(state.values as WorkbenchAgentState);
      }
      return {
        messages:
          (state.values as { messages?: LangChainMessage[] }).messages ?? [],
        interrupts: state.tasks[0]?.interrupts ?? [],
      };
    },

    getCheckpointId,

    eventHandlers: {
      onValues: (values: unknown) => {
        const agentState = values as WorkbenchAgentState;
        if (onAgentValues) {
          onAgentValues(agentState);
        }
        // Surface model_patch for confirmation (route = "propose" / future M1.0 economic_analysis)
        if (onPatchProposal && agentState?.last_output?.model_patch) {
          onPatchProposal(agentState.last_output.model_patch as ModelPatchProposal);
        }
      },
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}

/**
 * Build the WorkbenchModelSummary from an AtlasRenderModel.
 * Called by WorkbenchContext before mounting WorkbenchRuntimeProvider.
 */
export function buildModelSummary(
  model: AtlasRenderModel,
): Record<string, unknown> {
  const spine = model.decision_spine;
  const dqn = model.data_quality_notes ?? {};

  const topGaps: string[] = [];
  for (const block of model.blocks) {
    if (block.type === "dimension_gap" && "gaps" in block.content) {
      const gaps = (block.content as { gaps: Array<{ description: string; severity: string }> }).gaps ?? [];
      gaps
        .filter((g) => g.severity === "high" || g.severity === "significant")
        .slice(0, 3)
        .forEach((g) => topGaps.push(g.description));
    }
  }

  let evidenceCounts = { verified: 0, partial: 0, missing: 0, total: 0 };
  for (const block of model.blocks) {
    if (block.type === "evidence_state_summary" && "counts" in block.content) {
      evidenceCounts = (block.content as { counts: typeof evidenceCounts }).counts;
    }
  }

  return {
    artifact_id: model.artifact_id,
    match_id: model.source_object?.id ?? "",
    canonical_question_id: model.canonical_question_id,
    source_label: model.source_object?.label ?? "Unknown",
    target_label: model.target_object?.label ?? "Unknown",
    recommendation: spine?.recommendation ?? "",
    confidence_tier: spine?.confidence_tier ?? "Speculative",
    confidence_cap_reason: spine?.confidence_cap_reason ?? null,
    top_gaps: topGaps,
    evidence_counts: evidenceCounts,
    data_quality_notes: Object.keys(dqn).length > 0 ? dqn : undefined,
  };
}
