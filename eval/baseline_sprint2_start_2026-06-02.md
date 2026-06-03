# Sprint 2 — Baseline (start) — 2026-06-02

**Scope:** Tracks 1–3 and 5; Track 4 conditional on Track 1 gate  
**Primary path:** CopilotKit `/` + AG-UI :8000  
**Parity path:** LangGraph lab `/lab/langgraph` :2024 (smoke)

---

## Pre-sprint state (from Phase 0 baseline)

| Item | Status |
|------|--------|
| Recipe routing (`agents/test_recipe_routing.py`) | **57/57 PASS** |
| Gap A — outward mode dispatch | FIXED |
| Gap F starter — `search_cpc_internal` | STARTED |
| Gap E — embedding alignment | OPEN |
| Chat slim-down | NOT DONE |
| Escalation buttons | STUB (`console.info`) |
| `npm run eval:tier1` | FAIL — missing `vite-tsconfig-paths` |
| Horsemen / parity smoke scripts | NOT PRESENT |

---

## Tests run at sprint start

| Test | Result | Notes |
|------|--------|-------|
| `agents/test_recipe_routing.py` | **57/57 PASS** | Routing baseline green |
| `npm run eval:tier1` | **FAIL** | Missing devDep `vite-tsconfig-paths` |
| Live parity smoke (:8000 / :2024) | **SKIP** | Servers not assumed running |

---

## Known runtime issues (manual observation)

1. Diagnose / Orient on CopilotKit sometimes return **0 LLM citations** despite non-empty search results
2. Diagnose prompt restricts citations to `project`/`live_call` only — drops `cpc_internal` hits
3. Chat streams full `decision_text` + analysis — competes with artifact pane
4. Escalation actions are console stubs — no turn-2 workspace flow

---

## Sprint 2 execution plan

1. **Track 1** — citation fallback, cpc_internal verify, prompt fixes, embedding audit script
2. **Track 2** — chat slim-down, install vite-tsconfig-paths, Horsemen + parity smoke
3. **Track 3** — Orient/Diagnose UI parity, confidence container on RecipeView
4. **Track 5** — escalation store + wired buttons, session memory, cold Act ceiling
5. **Track 4** — only if Track 1 gate passes (citation fallback tests green)
