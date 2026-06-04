# Sprint 5c — Gate

**Phase:** Graph object routing  
**Updated:** 2026-06-04  
**Branch:** cursor/sprint5-object-layer-99bd

---

## Verdict

`PARTIAL`

Offline routing and full `pnpm eval:sprint5` pass (15 object-routing checks + existing suites). Live `eval/test_artifact_contract_live.py --live` deferred — LangGraph/agent service not running in this VM (process hung with no output).

**Feature flag:** `ATLAS_OBJECT_ROUTING_V1` — default off in production; set `true` in `.env.local` for dev routing tests.

---

## Commands run

```bash
pnpm install → exit 0
pnpm eval:tier1 → exit 1 (175 passed, 46 failed — VM baseline)
pnpm eval:sprint5 → exit 0
  citation_guard 5/5
  turn_intent 5/5
  test_object_routing 15/15 (8 entity routes + 3 negatives + 2 horsemen controls + disable)
  artifact_qa 2/2
  falsification 2/2
  contract offline PASS (4 recipe routing + 2 orient helpers)
pnpm eval:sprint5:gates → exit 0 (all gates PASS or PARTIAL)
node scripts/python-bin.mjs agents/test_object_routing.py → exit 0
node scripts/python-bin.mjs eval/test_artifact_contract_live.py --live → deferred (no agent)
pnpm demo:check → exit 0
```

---

## Delivered

| Item | Status | Location |
|------|--------|----------|
| object_resolver (pre-classify) | ✅ | `agents/object_routing.py`, `select_recipe_intent` in `graph.py` |
| ATLAS_OBJECT_ROUTING_V1 | ✅ | `agents/object_routing.py` |
| Director wiring | ✅ | `visual_recipe_director.py` (`organisation_profile` blocks) |
| test_object_routing.py | ✅ | 8+ table-driven cases |
| turn_intent regression | ✅ | `test_turn_intent.py` still 5/5 |

---

## Scope audit

- [x] `agents/atlas/graph.py` — **edited in S5c only** (import + `select_recipe_intent` override + `organisation_profile` build path)
- [x] No S5a/S5b forbidden scope violations
- Files touched: `agents/object_routing.py`, `agents/test_object_routing.py`, `agents/atlas/graph.py`, `agents/visual_recipe_director.py`, `package.json`, `eval/sprint5/gate-s5c.md`

---

## Recommendations

- Run `--live` contract against local LangGraph (`LANGGRAPH_API_URL`) with `ATLAS_OBJECT_ROUTING_V1=true`.
- Add E2E query for "Show me CPC as an organisation" once agent deploy includes S5c.
- Wire passport object route to deep-link `/passport/[id]` when entity resolution exists in corpus.
