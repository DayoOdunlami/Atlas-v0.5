-- Stage 4: Create atlas.search_with_classifications RPC
-- Parallel to existing searchKnowledgeChunks TypeScript path.
-- NOT replacing the live retrieval route on Day 1.
--
-- Signature: atlas.search_with_classifications(
--   entity_types TEXT[],       -- e.g. ARRAY['knowledge_doc']
--   taxonomy_filters JSONB,    -- e.g. '{"cpc_system": ["Rail"], "cpc_theme": ["Decarbonisation"]}'
--   query_embedding VECTOR,    -- 3072-dim for text-embedding-3-large
--   k INT DEFAULT 10           -- top-K to return
-- )
--
-- Logic:
--   - Searches atlas.knowledge_chunks joined to atlas.knowledge_documents
--   - For each taxonomy in taxonomy_filters: AND requires at least one matching
--     classification row (OR within label arrays)
--   - Result ranked by vector cosine similarity (ascending distance = descending similarity)
--   - Returns chunk-level rows with parent document metadata

CREATE OR REPLACE FUNCTION atlas.search_with_classifications(
  entity_types  TEXT[],
  taxonomy_filters JSONB,
  query_embedding  VECTOR,
  k             INT DEFAULT 10
)
RETURNS TABLE (
  document_id   UUID,
  title         TEXT,
  publisher     TEXT,
  published_on  TEXT,
  source_type   TEXT,
  tier          TEXT,
  chunk_index   INT,
  body          TEXT,
  token_count   INT,
  similarity    FLOAT
)
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
  SELECT
    d.id                                              AS document_id,
    d.title,
    d.publisher,
    d.published_on::text,
    d.source_type,
    d.tier,
    c.chunk_index,
    c.body,
    c.token_count,
    (1 - (c.embedding <=> query_embedding))::float   AS similarity
  FROM atlas.knowledge_chunks c
  JOIN atlas.knowledge_documents d ON d.id = c.document_id
  WHERE
    -- Only approved documents
    d.status = 'approved'
    -- Only when knowledge_doc is in the requested entity_types
    AND 'knowledge_doc' = ANY(entity_types)
    -- For EVERY taxonomy key in taxonomy_filters, the document must have
    -- AT LEAST ONE matching classification label (AND across taxonomies,
    -- OR within label arrays for each taxonomy).
    -- Uses "no counter-example" pattern to express universal quantification.
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_each(taxonomy_filters) AS tf(tax_id, label_arr)
      WHERE NOT EXISTS (
        SELECT 1
        FROM atlas.classifications cl
        WHERE
          cl.entity_type = 'knowledge_doc'
          AND cl.entity_id = d.id
          AND cl.taxonomy_id = tf.tax_id
          AND cl.label = ANY(
            ARRAY(SELECT jsonb_array_elements_text(tf.label_arr))
          )
      )
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT k
$$;

COMMENT ON FUNCTION atlas.search_with_classifications IS
  'Classifications-aware vector retrieval (Day 1 backfill). Parallel to '
  'existing searchKnowledgeChunks TypeScript path. Switch-over to this as '
  'the live retrieval route is a follow-up brief after Day 1 validation.';
