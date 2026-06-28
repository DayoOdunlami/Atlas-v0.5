import type { LayoutSignals } from "@/lib/atlas/layout-signals";
import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import type { AtlasDevMeta } from "@/components/atlas/shell/dev-overlay";

export type ThreadSummary = {
  id: string;
  title: string | null;
  lens: string;
  updated_at: string;
  created_at: string;
};

export type TurnPayload = {
  turn_index: number;
  user_message: string;
  assistant_reply: string;
  route: string | null;
  outcome_hint: string | null;
  answer_spec: AnswerSpec | null;
  answer_dev_meta: AtlasDevMeta | null;
  layout_signals: LayoutSignals | null;
  latency_ms: number | null;
};

export type ThreadDetail = ThreadSummary & {
  turns: TurnPayload[];
};

export type ThreadListResponse = {
  threads: ThreadSummary[];
  configured: boolean;
  authorized: boolean;
};

export type SessionHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type PersistStatus = "idle" | "saving" | "saved" | "error" | "unavailable";

export async function fetchThreadList(): Promise<ThreadListResponse> {
  const res = await fetch("/api/atlas/threads", { cache: "no-store" });
  if (!res.ok) {
    return {
      threads: [],
      configured: res.status !== 401,
      authorized: res.status !== 401,
    };
  }
  const data = (await res.json()) as ThreadListResponse;
  return {
    threads: data.threads ?? [],
    configured: data.configured ?? true,
    authorized: data.authorized ?? true,
  };
}

export async function fetchThreadDetail(threadId: string): Promise<ThreadDetail | null> {
  const res = await fetch(`/api/atlas/threads/${threadId}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as ThreadDetail;
}

export async function ensureThread(
  threadId: string,
  title?: string,
): Promise<boolean> {
  const res = await fetch("/api/atlas/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: threadId, title }),
  });
  return res.ok;
}

export async function persistTurn(
  threadId: string,
  payload: {
    user_message: string;
    assistant_reply: string;
    route?: string | null;
    outcome_hint?: string | null;
    answer_spec?: AnswerSpec | null;
    answer_dev_meta?: AtlasDevMeta | null;
    layout_signals?: LayoutSignals | null;
    latency_ms?: number | null;
  },
): Promise<boolean> {
  const res = await fetch(`/api/atlas/threads/${threadId}/turns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

export async function patchThreadTitle(
  threadId: string,
  title: string,
): Promise<boolean> {
  const res = await fetch(`/api/atlas/threads/${threadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  return res.ok;
}

export async function archiveThread(threadId: string): Promise<boolean> {
  const res = await fetch(`/api/atlas/threads/${threadId}`, {
    method: "DELETE",
  });
  return res.ok;
}

export function turnsToSessionHistory(turns: TurnPayload[]): SessionHistoryMessage[] {
  const history: SessionHistoryMessage[] = [];
  for (const turn of turns) {
    if (turn.user_message?.trim()) {
      history.push({ role: "user", content: turn.user_message });
    }
    if (turn.assistant_reply?.trim()) {
      history.push({ role: "assistant", content: turn.assistant_reply });
    }
  }
  return history;
}

export function turnsToChatMessages(turns: TurnPayload[]): SessionHistoryMessage[] {
  return turnsToSessionHistory(turns);
}
