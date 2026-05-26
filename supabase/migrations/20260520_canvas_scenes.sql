-- Atlas 5 — D9: canvas_scenes table
-- Approved by Dayo at Commit 0.5 (Seam decision: atlas.canvas_scenes, NOT atlas.blocks)
--
-- Apply: psql $DATABASE_URL -f supabase/migrations/20260520_canvas_scenes.sql
-- Or via Supabase dashboard SQL editor (schema: atlas)

CREATE TABLE IF NOT EXISTS atlas.canvas_scenes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  text NOT NULL,
  owner_id   uuid,
  scene_json jsonb NOT NULL,
  saved_at   timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast thread lookups (most common query pattern)
CREATE INDEX IF NOT EXISTS canvas_scenes_thread_id_idx
  ON atlas.canvas_scenes (thread_id);

-- Only one scene per thread (upsert on thread_id)
CREATE UNIQUE INDEX IF NOT EXISTS canvas_scenes_thread_id_unique
  ON atlas.canvas_scenes (thread_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION atlas.update_canvas_scenes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS canvas_scenes_updated_at ON atlas.canvas_scenes;
CREATE TRIGGER canvas_scenes_updated_at
  BEFORE UPDATE ON atlas.canvas_scenes
  FOR EACH ROW EXECUTE FUNCTION atlas.update_canvas_scenes_updated_at();

COMMENT ON TABLE atlas.canvas_scenes IS
  'Atlas 5 tldraw canvas scenes. One scene per thread, persisted as JSONB. See canvas_scene.json contract in CLAUDE.md.';
