# Sprint 5 — Object layer & profile surfaces

**Status:** Planned (object routing not in graph yet)  
**Problem:** Turn lanes (clarify / refine / analyze) exist; queries about *entities* (organisation, passport, stakeholder map) still route through mode recipes instead of object-first surfaces.

**Do not bloat Orient.** Object routing is a separate resolver, not more Orient sections.

---

## Phases

### S5a — Vocabulary & lab (no `graph.py`)

- Add `EvidenceState` type in `src/lib/atlas5/types.ts`:
  `{ text: string; claim_state: ClaimState; rationale?: string; source_id?: string }`
  (Python mirror: same `claim_state` strings in visual block payloads.)
- Promote or add block types: `stakeholder_map`, `evidence_aware_swot` (fixtures + `BLOCK_VOCABULARY` + `BlockRenderer` + Python `build_visual_blocks` stubs if needed for lab only).
- Pages: `/lab/objects`, `/lab/stakeholder-maps` (golden + empty, mirror `/lab/blocks` pattern).
- Skills: extend `skills/data-visualization.md`, add `skills/object-routing.md` (draft).
- Update this pack’s gate file when done.

**Out of scope S5a:** `object_resolver`, production `/` routing changes.

### S5b — Profile & passport surfaces

- Passport CV layout upgrade (`src/components/passport/*`, `/passport/[id]`).
- Organisation profile **fixture-driven** recipe (new recipe id e.g. `organisation_profile` in `RecipeView` / detectRecipe).
- Golden fixtures in `eval/fixtures/artifact-blocks.ts` + tier1 smoke.
- No graph routing yet — render via `/lab/*` and fixture API.

### S5c — Graph object routing

- `object_resolver` node or pre-classify step in `agents/atlas/graph.py`.
- Extend `select_recipe` / intent with `ATLAS_OBJECT_ROUTING_V1` feature flag.
- Wire builders in `agents/visual_recipe_director.py`.
- Acceptance: 8 routing queries in `agents/test_object_routing.py` (offline table-driven; optional `--live`).
- Env: `ATLAS_OBJECT_ROUTING_V1=true`.

---

## Acceptance (S5c routing examples)

| Query shape | Expected surface / recipe |
|-------------|-------------------------|
| "Show me CPC as an organisation" | organisation profile |
| "Stakeholder map for this programme" | stakeholder_map block |
| "Passport for [entity]" | passport / object link |
| Analyse-mode strategic question (control) | existing horsemen route unchanged |

Exact query strings live in `agents/test_object_routing.py` when implemented.

---

## JSON / schema touchpoints

- `artifact_block.json` — new visual block types only; keep `confidence_tier` on every agent path.
- Citations unchanged: `corpus_citations` (atlas.projects), `hive_citations` (hive.articles).

---

## Definition of done (programme)

All of: `gate-s5a.md`, `gate-s5b.md`, `gate-s5c.md` → **PASS** or documented **PARTIAL** with human review; `pnpm eval:tier1` + `pnpm eval:sprint5` green on branch.
