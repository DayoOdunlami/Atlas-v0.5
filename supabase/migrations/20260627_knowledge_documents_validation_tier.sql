-- KB validation tiers for promote/retire decisions (see scripts/kb/validation_tier.py)

ALTER TABLE atlas.knowledge_documents
  ADD COLUMN IF NOT EXISTS validation_tier text
    CHECK (validation_tier IN ('T1_anchor', 'T2_embedded', 'T3_thin', 'T4_candidate', 'T0_retired'));

ALTER TABLE atlas.knowledge_documents
  ADD COLUMN IF NOT EXISTS validation_note text;

COMMENT ON COLUMN atlas.knowledge_documents.validation_tier IS
  'KB quality tier for promote/retire review. Search includes T1-T3 approved only.';

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_validation_tier
  ON atlas.knowledge_documents (validation_tier)
  WHERE validation_tier IS NOT NULL;
