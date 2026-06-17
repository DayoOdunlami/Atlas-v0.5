# Sprint 5b — Gate

**Phase:** Passport & organisation surfaces  
**Updated:** 2026-06-04  
**Branch:** cursor/sprint5-object-layer-99bd

---

## Verdict

`PARTIAL`

Fixture-driven organisation profile and passport layout upgrade delivered. `pnpm eval:tier1` still exit 1 (same VM baseline as S5a). `pnpm eval:sprint5` exit 0. `/passport/[id]` not browser-tested (requires auth session + DB).

---

## Commands run

```bash
pnpm install → exit 0
pnpm eval:tier1 → exit 1 (175 passed, 46 failed)
pnpm eval:sprint5 → exit 0 (same pass counts as S5a)
pnpm eval:sprint5:gates → exit 0
```

---

## Delivered

| Item | Status | Location |
|------|--------|----------|
| Passport CV layout | ✅ | `src/app/(chat)/passport/[id]/page.tsx` |
| organisation_profile recipe | ✅ | `types.ts`, `organisation-profile-surface.tsx`, `artifact-pane.tsx` |
| Fixture + API | ✅ | `eval/fixtures/artifact-blocks.ts`, `fixture/route.ts` |
| Lab link | ✅ | `/lab/objects` → `/atlas5-test?fixture=organisation_profile` |
| Playwright smoke | ✅ | `eval/playwright/recipe-smoke.spec.ts` |

---

## Scope audit

- [x] `agents/atlas/graph.py` — **unchanged** (S5b forbidden)
- Files touched: passport page, organisation surface, fixtures, artifact-schema, playwright spec, gate-s5b.md

---

## Recommendations

- Run `pnpm eval:tier1:e2e --grep organisation_profile` with dev server for DOM smoke.
- Manual `/passport/[id]` check with signed-in user when Postgres available.
