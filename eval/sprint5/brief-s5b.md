# S5b brief — Passport & organisation surfaces (orchestrator phase 2)

**Prerequisite:** `gate-s5a.md` → `PASS` or `PARTIAL` with lab surfaces OK.  
**Gate target:** `eval/sprint5/gate-s5b.md`  
**Forbidden:** `agents/atlas/graph.py` object routing

---

## Goals

1. **Passport CV upgrade** — improve `src/components/passport/*` layout (claims, evidence, documents) for scanability; no breaking API routes under `src/app/api/passport/`.

2. **Organisation profile recipe**
   - New recipe id (e.g. `organisation_profile`) in recipe detection + `RecipeView` surface component (new file under `src/components/atlas5/` or extend existing mode surface).
   - Fixture in `eval/fixtures/artifact-blocks.ts`.
   - Tier1 / playwright smoke entry if pattern exists in `eval/playwright/recipe-smoke.spec.ts`.

3. **Lab wiring**
   - Link from `/lab/objects` to organisation fixture preview (query param or static fixture name).

---

## Acceptance

- [ ] `/passport/[id]` still loads (manual note in gate if no DB).
- [ ] Organisation fixture renders on `/atlas5-test?fixture=...` or lab page.
- [ ] `pnpm eval:tier1` passes.
- [ ] `pnpm eval:sprint5` passes.

---

## PARTIAL allowed?

Yes, if passport upgrade is visual-only and organisation is fixture-only without live data — document in gate.
