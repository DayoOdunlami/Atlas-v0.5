# Opinion — UI Reference Pack vs current stack

## Verdict on the transcript

**Strong yes** to the approach, with the pushback it already states.

| Idea | Agree? | Why |
|------|--------|-----|
| Reference surfaces, not vague “make it prettier” | Yes | You already have `block-vocabulary.ts`, `RecipeView`, `/lab/blocks` — external designers need **grounded targets**, not greenfield Figma |
| UI Reference Pack in S5a | Yes | Matches fixture-first S5a; safe while graph routing is S5c |
| Static HTML/SVG as **reference artifact** | Yes | Fast second opinion; must not become a second UI stack |
| SQL-grounded examples (CPC, passports, projects) | Yes | Aligns with architecture rule: no hardcoded CPC strings |
| Scorecard for classifier → surface | Yes | Bridges product language (Orient/organisation/passport) to `RecipeType` + `visual_blocks` |
| Dataform analogy | Partial | Use **Supabase SQL + fixture JSON + assertions** in scorecard; skip BigQuery/Dataform unless warehouse moves |
| “Don’t research endlessly — ship examples” | Yes | Your repo already has 11 ready blocks + 4 horsemen surfaces; gap is **object/profile surfaces**, not another framework survey |

## What the transcript gets right about your codebase

1. **Pipeline exists** — Art director emits `visual_blocks`; `RecipeView` wraps horsemen surfaces; blocks render via `BlocksView`.
2. **Lab exists** — `/lab/blocks` proves golden + empty states without running the agent.
3. **Missing bridge** — No first-class `organisation_profile`, `stakeholder_map`, `evidence_aware_swot` in vocabulary yet (Sprint 5a scope).
4. **Generative UI pattern** — Tool/structured result → React component → persisted artifact → next action matches AG-UI + your `artifact_block` contract.

## Pushback (keep these guardrails)

1. **One implementation path** — Any mockup must map to `type` strings in `BLOCK_VOCABULARY` and a `BlockRenderer` case, or a new `*-surface.tsx` recipe component.
2. **evidence_state on every claim-like row** — Already partially present via `ClaimState` / `claim-state-badge`; reference pack should **extend**, not invent a parallel taxonomy.
3. **Don’t deprecate waterfall** — Headline → insight card → blocks → sections is intentional (`artifact-pane.tsx`); mocks should respect order.
4. **CPC inward vs outward** — Surfaces differ by recipe (`cpc_*` vs `orient`/`act`); reference examples should label which classifier fired.

## Recommended order of work

1. Read `SURFACE-BLOCK-CODEMAP.md` or run `pnpm bundle:surfaces` and share bundle.
2. Add `examples/*.html` + `reference-data.sql` (grounded CPC/passport queries).
3. External review against `SCORECARD.md`.
4. Promote winning patterns into S5a block types + `/lab/objects`.
5. S5c wires `object_resolver` only after lab proves render.

## What I would *not* do

- Replace CopilotKit/assistant-ui shell based on “OpenAI Apps SDK looks nicer.”
- Build parallel React app for references.
- Let crawl agents redesign without the scorecard + vocabulary mapping table.
