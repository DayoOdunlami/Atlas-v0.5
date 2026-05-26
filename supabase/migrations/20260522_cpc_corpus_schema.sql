-- CPC Capability Corpus v0.1 — Schema migration
-- Apply: psql "$DATABASE_URL" -f supabase/migrations/20260522_cpc_corpus_schema.sql
-- Idempotent: safe to re-run. Uses CREATE … IF NOT EXISTS throughout.

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 2. atlas.evidence_containers — primary container for CPC project/capability records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atlas.evidence_containers (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                       TEXT        NOT NULL,
  container_type             TEXT        NOT NULL CHECK (container_type IN ('project_evidence','project_evidence_profile','capability_profile','evidence_set')),
  holder_type                TEXT,
  holder_id                  TEXT,
  description                TEXT,
  tags                       TEXT[]      DEFAULT '{}',
  is_active                  BOOLEAN     DEFAULT true,
  external_id                TEXT,
  corpus_tag                 TEXT        DEFAULT 'cpc_v0_1',
  source_confidence          TEXT,
  dynamics_url               TEXT,
  business_unit              TEXT,
  customer_or_funder         TEXT,
  delivery_status            TEXT,
  delivery_status_normalised TEXT,
  mode_or_focus_area         TEXT,
  cpc_role                   TEXT,
  start_date                 DATE,
  end_date                   DATE,
  budget_gbp                 NUMERIC,
  source_files               TEXT,
  code_type                  TEXT,
  parent_profile_id          UUID        REFERENCES atlas.evidence_containers(id),
  metadata                   JSONB       DEFAULT '{}'::jsonb,
  embedding                  vector(1536),
  created_at                 TIMESTAMPTZ DEFAULT now(),
  updated_at                 TIMESTAMPTZ DEFAULT now()
);

-- 3. Upgrade safety — add columns if table existed without them
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS holder_type                TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS holder_id                  TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS description                TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS tags                       TEXT[]      DEFAULT '{}';
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS is_active                  BOOLEAN     DEFAULT true;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS external_id                TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS corpus_tag                 TEXT        DEFAULT 'cpc_v0_1';
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS source_confidence          TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS dynamics_url               TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS business_unit              TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS customer_or_funder         TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS delivery_status            TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS delivery_status_normalised TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS mode_or_focus_area         TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS cpc_role                   TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS start_date                 DATE;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS end_date                   DATE;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS budget_gbp                 NUMERIC;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS source_files               TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS code_type                  TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS parent_profile_id          UUID        REFERENCES atlas.evidence_containers(id);
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS metadata                   JSONB       DEFAULT '{}'::jsonb;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS embedding                  vector(1536);
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS created_at                 TIMESTAMPTZ DEFAULT now();
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS updated_at                 TIMESTAMPTZ DEFAULT now();

COMMENT ON TABLE atlas.evidence_containers IS
  'CPC Capability Corpus v0.1 — top-level container for project evidence records and capability profiles. Each row represents one CPC project or organisational capability entry.';

