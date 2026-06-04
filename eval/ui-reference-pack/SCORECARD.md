# Surface classifier → UI scorecard

Use when reviewing a reference mockup or a live/agent-built artifact.

**Score 0–2 per row** (0 = fail, 1 = partial, 2 = pass). **Pass threshold:** ≥80% of rows at 2, no 0 on “Evidence honesty” or “Classifier match”.

---

## A. Classifier & routing

| # | Criterion | Pass when |
|---|-----------|-----------|
| A1 | Surface matches classifier | `artifact.recipe` (or inferred recipe) matches user intent (e.g. organisation query → profile, not generic Orient) |
| A2 | One dominant workspace | User sees one primary layout (profile / passport / stakeholder / horsemen surface), not competing full reports |
| A3 | Headline answers the question | `headline` is the decision-relevant answer, not a section title |
| A4 | Insight supports headline | `insight_card` explains *why* in one glance |

## B. Evidence & trust

| # | Criterion | Pass when |
|---|-----------|-----------|
| B1 | Confidence tier visible | Tier badge matches evidence depth |
| B2 | Every claim-like row has state | SWOT/stakeholder/claim rows show `verified` / `supported` / `inferred` / `gap` / `missing` / `user_added` |
| B3 | Missing fields honest | Empty corpus → empty states + tier cap, not fabricated IDs |
| B4 | Citations traceable | Corpus IDs link to real projects where data exists; gaps listed in `evidence_gaps` or routing_gaps |

## C. Blocks & visuals

| # | Criterion | Pass when |
|---|-----------|-----------|
| C1 | Blocks earn their place | Each `visual_blocks[]` entry has enough data per `min_data_points` in vocabulary |
| C2 | Block types from vocabulary | Only `ready` (or explicit `experimental`) types from `block-vocabulary.ts` |
| C3 | Insight-first block titles | Block `title` states the finding, not chart type |
| C4 | Dominant visual matches intent | e.g. stakeholder query → graph/map, not generic bar chart |

## D. Actions & flow

| # | Criterion | Pass when |
|---|-----------|-----------|
| D1 | Actions specific | Buttons/chips name next step (e.g. “Build stakeholder map”, not “Learn more”) |
| D2 | Horsemen continuity | Profile surfaces offer sensible paths to Orient / Diagnose / Connect / Act |
| D3 | Refine/clarify compatible | Surface leaves room for lane chips without breaking layout |

## E. Implementation fit

| # | Criterion | Pass when |
|---|-----------|-----------|
| E1 | Maps to RecipeType or new block `type` | Designer documents target `recipe` string or block `type` |
| E2 | Fixture representable | JSON fixture can render on `/lab/blocks` or `/atlas5-test` without live agent |
| E3 | No parallel stack | No requirement for new chart library outside Recharts/ECharts/AntV already used |

---

## Reviewer notes template

```markdown
Surface reviewed: ___________
Recipe / block target: ___________
Fixture or live: ___________

Scores: A _/8  B _/8  C _/8  D _/6  E _/6  Total _/36

Blockers:
Recommendations (non-blocking):
Promote to vocabulary? yes / no
```
