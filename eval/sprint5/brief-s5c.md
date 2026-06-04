# S5c brief — Object routing in graph (orchestrator phase 3)

**Prerequisite:** `gate-s5b.md` → `PASS` or `PARTIAL` with profile surfaces fixture-valid.  
**Gate target:** `eval/sprint5/gate-s5c.md`  
**Only phase that may edit:** `agents/atlas/graph.py`, routing helpers, new tests

---

## Goals

1. **`object_resolver`** — classify entity-centric queries (organisation, passport link, stakeholder map request) before or alongside `select_recipe` / turn intent.

2. **Feature flag** — `ATLAS_OBJECT_ROUTING_V1` (default off in production; document in gate).

3. **Director wiring** — `agents/visual_recipe_director.py` (and related) emit correct visual blocks for object routes.

4. **Tests** — `agents/test_object_routing.py`:
   - Offline: ≥8 table-driven cases (expected recipe or block type).
   - Document `--live` optional path in gate.

5. **Do not regress** horsemen / turn intent — `agents/test_turn_intent.py` must stay green.

---

## Acceptance

- [ ] `pnpm eval:sprint5` passes (includes turn intent + contract offline).
- [ ] `node scripts/python-bin.mjs agents/test_object_routing.py` passes (add to gate commands).
- [ ] Scope audit lists only S5c graph changes.
- [ ] Live contract (optional): `eval/test_artifact_contract_live.py --live` — PARTIAL if no secrets.

---

## BLOCKED if

- Object routing breaks existing analyze path for control queries in `test_turn_intent.py`.
- Citations fabricated or confidence_tier dropped.
