-- Atlas v5 — session threads + turns (chat + canvas persistence + layout_signals)
-- Apply: psql "$DATABASE_URL" -f supabase/migrations/20260622_atlas_v5_threads_turns.sql

CREATE TABLE IF NOT EXISTS atlas.threads (
  id           uuid PRIMARY KEY,
  owner_id     uuid NOT NULL,
  title        text,
  lens         text NOT NULL DEFAULT 'CPC',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  archived_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_threads_owner_updated
  ON atlas.threads (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS atlas.turns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        uuid NOT NULL REFERENCES atlas.threads (id) ON DELETE CASCADE,
  turn_index       int NOT NULL,
  user_message     text NOT NULL DEFAULT '',
  assistant_reply  text NOT NULL DEFAULT '',
  route            text,
  outcome_hint     text,
  answer_spec      jsonb,
  answer_dev_meta  jsonb,
  layout_signals   jsonb,
  latency_ms       int,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, turn_index)
);

CREATE INDEX IF NOT EXISTS idx_turns_thread_index
  ON atlas.turns (thread_id, turn_index ASC);

COMMENT ON TABLE atlas.threads IS
  'Atlas v5 strategist sessions — one row per CopilotKit/LangGraph thread_id.';
COMMENT ON TABLE atlas.turns IS
  'Atlas v5 turns — user message, assistant reply, and answer_spec snapshot per turn.';
