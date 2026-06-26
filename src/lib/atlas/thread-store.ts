import "server-only";

import { getAtlasPgPool } from "@/lib/atlas/pg-pool";
import type { LayoutSignals } from "@/lib/atlas/layout-signals";

export type ThreadRow = {
  id: string;
  owner_id: string;
  title: string | null;
  lens: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type TurnRow = {
  id: string;
  thread_id: string;
  turn_index: number;
  user_message: string;
  assistant_reply: string;
  route: string | null;
  outcome_hint: string | null;
  answer_spec: Record<string, unknown> | null;
  answer_dev_meta: Record<string, unknown> | null;
  layout_signals: LayoutSignals | null;
  latency_ms: number | null;
  created_at: string;
};

export type AppendTurnInput = {
  user_message: string;
  assistant_reply: string;
  route?: string | null;
  outcome_hint?: string | null;
  answer_spec?: Record<string, unknown> | null;
  answer_dev_meta?: Record<string, unknown> | null;
  layout_signals?: LayoutSignals | null;
  latency_ms?: number | null;
};

export async function createThread(
  ownerId: string,
  id: string,
  title?: string | null,
  lens = "CPC",
): Promise<ThreadRow> {
  const pool = getAtlasPgPool();
  const result = await pool.query<ThreadRow>(
    `INSERT INTO atlas.threads (id, owner_id, title, lens)
     VALUES ($1::uuid, $2::uuid, $3, $4)
     ON CONFLICT (id) DO UPDATE SET updated_at = now()
     RETURNING id, owner_id, title, lens, created_at, updated_at, archived_at`,
    [id, ownerId, title ?? null, lens],
  );
  return result.rows[0];
}

export async function listThreads(
  ownerId: string,
  limit = 50,
): Promise<ThreadRow[]> {
  const pool = getAtlasPgPool();
  const result = await pool.query<ThreadRow>(
    `SELECT id, owner_id, title, lens, created_at, updated_at, archived_at
     FROM atlas.threads
     WHERE owner_id = $1::uuid AND archived_at IS NULL
     ORDER BY updated_at DESC
     LIMIT $2`,
    [ownerId, limit],
  );
  return result.rows;
}

export async function getThreadForOwner(
  threadId: string,
  ownerId: string,
): Promise<ThreadRow | null> {
  const pool = getAtlasPgPool();
  const result = await pool.query<ThreadRow>(
    `SELECT id, owner_id, title, lens, created_at, updated_at, archived_at
     FROM atlas.threads
     WHERE id = $1::uuid AND owner_id = $2::uuid AND archived_at IS NULL`,
    [threadId, ownerId],
  );
  return result.rows[0] ?? null;
}

export async function updateThreadTitle(
  threadId: string,
  ownerId: string,
  title: string,
): Promise<void> {
  const pool = getAtlasPgPool();
  await pool.query(
    `UPDATE atlas.threads SET title = $3, updated_at = now()
     WHERE id = $1::uuid AND owner_id = $2::uuid`,
    [threadId, ownerId, title],
  );
}

export async function archiveThread(
  threadId: string,
  ownerId: string,
): Promise<void> {
  const pool = getAtlasPgPool();
  await pool.query(
    `UPDATE atlas.threads SET archived_at = now(), updated_at = now()
     WHERE id = $1::uuid AND owner_id = $2::uuid`,
    [threadId, ownerId],
  );
}

export async function listTurns(
  threadId: string,
  ownerId: string,
): Promise<TurnRow[]> {
  const pool = getAtlasPgPool();
  const owned = await getThreadForOwner(threadId, ownerId);
  if (!owned) return [];

  const result = await pool.query<TurnRow>(
    `SELECT id, thread_id, turn_index, user_message, assistant_reply,
            route, outcome_hint, answer_spec, answer_dev_meta, layout_signals,
            latency_ms, created_at
     FROM atlas.turns
     WHERE thread_id = $1::uuid
     ORDER BY turn_index ASC`,
    [threadId],
  );
  return result.rows;
}

export async function appendTurn(
  threadId: string,
  ownerId: string,
  input: AppendTurnInput,
): Promise<TurnRow> {
  const pool = getAtlasPgPool();
  const owned = await getThreadForOwner(threadId, ownerId);
  if (!owned) {
    throw new Error("thread_not_found");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const idxResult = await client.query<{ next_index: number }>(
      `SELECT COALESCE(MAX(turn_index), -1) + 1 AS next_index
       FROM atlas.turns WHERE thread_id = $1::uuid`,
      [threadId],
    );
    const turnIndex = idxResult.rows[0]?.next_index ?? 0;

    const insert = await client.query<TurnRow>(
      `INSERT INTO atlas.turns (
         thread_id, turn_index, user_message, assistant_reply,
         route, outcome_hint, answer_spec, answer_dev_meta,
         layout_signals, latency_ms
       ) VALUES (
         $1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10
       )
       ON CONFLICT (thread_id, turn_index) DO UPDATE SET
         user_message = EXCLUDED.user_message,
         assistant_reply = EXCLUDED.assistant_reply,
         route = EXCLUDED.route,
         outcome_hint = EXCLUDED.outcome_hint,
         answer_spec = EXCLUDED.answer_spec,
         answer_dev_meta = EXCLUDED.answer_dev_meta,
         layout_signals = EXCLUDED.layout_signals,
         latency_ms = EXCLUDED.latency_ms
       RETURNING id, thread_id, turn_index, user_message, assistant_reply,
                 route, outcome_hint, answer_spec, answer_dev_meta,
                 layout_signals, latency_ms, created_at`,
      [
        threadId,
        turnIndex,
        input.user_message,
        input.assistant_reply,
        input.route ?? null,
        input.outcome_hint ?? null,
        input.answer_spec ? JSON.stringify(input.answer_spec) : null,
        input.answer_dev_meta ? JSON.stringify(input.answer_dev_meta) : null,
        input.layout_signals ? JSON.stringify(input.layout_signals) : null,
        input.latency_ms ?? null,
      ],
    );

    await client.query(
      `UPDATE atlas.threads SET updated_at = now() WHERE id = $1::uuid`,
      [threadId],
    );
    await client.query("COMMIT");
    return insert.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Latest substantive answer_spec for canvas rehydrate. */
export async function latestAnswerSpecForThread(
  threadId: string,
  ownerId: string,
): Promise<Record<string, unknown> | null> {
  const pool = getAtlasPgPool();
  const owned = await getThreadForOwner(threadId, ownerId);
  if (!owned) return null;

  const result = await pool.query<{ answer_spec: Record<string, unknown> }>(
    `SELECT answer_spec FROM atlas.turns
     WHERE thread_id = $1::uuid AND answer_spec IS NOT NULL
     ORDER BY turn_index DESC
     LIMIT 1`,
    [threadId],
  );
  return result.rows[0]?.answer_spec ?? null;
}

export { nextTurnIndexFromRows } from "@/lib/atlas/turn-index";
