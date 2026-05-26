# Atlas 5 — Validation Harness

Three-tier approach: fast contract checks on every commit, quality evals nightly.

---

## Quick reference

| Command | What it runs | Time |
|---|---|---|
| `pnpm eval:tier1` | Vitest source-code checks (no server, no auth) | ~5s |
| `pnpm eval:tier1:e2e` | Playwright smoke tests (requires `pnpm dev`) | ~30s |
| `curl localhost:3000/api/atlas5/fixture?recipe=brief_five_case` | Single fixture contract check | <1s |
| *(D10)* `python eval/tier2_generator.py` | Agent golden-set evals | ~5 min |

---

## Tier 1 — Render and contract checks

**What:** Does the code compile correctly? Do the components render the expected data-testid markers? Does the fixture data pass Zod schema validation?

**When:** Every commit.

**Files:**

| File | Purpose |
|---|---|
| `eval/tier1.test.ts` | Vitest source-code checks (no browser, no auth) |
| `eval/playwright/recipe-smoke.spec.ts` | Playwright smoke tests against fixture data |
| `eval/fixtures/artifact-blocks.ts` | Shared mock `ArtifactBlock` for all tiers |
| `src/app/api/atlas5/fixture/route.ts` | Dev-only fixture injection API |
| `src/app/(public)/atlas5-test/page.tsx` | Dev-only render test page (no auth required) |

**Playwright test URL:** `http://localhost:3000/atlas5-test?fixture=<name>`

Supported fixture names: `brief_five_case` · `evidence_panel` · `stats_dashboard` · `scenario_stress_test` · `legacy_brief`

Add `&spine=1` to include the Decision Spine fixture: `/atlas5-test?fixture=brief_five_case&spine=1`

**Fixture API:**
```bash
# Returns JSON with can_render, recipe_detected, schema_issues, etc.
curl "http://localhost:3000/api/atlas5/fixture?recipe=brief_five_case"
curl "http://localhost:3000/api/atlas5/fixture?recipe=stats_dashboard"
# All five at once:
for r in brief_five_case evidence_panel stats_dashboard scenario_stress_test legacy_brief; do
  echo "=== $r ===" && curl -s "http://localhost:3000/api/atlas5/fixture?recipe=$r" | jq '{ok,can_render,recipe_detected,chart_specs_count,citations_count,schema_issues}'
done
```

**What the fixture API validates:**
- `ok` — fixture loaded, schema-valid, and `can_render=true`
- `recipe_detected` — what `detectRecipe()` returns for this fixture (must match `requested_recipe` for recipes 1–4; must be `null` for `legacy_brief`)
- `schema_issues` — Zod validation failures (must be empty `[]`)
- `can_render` — `true` when the recipe routing will reach the correct component
- `missing_required_fields` — fields that are undefined but required for the recipe to render correctly

---

## Tier 2 — Contract validation

**What:** Does the agent payload pass the Zod schema? Are fields like `recipe` and `chart_specs` surviving the builder functions without being silently dropped?

**When:** Every commit (wired into `use-atlas5-chat.ts` as `console.warn`).

**File:** `src/lib/atlas5/artifact-schema.ts`

This file defines Zod schemas for every type in the artefact contract:
- `ArtifactBlockSchema` — full block validation
- `AnnotationPayloadSchema` — lightweight check in `use-atlas5-chat.ts` (validates `recipe`, `confidence_tier`, `chart_specs`, `decision_spine`)
- `CorpusCitationSchema` — UUID format + score range 0–1
- `DecisionSpineSchema` — all required fields present
- `EvidenceCoverageSchema` — coverage metrics
- `ChartSchema` — discriminated union for line / bar / pie

**When schema validation fires in production:**
It does not. The `AnnotationPayloadSchema.safeParse()` call in `use-atlas5-chat.ts` uses `console.warn` — it never blocks rendering. In CI, run `eval/tier1.test.ts` to catch schema regressions before they reach production.

---

## Tier 3 — Agent golden-set evals (D10)

**What:** Does the Python agent (ATLAS, JARVIS, CICERONE, HYVE) produce a semantically correct response for a given strategic query? Does the confidence tier match the evidence quality? Are all cited IDs real Supabase records?

**When:** Nightly (not on every commit — each run costs LLM API calls).

**File:** `eval/tier2_generator.py` (the golden-set runner — misnamed from D0 scaffold; will be renamed at D10)

**Architecture:**
```
Golden query → Python agent → ArtifactBlock JSON → Three graders:
  1. Schema grader  — Pydantic / Zod (free, instant)
  2. Citation grader — Supabase UUID existence check (fast, cheap)
  3. Quality grader  — claude-sonnet-4-6 LLM-as-judge (slow, costs tokens)
```

**LLM-as-judge criteria (per agent):**
- ATLAS: Five Case sections present, NPV plausible, discount_rate = 0.035
- JARVIS: ≥3 corpus citations, all IDs in atlas.projects
- CICERONE: transferability_score 0–100, evidence_gaps include HAVE/PARTIAL/MISSING
- HYVE: hive_citations with article_ids in hive.articles

**Pass threshold:** Defined in `tier2_generator.py` as `MIN_TOTAL_SCORE`.

---

## What runs where

| Check | On commit | Nightly | On demand |
|---|---|---|---|
| Vitest source-code checks | ✅ | ✅ | ✅ |
| Playwright recipe smoke tests | ✅ | ✅ | ✅ |
| Fixture API contract check | — | — | ✅ (curl) |
| Zod schema warnings in app | ✅ (console.warn) | — | — |
| Agent golden-set evals (Tier 3) | — | ✅ | ✅ |

---

## Adding new fixtures

1. Add the new `ArtifactBlock` to `eval/fixtures/artifact-blocks.ts`
2. Add the key to `FIXTURE_MAP`
3. Add a Playwright test in `eval/playwright/recipe-smoke.spec.ts`
4. Add a source-code check in `eval/tier1.test.ts` under the relevant describe block

---

## Security rules

- Fixture API returns 404 in `NODE_ENV === "production"` 
- Test render page (`/atlas5-test`) returns 404 in production
- No `SUPABASE_SERVICE_KEY` in any file in `eval/`
- Fixtures contain **synthetic UUIDs** — not verified against Supabase
- Real agent citations must pass the citation grader (Tier 3) before being considered valid
