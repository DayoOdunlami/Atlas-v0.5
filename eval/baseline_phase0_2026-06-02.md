# Phase 0 Re-baseline — 2026-06-02

**Status:** Gate passed → Phases 1–4 implemented in this session  
**Prior report:** `eval/audit_report.md` (2026-06-01) — partially stale

---

## Delta vs audit_report.md

| Gap | audit_report (Jun 1) | Current (Jun 2) |
|-----|------------------------|-----------------|
| A — build_five_case ignores target_recipe | FIXED | **Extended** — outward `orient`/`connect`/`diagnose`/`defend`/`act` now dispatch |
| B — CICERONE import | FIXED | Still fixed |
| C — _cap_tier scope | FIXED | Still fixed |
| D — mode prompt paths | FIXED | Still fixed |
| E — embedding mismatch | OPEN | OPEN — not in scope this session |
| F — CPC internal tables | DEFERRED | **Started** — `search_cpc_internal` + conditional retrieval |

---

## New findings (not in Jun 1 audit)

1. **Outward `orient` fell through to Five Case** — classifier returned `orient` but dispatch only handled `cpc_*` aliases. Fixed.
2. **Default outward route was `brief_five_case`** — violated Decision 1 & 4. Now defaults to `orient`; explicit investment language → `act`.
3. **Schema mismatch** — UI expected `Headline`; LLM emitted `Entity Summary`. Added `headline` + `gap_rows` on `artifact_block`.
4. **Duplicate exhibits** — BlocksView + DiagnoseSurface both rendered gap matrix. Composition waterfall fixed in `RecipeView`.
5. **T1-11 false confidence** — string-matching tests passed while runtime routing failed. `agents/test_recipe_routing.py` updated (57/57 pass).

---

## Tests run this session

| Test | Result | Notes |
|------|--------|-------|
| `agents/test_recipe_routing.py` | **57/57 PASS** | Updated for `act`, outward `connect`, Decision 1 |
| `py_compile` graph/mcp/queries | **PASS** | |
| `npm run eval:tier1` | **SKIP** | Missing devDep `vite-tsconfig-paths` |
| `npm run check-types` | Pre-existing errors | No new errors in changed atlas5 files |

---

## Recommended fix order (executed)

1. ✅ Phase 1 — Routing truth (`select_recipe` + `build_five_case` dispatch)
2. ✅ Phase 2 — Schema contract (`headline`, `gap_rows` on artifact_block)
3. ✅ Phase 3 — Composition (`RecipeView` waterfall, `surface-composition.md`, Diagnose dedupe)
4. ✅ Phase 4 (starter) — `search_cpc_internal`, Rule A retrieval filter

---

## Dual-path parity checklist (manual)

After restarting **both** servers (`npm run dev` + `langgraph dev`):

| Query | CopilotKit `/` | LangGraph `/lab/langgraph` |
|-------|----------------|----------------------------|
| Explore innovation landscape… | `recipe=orient`, headline present, visual_blocks | Same artifact_block shape |
| What evidence gap blocks… | `recipe=diagnose`, gap_matrix block | Same |
| Build a Five Case for… | `recipe=act`, radar/npv if NPV set | Same |

---

## Still open (next sprint)

- Passport object assembly from `atlas.passports` (Decision 2 full)
- Embedding alignment (Gap E)
- Tier 2 rubric / Horsemen integration tests
- Wire `Build Five Case →` action (still stub)
- Cold Act ceiling integration test (Decision 5)
- Install `vite-tsconfig-paths` to restore `npm run eval:tier1`
