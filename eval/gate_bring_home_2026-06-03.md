# Bring-Home Gate — Finish-Line Sprint — 2026-06-03

## Decision

**GO** for demo shell + offline trust gates.  
**CONDITIONAL** for full `eval/demo_script_sprint4b.md` live run — requires secrets below.

| Area | Verdict |
|------|---------|
| `/` assistant-ui + artifact pane | **GO** |
| Offline eval bundle | **GO** (14/14 unit + contract offline) |
| Horsemen routing | **GO** (4/4) |
| LangGraph proxy + thread API | **GO** |
| Live artifact contract (5 canonical) | **BLOCKED** (no API keys / DB in agent env) |
| Full UI journey (Orient → NPV → refine) | **BLOCKED** without `ANTHROPIC_API_KEY` + `POSTGRES_URL` |

---

## Test results

### Repo sync

- `main` @ `bfe6aca` — already latest
- `pnpm install` — OK

### Offline evals

```bash
pnpm eval:sprint5          # 14/14 pass (via scripts/python-bin.mjs)
pnpm eval:horsemen         # 4/4 pass
node scripts/python-bin.mjs eval/test_four_horsemen.py
```

| Suite | Result |
|-------|--------|
| `agents/test_citation_guard.py` | 5/5 |
| `agents/test_turn_intent.py` | 5/5 (clarify NPV, refine key players) |
| `agents/test_artifact_qa.py` | 2/2 |
| `agents/test_falsification.py` | 2/2 |
| `eval/test_artifact_contract_live.py` (offline) | PASS (+ 2 advisory recipe heuristics) |
| `eval/test_four_horsemen.py` | 4/4 |

### Live gate

```bash
node scripts/python-bin.mjs eval/test_artifact_contract_live.py --live
```

**0/5 pass** in this environment — no `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `POSTGRES_URL`, or `.env.local`. `run_atlas` returns empty headlines; corpus falls back to ILIKE keyword search.

### Stack smoke (local)

| Service | Port | Status |
|---------|------|--------|
| Next.js (`pnpm run dev:ui`) | 3005 | 200 `/` |
| LangGraph (`langgraph dev`) | 2024 | 200 `/ok` |
| Proxy `POST /api/lg/threads` | 3005 | 200, thread created |

### UI / structural checks

- SSR HTML on `/` includes `data-testid="artifact-pane"` and `artifact-empty`
- `/lab/langgraph` → 307 redirect to `/`
- `pnpm run build` — **PASS** after Suspense fix on `/atlas5-test`

### Demo script journeys (manual)

| Step | Offline intent | Live E2E |
|------|----------------|----------|
| Orient UK CAT | Recipe `orient` ✅ | Not run (no LLM/DB) |
| Clarify “What is NPV?” | `clarify` ✅ (turn_intent) | Not run |
| Refine “Add key players” | `refine` ✅ (turn_intent) | Not run |

---

## Fixes applied this sprint

1. **Cross-platform Python/npm scripts** — `scripts/python-bin.mjs`; `package.json` `dev`, `dev:agents`, `eval:*` work on Linux/macOS/Windows.
2. **LangGraph dev dependency** — `langgraph-cli[inmem]` added to `agents/requirements.txt` (fixes `langgraph dev` “langgraph-api not installed”).
3. **Build** — `Suspense` wrapper on `/atlas5-test` for `useSearchParams` prerender error.
4. **Docs** — `.env.example` lists `LANGGRAPH_API_URL`, keys; `eval/demo_script_sprint4b.md` setup updated for two-terminal flow.
5. **`pnpm eval:horsemen`** — npm script alias added.

---

## Demo setup (verified commands)

```bash
# Terminal 1
cd agents && source .venv/bin/activate  # or: uv venv .venv && uv pip install -r requirements.txt
langgraph dev --port 2024 --no-browser

# Terminal 2
export LANGGRAPH_API_URL=http://localhost:2024
# copy .env.example → .env.local and fill secrets for live queries
pnpm run dev:ui
```

Open http://localhost:3005/

---

## Secrets required for full demo (not present in cloud agent env)

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Graph LLM turns |
| `OPENAI_API_KEY` | Corpus embeddings (semantic search) |
| `POSTGRES_URL` or `DATABASE_URL` | CPC corpus pgvector |
| `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_KEY` | Optional auth/context |
| `TAVILY_API_KEY` + `ATLAS_EXTERNAL_SCOUT_V1=true` | Weak-signal scout lane |

Run live gate locally after configuring:

```bash
pnpm eval:contract:live
```

---

## Remaining gaps

- Recipe director advisory: weak-signal → `connect` (expected `orient` offline); live gate authoritative per Sprint 4B gate.
- Playwright not in direct devDependencies — install `@playwright/test` for CI browser suite on port 3005.
- `pnpm run dev` on Linux needs agents `.venv` created once (`uv venv` + `uv pip install -r agents/requirements.txt`).
- Full stakeholder demo still needs Dayo env with keys; structural GO does not replace live query smoke on queries 1–2–4.

---

## Stakeholder demo readiness

| Criterion | Ready? |
|-----------|--------|
| `/` loads assistant-ui + artifact pane | Yes |
| Trust gates in CI/offline | Yes |
| LangGraph streaming path wired | Yes (with `LANGGRAPH_API_URL`) |
| Orient / clarify / refine with real corpus + tier | **After secrets** |

**Recommendation:** Proceed with demo using local `.env.local` + two-terminal setup. Run `pnpm eval:contract:live` once before the room; minimum queries Orient + Diagnose + Act per Sprint 4B gate.
