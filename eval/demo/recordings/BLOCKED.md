# Surface demo recordings — BLOCKED

**Status:** Recording cannot proceed. No video or screenshot artifacts were produced.

**Last attempt:** 2026-06-03 (cloud agent, branch `cursor/demo-recordings-99bd`)

## Root cause

**Cursor Cloud Agent Secrets were not injected into this VM.**

- `CLOUD_AGENT_INJECTED_SECRET_NAMES` is unset / empty
- `printenv` shows no `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `POSTGRES_URL`
- `.env.local` was created at repo root (gitignored) with non-secret defaults only; API keys left empty because no secret source was available
- `node eval/demo/check-prereqs.mjs` exits **1** with:

```
Missing or placeholder demo prerequisites: ANTHROPIC_API_KEY, OPENAI_API_KEY, POSTGRES_URL
```

## Missing prerequisites

| Variable | Required | Status |
|----------|----------|--------|
| `ANTHROPIC_API_KEY` | Yes — graph LLM turns | **MISSING** |
| `OPENAI_API_KEY` | Yes — CPC corpus semantic search | **MISSING** |
| `POSTGRES_URL` | Yes — CPC corpus (pgvector), project `afysgjiczzptubonbuxs` | **MISSING** |
| `LANGGRAPH_API_URL` | Yes — `http://localhost:2024` | OK in `.env.local` |
| `NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID` | Yes — `atlas` | OK |
| `PYTHON_AGENTS_URL` | Yes — `http://localhost:8000` | OK |

Optional (bonus clip only): `TAVILY_API_KEY`, `ATLAS_EXTERNAL_SCOUT_V1=true`, `EXA_API_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`.

## VM readiness (verified this run)

| Step | Result |
|------|--------|
| `pnpm install` | OK |
| `uv` installed; `cd agents && uv venv .venv && uv pip install -r requirements.txt` | OK |
| `npx playwright install chromium` | OK |
| `langgraph dev --port 2024 --no-browser` | OK — `{"ok":true}` on port 2024 |
| `LANGGRAPH_API_URL=http://localhost:2024 pnpm run dev:ui` | OK — `http://localhost:3005/` includes `[data-testid="artifact-pane"]` |
| `pnpm run demo:record` | **Blocked** at `check-prereqs.mjs` (exit 1) — Playwright not invoked |

Supabase MCP can reach project `afysgjiczzptubonbuxs` (InnovationAtlas) but does not supply pooler password or LLM API keys for `.env.local`.

## How to unblock

1. In **Cursor → Cloud Agent → Secrets** (repo: DayoOdunlami/Atlas-v0.5), add:
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `POSTGRES_URL` (Supabase pooler URL for `afysgjiczzptubonbuxs`)
2. Re-run this agent on `main` or `cursor/demo-recordings-f417`.
3. Agent writes `.env.local` from injected secrets (never commit).
4. Verify: `node eval/demo/check-prereqs.mjs` → exit **0**
5. Start stack and record:

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
