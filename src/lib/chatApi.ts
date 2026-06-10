import { type ThreadState, Client } from "@langchain/langgraph-sdk";
import type {
  LangChainMessage,
  LangGraphMessagesEvent,
  LangGraphSendMessageConfig,
} from "@assistant-ui/react-langgraph";

const createClient = () => {
  const apiUrl =
    process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ||
    new URL("/api/lg", window.location.href).href;
  return new Client({ apiUrl });
};

export const createThread = async () => {
  const client = createClient();
  return client.threads.create();
};

export const getThreadState = async (
  threadId: string,
): Promise<ThreadState<Record<string, unknown>>> => {
  const client = createClient();
  return client.threads.getState(threadId);
};

const matchesParentMessages = (
  stateMessages: LangChainMessage[] | undefined,
  parentMessages: LangChainMessage[],
) => {
  if (!stateMessages || stateMessages.length !== parentMessages.length) return false;
  const hasStableIds =
    parentMessages.every((m) => typeof m.id === "string") &&
    stateMessages.every((m) => typeof m.id === "string");
  if (!hasStableIds) return false;
  return parentMessages.every((m, i) => m.id === stateMessages[i]?.id);
};

export const getCheckpointId = async (
  threadId: string,
  parentMessages: LangChainMessage[],
): Promise<string | null> => {
  const client = createClient();
  const history = await client.threads.getHistory(threadId);
  for (const state of history) {
    const stateMessages = (state.values as { messages?: LangChainMessage[] }).messages;
    if (matchesParentMessages(stateMessages, parentMessages)) {
      return state.checkpoint.checkpoint_id ?? null;
    }
  }
  return null;
};

export const listThreads = async (limit = 50): Promise<
  Array<{ thread_id: string; metadata?: Record<string, unknown>; created_at?: string }>
> => {
  const client = createClient();
  const threads = await client.threads.search({ limit, sortBy: "created_at", sortOrder: "desc" });
  return threads as Array<{ thread_id: string; metadata?: Record<string, unknown>; created_at?: string }>;
};

export const deleteThread = async (threadId: string): Promise<void> => {
  const client = createClient();
  await client.threads.delete(threadId);
};

export const updateThreadTitle = async (threadId: string, title: string): Promise<void> => {
  const client = createClient();
  await client.threads.update(threadId, { metadata: { title } });
};

export const sendMessage = (params: {
  threadId: string;
  messages: LangChainMessage[];
  config?: LangGraphSendMessageConfig;
}): AsyncGenerator<LangGraphMessagesEvent<LangChainMessage>> => {
  const client = createClient();
  const { checkpointId, ...restConfig } = params.config ?? {};

  return client.runs.stream(
    params.threadId,
    process.env.NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID ?? "atlas",
    {
      input: params.messages.length > 0 ? { messages: params.messages } : null,
      config: { configurable: { model_name: "anthropic" } },
      streamMode: ["messages-tuple", "values", "custom"],
      ...(checkpointId && { checkpoint_id: checkpointId }),
      ...restConfig,
    },
  ) as AsyncGenerator<LangGraphMessagesEvent<LangChainMessage>>;
};

/**
 * Workbench-specific sendMessage.
 * Targets the "workbench" LangGraph graph and injects model_summary + lens
 * into each run so the agent has context about the current artifact.
 */
export const sendWorkbenchMessage = (params: {
  threadId: string;
  messages: LangChainMessage[];
  modelSummary: Record<string, unknown>;
  lens?: string;
  config?: LangGraphSendMessageConfig;
}): AsyncGenerator<LangGraphMessagesEvent<LangChainMessage>> => {
  const client = createClient();
  const { checkpointId, ...restConfig } = params.config ?? {};

  return client.runs.stream(
    params.threadId,
    "workbench",
    {
      input:
        params.messages.length > 0
          ? {
              messages: params.messages,
              model_summary: params.modelSummary,
              lens: params.lens ?? "CPC",
            }
          : null,
      config: { configurable: { model_name: "anthropic" } },
      streamMode: ["messages-tuple", "values", "custom"],
      ...(checkpointId && { checkpoint_id: checkpointId }),
      ...restConfig,
    },
  ) as AsyncGenerator<LangGraphMessagesEvent<LangChainMessage>>;
};
