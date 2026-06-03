"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";
import {
  createThread,
  getThreadState,
  getCheckpointId,
  sendMessage,
  listThreads,
  deleteThread,
  updateThreadTitle,
} from "@/lib/chatApi";
import type { LangChainMessage } from "@assistant-ui/react-langgraph";
import type { RemoteThreadListAdapter } from "@assistant-ui/react";
import { useMemo, useRef, type ReactNode } from "react";

function deriveTitle(messages: LangChainMessage[]): string | null {
  const first = messages.find(
    (m) => (m as { type?: string; role?: string }).type === "human" ||
            (m as { type?: string; role?: string }).role === "user"
  );
  if (!first) return null;
  const content = (first as { content?: unknown }).content;
  const text = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? (content as Array<{ text?: string }>).map((c) => c.text ?? "").join(" ")
      : null;
  if (!text) return null;
  return text.length > 60 ? text.slice(0, 57).trimEnd() + "…" : text;
}

interface MyRuntimeProviderProps {
  children: ReactNode;
  onValues?: (values: Record<string, unknown>) => void;
}

export function MyRuntimeProvider({ children, onValues }: MyRuntimeProviderProps) {
  // Track which threads already have a title so we only set it once
  const titledThreads = useRef<Set<string>>(new Set());

  const threadListAdapter = useMemo((): RemoteThreadListAdapter => ({
    list: async () => {
      let threads: Awaited<ReturnType<typeof listThreads>> = [];
      try {
        threads = await listThreads(50);
      } catch {
        // LangGraph CLI server (port 2024) is not running — return empty list
        // rather than crashing the React tree.
        return { threads: [] };
      }
      // Mark threads that already have titles so stream() doesn't overwrite them
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
    archive: async () => { /* not used */ },
    unarchive: async () => { /* not used */ },
    delete: async (remoteId) => {
      await deleteThread(remoteId);
    },
    fetch: async (threadId) => {
      let t: Awaited<ReturnType<typeof listThreads>>[number] | undefined;
      try {
        const threads = await listThreads(1);
        t = threads.find((x) => x.thread_id === threadId);
      } catch {
        // Server unavailable — return a minimal valid thread descriptor
      }
      return {
        status: "regular" as const,
        remoteId: threadId,
        externalId: threadId,
        title: (t?.metadata?.title as string | undefined) ?? undefined,
      };
    },
    // Title generation is handled manually in stream() via updateThreadTitle.
    // Provide a no-op that returns an empty readable stream.
    generateTitle: async () => {
      return new ReadableStream({ start(c) { c.close(); } }) as never;
    },
  }), []);

  const runtime = useLangGraphRuntime({
    unstable_threadListAdapter: threadListAdapter,
    unstable_allowCancellation: true,
    stream: async function* (messages, { initialize, ...config }) {
      const { externalId } = await initialize();
      if (!externalId) throw new Error("Thread not found");
      yield* sendMessage({ threadId: externalId, messages, config });
      // Auto-title the thread from the first human message (fire-and-forget)
      if (!titledThreads.current.has(externalId)) {
        const title = deriveTitle(messages);
        if (title) {
          titledThreads.current.add(externalId);
          updateThreadTitle(externalId, title).catch(() => {/* non-critical */});
        }
      }
    },
    load: async (externalId) => {
      const state = await getThreadState(externalId);
      // Restore artifact panel when switching to an existing thread
      if (onValues && state.values) {
        onValues(state.values as Record<string, unknown>);
      }
      return {
        messages: (state.values as { messages?: LangChainMessage[] }).messages ?? [],
        interrupts: state.tasks[0]?.interrupts ?? [],
      };
    },
    getCheckpointId,
    ...(onValues && {
      eventHandlers: {
        onValues: (values: unknown) => {
          onValues(values as Record<string, unknown>);
        },
      },
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
