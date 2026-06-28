# Atlas v5 — corpus connection policy

## What counts as “connected”

| Tier | Mechanism | Product use |
|------|-----------|-------------|
| **Postgres pooler** | TCP `:6543` + pgvector | Full SQL stats, charts, network graph |
| **HTTPS semantic** | Supabase RPC `search_projects_by_embedding` + OpenAI embed | Verified `atlas.projects` UUID citations |
| **Online-only** | Exa / GovUK after explicit user consent | Web synthesis — **no** corpus UUIDs |

## What we deliberately do **not** use

- **ILIKE keyword search** over project titles/abstracts as a “corpus fallback”. It returns noise or zero matches on natural-language questions and implies evidence that is not semantically validated.
- **Empty orient canvases** (`0 MATCH(ES)`, Speculative tier, no citations). Withheld — user gets a clear chat offer instead.

## Graceful degradation (helpful)

1. **Postgres down, semantic HTTPS hits** → REST evidence path: real UUIDs, honest “no aggregate charts” note.
2. **All corpus tiers fail** → `online_only_pending`: explain, ask **“yes, continue online”**, canvas stays empty.
3. **Corpus reachable, zero verified matches** → `insufficient_evidence`: same consent path — do not fake orient.

## Harmful (removed)

- Painting canvas after ILIKE returned nothing.
- Verdict copy that sounds like orient when `project_count = 0`.
- Tests that only check Python `run_turn_response` without CopilotKit deploy path (see eval gap — deploy smoke planned separately).

## Environment

- **Railway agent:** `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `OPENAI_API_KEY` (embeddings), `EXA_API_KEY` (web).
- **Vercel:** `PYTHON_AGENTS_URL` → Railway service URL.
