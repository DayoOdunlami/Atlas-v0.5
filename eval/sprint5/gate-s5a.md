# Sprint 5a — Gate

**Phase:** Vocabulary & lab  
**Updated:** 2026-06-04  
**Branch:** cursor/sprint5-object-layer-99bd

---

## Verdict

`PARTIAL`

Offline Sprint 5 eval and scope audit pass. `pnpm eval:tier1` exits 1 in this VM (175 passed / 46 failed) — failures are pre-existing infra/path checks (duplicate `eval/eval/tier1.test.ts`, missing `logs/atlas5-build-log.md`, live Supabase/MCP), not S5a regressions.

---

## Commands run

```bash
pnpm install → exit 0
pnpm eval:tier1 → exit 1 (175 passed, 46 failed, 222 total)
pnpm eval:sprint5 → exit 0
  citation_guard 5/5, turn_intent 5/5, artifact_qa 2/2, falsification 2/2, contract offline PASS
pnpm eval:sprint5:gates → exit 0 (gates PENDING expected mid-programme)
git diff agents/atlas/graph.py → empty (scope OK)
```

---

## Delivered

| Item | Status | Location |
|------|--------|----------|
| EvidenceState type | ✅ | `src/lib/atlas5/types.ts` |
| stakeholder_map block | ✅ | `block-vocabulary.ts`, `block-renderer.tsx` |
| evidence_aware_swot block | ✅ | `block-vocabulary.ts`, `block-renderer.tsx` |
| /lab/objects | ✅ | `src/app/lab/objects/page.tsx` |
| /lab/stakeholder-maps | ✅ | `src/app/lab/stakeholder-maps/page.tsx` |
| skills/object-routing.md | ✅ | `skills/object-routing.md` |
| Fixtures (object blocks) | ✅ | `eval/fixtures/artifact-blocks.ts` |

---

## Scope audit

- [x] `agents/atlas/graph.py` — **unchanged**
- Files touched: `src/lib/atlas5/types.ts`, `block-vocabulary.ts`, `block-renderer.tsx`, `src/app/lab/blocks/page.tsx`, `src/app/lab/objects/page.tsx`, `src/app/lab/stakeholder-maps/page.tsx`, `skills/object-routing.md`, `skills/data-visualization.md`, `eval/fixtures/artifact-blocks.ts`, `eval/sprint5/08-SPRINT-5-OBJECT-LAYER.md`, `eval/sprint5/gate-s5a.md`

---

## Recommendations

- Run full `pnpm eval:tier1` in CI with Supabase + agent service for green tier1 signal.
- Deduplicate `eval/eval/tier1.test.ts` vs `eval/tier1.test.ts` in vitest config to avoid double-counted failures.
- Promote object blocks to director defaults when S5c routing is live-tested.