-- ---------------------------------------------------------------------------
-- 4. atlas.claims — atomic capability/evidence claims extracted from containers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atlas.claims (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_role        TEXT        NOT NULL DEFAULT 'asserts',
  claim_domain      TEXT,
  claim_level       INTEGER     DEFAULT 1,
  claim_text        TEXT        NOT NULL,
  conditions        TEXT,
  confidence_tier   TEXT        CHECK (confidence_tier IN ('verified','self_reported','ai_inferred','pending_review')),
  confidence_reason TEXT,
  source_label      TEXT,
  source_excerpt    TEXT,
  entity_type       TEXT,
  entity_id         TEXT,
  source            TEXT        DEFAULT 'corpus_ingest',
  review_status     TEXT        DEFAULT 'pending',
  freshness_status  TEXT        DEFAULT 'current',
  corpus_tag        TEXT        DEFAULT 'cpc_v0_1',
  claim_subtype     TEXT,
  metadata          JSONB       DEFAULT '{}'::jsonb,
  embedding         vector(1536),
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- 5. Upgrade safety — add columns if atlas.claims existed without them
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS claim_role        TEXT        DEFAULT 'asserts';
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS claim_domain      TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS claim_level       INTEGER     DEFAULT 1;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS conditions        TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS confidence_tier   TEXT        CHECK (confidence_tier IN ('verified','self_reported','ai_inferred','pending_review'));
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS confidence_reason TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS source_label      TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS source_excerpt    TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS entity_type       TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS entity_id         TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS source            TEXT        DEFAULT 'corpus_ingest';
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS review_status     TEXT        DEFAULT 'pending';
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS freshness_status  TEXT        DEFAULT 'current';
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS corpus_tag        TEXT        DEFAULT 'cpc_v0_1';
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS claim_subtype     TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS metadata          JSONB       DEFAULT '{}'::jsonb;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS embedding         vector(1536);
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS created_at        TIMESTAMPTZ DEFAULT now();

COMMENT ON TABLE atlas.claims IS
  'CPC Capability Corpus v0.1 — atomic claims extracted from evidence containers. Each row asserts a single verifiable fact about CPC capability, delivery, or outcome, with a confidence tier and source reference.';

-- ---------------------------------------------------------------------------
-- 6. atlas.profile_claims — join table linking containers to their claims
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atlas.profile_claims (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID        NOT NULL REFERENCES atlas.evidence_containers(id) ON DELETE CASCADE,
  claim_id     UUID        NOT NULL REFERENCES atlas.claims(id) ON DELETE CASCADE,
  added_by     TEXT        DEFAULT 'corpus_ingest',
  added_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(container_id, claim_id)
);

-- 7. Upgrade safety — add columns if atlas.profile_claims existed without them
-- NOTE: container_id/claim_id are NOT NULL in the CREATE TABLE definition above.
--       ADD COLUMN IF NOT EXISTS drops NOT NULL here to avoid failures on tables
--       with existing rows — the constraint is enforced at creation time.
ALTER TABLE atlas.profile_claims ADD COLUMN IF NOT EXISTS container_id UUID        REFERENCES atlas.evidence_containers(id) ON DELETE CASCADE;
ALTER TABLE atlas.profile_claims ADD COLUMN IF NOT EXISTS claim_id     UUID        REFERENCES atlas.claims(id) ON DELETE CASCADE;
ALTER TABLE atlas.profile_claims ADD COLUMN IF NOT EXISTS added_by     TEXT        DEFAULT 'corpus_ingest';
ALTER TABLE atlas.profile_claims ADD COLUMN IF NOT EXISTS added_at     TIMESTAMPTZ DEFAULT now();

COMMENT ON TABLE atlas.profile_claims IS
  'CPC Capability Corpus v0.1 — many-to-many join between evidence_containers and claims. Allows a single claim to be shared across multiple container records.';

-- ---------------------------------------------------------------------------
-- 8. atlas.claim_evidence_links — source-document provenance for each claim
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atlas.claim_evidence_links (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id          UUID        NOT NULL REFERENCES atlas.claims(id) ON DELETE CASCADE,
  external_claim_id TEXT,
  document_id       UUID,
  document_table    TEXT        DEFAULT 'external',
  source_file       TEXT        NOT NULL,
  source_excerpt    TEXT,
  evidence_type     TEXT,
  evidence_quality  TEXT,
  source_confidence TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- 9. Upgrade safety — add columns if atlas.claim_evidence_links existed without them
-- NOTE: claim_id is NOT NULL in CREATE TABLE; drops NOT NULL here for upgrade safety.
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS claim_id          UUID        REFERENCES atlas.claims(id) ON DELETE CASCADE;
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS external_claim_id TEXT;
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS document_id       UUID;
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS document_table    TEXT        DEFAULT 'external';
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS source_excerpt    TEXT;
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS evidence_type     TEXT;
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS evidence_quality  TEXT;
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS source_confidence TEXT;
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS notes             TEXT;
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS created_at        TIMESTAMPTZ DEFAULT now();

COMMENT ON TABLE atlas.claim_evidence_links IS
  'CPC Capability Corpus v0.1 — provenance links tying each claim back to a source file or document excerpt. Supports audit trail for confidence tier assignment.';

-- ---------------------------------------------------------------------------
-- 10. Indexes
-- ---------------------------------------------------------------------------

-- evidence_containers
CREATE INDEX IF NOT EXISTS idx_evidence_containers_corpus_tag
  ON atlas.evidence_containers (corpus_tag);

-- Composite unique index scoped to corpus_tag so different corpus ingestions
-- can reuse the same external_id values without colliding.
-- ON CONFLICT (corpus_tag, external_id) WHERE external_id IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_containers_corpus_tag_external_id
  ON atlas.evidence_containers (corpus_tag, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_containers_external_id
  ON atlas.evidence_containers (external_id);

CREATE INDEX IF NOT EXISTS idx_evidence_containers_parent_profile_id
  ON atlas.evidence_containers (parent_profile_id);

-- claims
CREATE INDEX IF NOT EXISTS idx_claims_corpus_tag
  ON atlas.claims (corpus_tag);

CREATE INDEX IF NOT EXISTS idx_claims_entity_type_entity_id
  ON atlas.claims (entity_type, entity_id);

-- claim_evidence_links
CREATE INDEX IF NOT EXISTS idx_claim_evidence_links_claim_id
  ON atlas.claim_evidence_links (claim_id);

CREATE INDEX IF NOT EXISTS idx_claim_evidence_links_external_claim_id
  ON atlas.claim_evidence_links (external_claim_id);

-- profile_claims
CREATE INDEX IF NOT EXISTS idx_profile_claims_container_id
  ON atlas.profile_claims (container_id);

CREATE INDEX IF NOT EXISTS idx_profile_claims_claim_id
  ON atlas.profile_claims (claim_id);
