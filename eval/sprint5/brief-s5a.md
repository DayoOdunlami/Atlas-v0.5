# S5a brief — Vocabulary & lab (orchestrator phase 1)

**Gate target:** `eval/sprint5/gate-s5a.md`  
**Forbidden:** `agents/atlas/graph.py`, production routing changes on `/`

---

## Goals

1. **EvidenceState** — add to `src/lib/atlas5/types.ts` (or adjacent); use in block data where claim state matters; document shape in `08-SPRINT-5-OBJECT-LAYER.md` if extended.

2. **New block types** (minimum viable for lab):
   - `stakeholder_map` — nodes/edges or roles + influence; golden + empty in vocabulary.
   - `evidence_aware_swot` — quadrants with `claim_state` per item; golden + empty.

3. **Vocabulary + renderer**
   - `src/lib/atlas5/block-vocabulary.ts` — entries `status: "ready"` or `experimental` per team convention.
   - `src/components/atlas5/block-renderer.tsx` — cases for new types.
   - Sync note in `skills/data-visualization.md` for promoted blocks.

4. **Lab pages**
   - `src/app/lab/objects/page.tsx` — index linking block gallery + future object fixtures.
   - `src/app/lab/stakeholder-maps/page.tsx` — renders stakeholder_map golden/empty (mirror `/lab/blocks` UX).

5. **Skills**
   - `skills/object-routing.md` — draft rules (no runtime wiring).

6. **Fixtures**
   - `eval/fixtures/artifact-blocks.ts` — sample blocks for tier1 if recipes need them later.

---

## Parallel subagent slices (optional)

| Subagent | Scope |
|----------|--------|
| A | Lab pages only under `src/app/lab/objects`, `stakeholder-maps` |
| B | `block-vocabulary.ts` + `block-renderer.tsx` + fixtures |

Orchestrator integrates and runs eval.

---

## Acceptance

- [ ] `/lab/blocks` still works (no regression).
- [ ] `/lab/objects` and `/lab/stakeholder-maps` render without agent run.
- [ ] `pnpm eval:tier1` passes.
- [ ] `pnpm eval:sprint5` passes.
- [ ] `graph.py` unchanged (scope audit).

---

## PARTIAL allowed?

Yes, if new blocks are `experimental` only but lab renders — mark PARTIAL and list promotion TODO in Recommendations.
