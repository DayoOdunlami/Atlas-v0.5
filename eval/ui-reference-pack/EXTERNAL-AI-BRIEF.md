# External AI / designer brief — ATLAS surfaces

Attach **`eval/ATLAS-SURFACES-BUNDLE.md`** (run `pnpm bundle:surfaces` first) or this repo’s `eval/ui-reference-pack/SURFACE-BLOCK-CODEMAP.md`.

---

## Your mission

Review **what ATLAS can render today** and propose **more compelling** (not prettier-only) versions of:

1. Horsemen surfaces: Orient, Connect, Diagnose, Defend, Act (Five Case)
2. Art-director **visual blocks** (11 ready types in `block-vocabulary.ts`)
3. **New** object/profile surfaces for Sprint 5:
   - Organisation profile (e.g. CPC)
   - Passport / capability CV
   - Stakeholder workspace
   - Evidence-aware SWOT
   - Gap-to-partner map

## Constraints (non-negotiable)

- Output must map to existing or **new** `RecipeType` / block `type` strings — no orphan designs.
- Pipeline: structured `artifact_block` → React — same as Vercel AI SDK generative UI / tool → component pattern.
- Every claim-like row needs **evidence_state** (see `ClaimState` in bundle).
- Headline → insight → blocks → sections order stays.
- Static HTML mockups OK as **reference**; production stays React + `/lab/blocks` fixtures.
- Do not recommend replacing LangGraph, CopilotKit shell, or building a parallel UI framework.

## Deliverables

1. **Gap analysis** — table: surface vs “good” vs current code
2. **Five reference mockups** (HTML/CSS or Figma descriptions) grounded in real fields:
   - organisation_profile (CPC)
   - passport_profile
   - stakeholder_workspace
   - evidence_aware_swot
   - gap_to_partner_map
3. **Vocabulary proposals** — new block `type` strings + `required_fields` + `min_data_points`
4. **Scorecard** — score each mockup using `eval/ui-reference-pack/SCORECARD.md`
5. **Fixture JSON** — one `visual_blocks` example per new block (synthetic UUIDs OK)

## SQL grounding (run against Supabase atlas schema)

```sql
-- CPC organisation slice
SELECT name, project_count, total_funding
FROM atlas.organisations
WHERE name ILIKE '%CONNECTED PLACES%' OR name ILIKE '%CATAPULT%'
LIMIT 5;

-- Related projects
SELECT project_title, lead_organisation, total_funding
FROM atlas.projects
WHERE lead_organisation ILIKE '%CONNECTED PLACES%'
ORDER BY total_funding DESC NULLS LAST
LIMIT 10;
```

Label inferred/missing fields explicitly in mockups.

## Do not

- Invent internal file paths not in the bundle
- Propose unbounded open-web report UI without confidence tiers
- Suggest migrating off `block-vocabulary.ts` / `BlockRenderer`

## Success

A developer can take your block `type` + fixture JSON and add them to S5a without reinterpretation.
