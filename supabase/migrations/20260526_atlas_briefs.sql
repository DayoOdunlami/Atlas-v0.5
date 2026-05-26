-- atlas.briefs — persisted artifact blocks from Atlas 5 sessions
-- Apply: psql "$DATABASE_URL" -f supabase/migrations/20260526_atlas_briefs.sql
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS atlas.briefs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        TEXT,
  owner_id         UUID,
  agent            TEXT        NOT NULL DEFAULT 'ATLAS',
  lens             TEXT        NOT NULL DEFAULT 'CPC',
  title            TEXT,
  confidence_tier  TEXT,
  artifact_json    JSONB       NOT NULL,
  decision_spine   JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE atlas.briefs ADD COLUMN IF NOT EXISTS thread_id       TEXT;
ALTER TABLE atlas.briefs ADD COLUMN IF NOT EXISTS owner_id        UUID;
ALTER TABLE atlas.briefs ADD COLUMN IF NOT EXISTS agent           TEXT NOT NULL DEFAULT 'ATLAS';
ALTER TABLE atlas.briefs ADD COLUMN IF NOT EXISTS lens            TEXT NOT NULL DEFAULT 'CPC';
ALTER TABLE atlas.briefs ADD COLUMN IF NOT EXISTS title           TEXT;
ALTER TABLE atlas.briefs ADD COLUMN IF NOT EXISTS confidence_tier TEXT;
ALTER TABLE atlas.briefs ADD COLUMN IF NOT EXISTS artifact_json   JSONB;
ALTER TABLE atlas.briefs ADD COLUMN IF NOT EXISTS decision_spine  JSONB;
ALTER TABLE atlas.briefs ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE atlas.briefs ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_briefs_thread_id  ON atlas.briefs (thread_id);
CREATE INDEX IF NOT EXISTS idx_briefs_owner_id   ON atlas.briefs (owner_id);
CREATE INDEX IF NOT EXISTS idx_briefs_created_at ON atlas.briefs (created_at DESC);

COMMENT ON TABLE atlas.briefs IS
  'Atlas 5 — persisted artifact blocks. Each row is a saved brief or evidence artifact from a CopilotKit session.';
