# Seam 5.5 — corpus transport fallback on restricted networks

When Postgres pooler (6543) is blocked, corpus search falls back to Supabase REST (443):

1. **Tier 1** — `POSTGRES_URL` + pgvector (production / hotspot)
2. **Tier 2** — `atlas.search_projects_by_embedding` RPC over HTTPS (apply migration `20260611_search_projects_rpc.sql`)
3. **Tier 3** — PostgREST ILIKE keyword search (works without RPC migration)

Required env for REST fallback in `agents/.env`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

Health probe: `GET http://localhost:8000/health` → `corpus.transport` field.

Railway: set both Postgres URL and Supabase keys; Tier 1 preferred when pooler reachable.
