# Surface demo recordings — BLOCKED

**Status:** Recording cannot proceed. No video or screenshot artifacts were produced.

**Last attempt:** 2026-06-03 (cloud agent `cursor/demo-recordings-d938`)

## Root cause

**Cursor Cloud Agent Secrets were not injected into this VM.**

- `CLOUD_AGENT_INJECTED_SECRET_NAMES` is empty
- `printenv` shows no `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `POSTGRES_URL`
- `node eval/demo/check-prereqs.mjs` exits **1** with:

```
Missing or placeholder demo prerequisites: ANTHROPIC_API_KEY, OPENAI_API_KEY, POSTGRES_URL
```

## Missing prerequisites

| Variable | Required | Status |
|----------|----------|--------|
| `ANTHROPIC_API_KEY` | Yes — graph LLM turns | **MISSING** (not in Cloud Agent Secrets) |
| `OPENAI_API_KEY` | Yes — CPC corpus semantic search | **MISSING** |
| `POSTGRES_URL` | Yes — CPC corpus (pgvector) | **MISSING** |
| `LANGGRAPH_API_URL` | Yes — `http://localhost:2024` for local LangGraph | OK in `.env.local` template |

Optional (bonus clip only): `TAVILY_API_KEY`, `ATLAS_EXTERNAL_SCOUT_V1=true`, `EXA_API_KEY`, Supabase service key.

## VM readiness (completed)

These steps succeeded without secrets:

| Step | Result |
|------|--------|
| `pnpm install` | OK |
| `cd agents && uv venv .venv && uv pip install -r requirements.txt` | OK |
| `npx playwright install chromium` | OK |
| `langgraph dev --port 2024 --no-browser` | Graphs load (`atlas`, `jarvis`, `cicerone`, `hyve`) |
| `pnpm run demo:record` | **Not run** — blocked by `check-prereqs.mjs` |

## How to unblock

1. In **Cursor → Cloud Agent → Secrets**, add:
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `POSTGRES_URL` (Supabase pooler URL for project `afysgjiczzptubonbuxs`)
2. Re-run this agent (or locally create `.env.local` at repo root — never commit).
3. Verify: `node eval/demo/check-prereqs.mjs` → exit **0**
4. Start stack and record:

```bash
# Terminal A
cd agents && source .venv/bin/activate && langgraph dev --port 2024 --no-browser

# Terminal B
export LANGGRAPH_API_URL=http://localhost:2024
pnpm run dev:ui

# Terminal C (after http://localhost:3005/ shows artifact-pane)
pnpm run demo:record
```

## Do not substitute

Offline eval (`pnpm eval:sprint5`, contract tests without `--live`) is **not** an acceptable replacement for this deliverable.
