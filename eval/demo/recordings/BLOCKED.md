# Surface demo recordings — BLOCKED

**Status:** Recording cannot proceed in this environment. No video or screenshot artifacts were produced.

## Missing prerequisites

The following must be set in **cloud agent Secrets** or **`.env.local`** at the repo root (and loaded by LangGraph via `agents/langgraph.json` → `../.env.local`):

| Variable | Required | Status |
|----------|----------|--------|
| `ANTHROPIC_API_KEY` | Yes — graph LLM turns | **MISSING** |
| `OPENAI_API_KEY` | Yes — CPC corpus semantic search | **MISSING** |
| `POSTGRES_URL` | Yes — CPC corpus (pgvector) | **MISSING** |
| `LANGGRAPH_API_URL` | Yes — must be `http://localhost:2024` when using local LangGraph | **MISSING** |

Also missing: `.env.local` file (not present in workspace).

### How to unblock (dev only — never commit `.env.local`)

Create `/workspace/.env.local` (already gitignored via `.env*`) with real values:

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
POSTGRES_URL=postgresql://...
LANGGRAPH_API_URL=http://localhost:2024
```

Optional: `TAVILY_API_KEY`, `ATLAS_EXTERNAL_SCOUT_V1=true`

Inject the same keys into **Cursor cloud agent Secrets** for remote recording runs.

Verify: `node eval/demo/check-prereqs.mjs`

## Optional (weak-signal bonus only)

| Variable | Purpose |
|----------|---------|
| `TAVILY_API_KEY` | External scout for GPS-denied weak-signals query |
| `ATLAS_EXTERNAL_SCOUT_V1=true` | Enable scout lane |

## Stack (run locally after secrets are set)

```bash
pnpm install
cd agents && uv venv .venv && uv pip install -r requirements.txt

# Terminal 1
cd agents && langgraph dev --port 2024 --no-browser

# Terminal 2
export LANGGRAPH_API_URL=http://localhost:2024
pnpm run dev:ui
```

Open http://localhost:3005/

## Record when unblocked

```bash
pnpm add -D @playwright/test   # if not already installed
npx playwright install chromium
pnpm run demo:record
```

Outputs expected under `eval/demo/recordings/`:

- `01-orient.mp4` + `01-orient.png` … `07-refine-key-players.mp4`
- `INDEX.md` with surface, query, recipe, tier, citation count, pass/fail

Spec: `eval/demo/record-surface-demo.spec.ts`

## Do not substitute

Offline eval suites (`pnpm eval:sprint5`, contract tests without `--live`) are **not** acceptable replacements for this deliverable.
