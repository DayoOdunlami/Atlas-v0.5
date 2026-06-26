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

export async function fetchThreadList(): Promise<ThreadSummary[]> {
  const res = await fetch("/api/atlas/threads", { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { threads?: ThreadSummary[] };
  return data.threads ?? [];
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
