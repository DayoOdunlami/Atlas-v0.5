-- Seam 5.0b: vector search over HTTPS via PostgREST RPC (port 443 fallback)

CREATE OR REPLACE FUNCTION atlas.search_projects_by_embedding(
  query_embedding vector(1536),
  k int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  lead_org_name text,
  abstract text,
  transport_relevance_score numeric,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = atlas, public
AS $$
  SELECT
    p.id,
    p.title,
    p.lead_org_name,
    p.abstract,
    p.transport_relevance_score,
    (1 - (p.embedding <=> query_embedding))::float AS similarity
  FROM atlas.projects p
  WHERE p.embedding IS NOT NULL
  ORDER BY p.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(k, 1), 50);
$$;

COMMENT ON FUNCTION atlas.search_projects_by_embedding IS
  'Semantic project search for REST/443 transport when Postgres pooler is blocked.';

GRANT EXECUTE ON FUNCTION atlas.search_projects_by_embedding(vector, int) TO service_role;
