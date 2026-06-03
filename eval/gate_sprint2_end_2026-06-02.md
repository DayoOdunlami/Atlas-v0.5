# Sprint 2 — Gate Report (end) — 2026-06-02

**Scope delivered:** Tracks 1–3 and 5; Track 4 (Passport) started — loader wired into Diagnose  
**Baseline:** `eval/baseline_sprint2_start_2026-06-02.md`

---

## Track 1 — Retrieval consistency ✅ GATE PASSED

| Item | Status |
|------|--------|
| `agents/citation_helpers.py` — filter, suggest, fallback | ✅ |
| CPC internal in LLM + verify path | ✅ |
| `search_cpc_internal` error handling per table | ✅ |
| Suggested citations injected into Orient/Connect/Diagnose prompts | ✅ |
| `eval/test_embedding_alignment.py` | ✅ model constant |
| `eval/embedding_alignment.md` | ✅ |
| `agents/test_citation_fallback.py` | **3/3 PASS** |
| `agents/test_data_source_routing.py` | **3/3 PASS** |

**Track 1 gate:** Citation fallback tests green → Track 4 passport loader approved.

---

## Track 2 — Chat slim-down + eval gates ⚠️ PARTIAL

| Item | Status |
|------|--------|
| Chat slim-down in `verify_citations` AIMessage | ✅ headline + `{N} sources · {tier} · see artifact →` |
| Cold Act note in chat when no prior Diagnose | ✅ |
| `eval/test_four_horsemen.py` | **4/4 PASS** |
| `eval/test_parity_smoke.py` (offline) | **5/5 PASS** |
| `npm run eval:tier1` | ⚠️ `vite-tsconfig-paths` added to package.json; `npm install` failed in env — run locally |

---

## Track 3 — Mode-specific UI polish ✅

| Item | Status |
|------|--------|
| Orient: skip duplicate heatmap/evidence when `visual_blocks` present | ✅ |
| Orient: use `artifact.headline` | ✅ |
| Diagnose: gap matrix from `gap_rows` + `routing_gaps` (0 citations OK) | ✅ |
| RecipeView confidence container (`getConfidenceStyles`) | ✅ |

---

## Track 4 — Passport assembly (conditional) ✅ STARTER

| Item | Status |
|------|--------|
| `agents/passport_loader.py` | ✅ |
| Injected into `_build_diagnose_report` | ✅ |
| `passport_id` on artifact when matched | ✅ |

Full Match journey deferred — loader + Diagnose context only.

---

## Track 5 — Escalation actions ✅

| Item | Status |
|------|--------|
| `src/lib/atlas5/escalation.ts` + Zustand store | ✅ |
| ChatPane consumes pending escalation messages | ✅ |
| Diagnose → Act button wired | ✅ `data-testid="diagnose-escalate-act"` |
| Orient → Connect escalation | ✅ |
| Connect → Diagnose escalation | ✅ |
| Session memory (`last_recipe`, `last_headline`, `session_has_diagnose`) | ✅ graph checkpoint |
| Cold Act ceiling (Decision 5) | ✅ max Indicative without prior Diagnose |

---

## Regression tests

| Test | Result |
|------|--------|
| `agents/test_recipe_routing.py` | **57/57 PASS** |
| `agents/test_citation_fallback.py` | **3/3 PASS** |
| `agents/test_data_source_routing.py` | **3/3 PASS** |
| `eval/test_four_horsemen.py` | **4/4 PASS** |
| `eval/test_parity_smoke.py` (offline) | **5/5 PASS** |
| `eval/test_embedding_alignment.py` | **PASS** (live skipped — no DB key in CI shell) |
| `py_compile` graph/citation_helpers/passport_loader | **PASS** |

---

## Live parity smoke (manual — servers required)

After `npm run dev` + LangGraph :2024:

```bash
agents\.venv\Scripts\python.exe eval\test_parity_smoke.py --live
```

Compare CopilotKit `/` vs `/lab/langgraph` for 5 canonical queries — recipe, headline, visual_blocks.length, citations.length.

---

## Still open (Sprint 3)

- `npm install` + restore `npm run eval:tier1` in this environment
- Live dual-path parity checklist (requires running servers)
- LangGraph lab escalation bridge (same store works if lab uses ChatPane pattern)
- Full Passport → Match product journey
- Tier 2 rubric live runs (`eval/tier2_generator.py` mode extensions)

---

## Key files changed

- `agents/citation_helpers.py`, `agents/atlas/graph.py`, `agents/passport_loader.py`
- `agents/mcp_client.py`
- `src/lib/atlas5/escalation.ts`
- `src/components/atlas5/chat-pane.tsx`, `artifact-pane.tsx`
- `src/components/atlas5/recipes/{diagnose,orient,connect}-surface.tsx`
- `eval/test_{four_horsemen,parity_smoke,embedding_alignment}.py`
