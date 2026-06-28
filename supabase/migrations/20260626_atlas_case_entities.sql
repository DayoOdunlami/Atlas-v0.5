-- Atlas v5 — durable case entities (Phase 1 Case File programme)
-- Apply: psql "$DATABASE_URL" -f supabase/migrations/20260626_atlas_case_entities.sql

CREATE TABLE IF NOT EXISTS atlas.case_entities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL,
  title        text NOT NULL DEFAULT 'Untitled case',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  archived_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_case_entities_owner_updated
  ON atlas.case_entities (owner_id, updated_at DESC);

ALTER TABLE atlas.threads
  ADD COLUMN IF NOT EXISTS case_entity_id uuid REFERENCES atlas.case_entities (id);

CREATE INDEX IF NOT EXISTS idx_threads_case_entity
  ON atlas.threads (case_entity_id)
  WHERE case_entity_id IS NOT NULL;

COMMENT ON TABLE atlas.case_entities IS
  'Durable user-owned case files — declared claims attach via atlas.claims entity_type=case_entity.';
