# Atlas v5 Artefact Contract

> **Status:** Clone-validated. Ready for main repo port after review.  
> **Last updated:** 2026-05-21  
> **Approved by:** Dayo (pending)

This document is the single source of truth for the `ArtifactBlock` shape, the four render recipes, citation contracts, and evidence coverage. Any change to these shapes requires updating this document and the corresponding TypeScript/Python definitions simultaneously.

---

## 1. ArtifactBlock — full field list

```typescript
type ArtifactBlock = {
  // ── Identity ───────────────────────────────────────────────────────────────
  type:   "brief" | "evidence" | "chart" | "scenario";
  recipe: "brief_five_case" | "evidence_panel" | "stats_dashboard" | "scenario_stress_test";

  // ── Content ────────────────────────────────────────────────────────────────
  sections?:          Record<string, string>;     // section-heading → body text
  corpus_citations?:  CorpusCitation[];           // verified against DB before storage
  hive_citations?:    HiveCitation[];             // HYVE agent only; article-level
  npv_value?:         number;                     // £ NPV, e.g. 46_000_000
  discount_rate?:     number;                     // STPR %, e.g. 3.5

  // ── Charts (artefact-owned) ────────────────────────────────────────────────
  chart_specs?:       Chart[];                    // charts that TRAVEL with this artefact
                                                  // NOT exploratory workspace charts

  // ── Evidence ───────────────────────────────────────────────────────────────
  confidence_tier:    "Speculative" | "Indicative" | "Supported" | "Robust";
};
```

**Key invariant:** `recipe` is set by the agent (or defaulted from `type` by the tool). The UI router prefers `artifact.recipe` over section-name inference. Both paths must agree.

---

## 2. RecipeType — render routing

```typescript
type RecipeType =
  | "brief_five_case"       // Five Case Model investment brief
  | "evidence_panel"        // Citation grid / evidence review
  | "stats_dashboard"       // Data analysis, NPV, charts
  | "scenario_stress_test"; // Hypothesis stress test
```

### Type → recipe defaults (fallback only — always set explicitly)

| `type`      | Default `recipe`       |
|-------------|------------------------|
| `"brief"`   | `"brief_five_case"`    |
| `"evidence"`| `"evidence_panel"`     |
| `"chart"`   | `"stats_dashboard"`    |
| `"scenario"`| `"scenario_stress_test"` |

---

## 3. Required fields per recipe

### `brief_five_case`

| Field | Required | Notes |
|-------|----------|-------|
| `recipe` | ✓ | `"brief_five_case"` |
| `confidence_tier` | ✓ | |
| `sections` | ✓ | ≥ 1 of the Five Case keys (see below) |
| `corpus_citations` | ✓ | ≥ 1 verified citation |
| `npv_value` | optional | Renders emerald NPV callout if present |
| `discount_rate` | optional | Shown alongside `npv_value` |
| `chart_specs` | optional | Inline charts (e.g. BCR sensitivity) |

**Five Case section keys** (render with colour-coded left borders):

| Key | Border colour |
|-----|---------------|
| `"Strategic Case"` | indigo |
| `"Economic Case"` | emerald |
| `"Commercial Case"` | violet |
| `"Financial Case"` | amber |
| `"Management Case"` | slate |

---

### `evidence_panel`

| Field | Required | Notes |
|-------|----------|-------|
| `recipe` | ✓ | `"evidence_panel"` |
| `confidence_tier` | ✓ | |
| `corpus_citations` | ✓ | ≥ 1; renders 2-column citation grid |
| `sections.Query` | optional | Shown as context above citations |
| `hive_citations` | optional | Shown in Trust Rail HIVE section |

---

### `stats_dashboard`

| Field | Required | Notes |
|-------|----------|-------|
| `recipe` | ✓ | `"stats_dashboard"` |
| `confidence_tier` | ✓ | |
| `npv_value` | recommended | Renders £XXm emerald headline |
| `sections.Summary` | recommended | Context above charts |
| `sections.Methodology` | optional | Data provenance note |
| `corpus_citations` | ✓ | ≥ 1 |
| `chart_specs` | recommended | Renders inline via `ChartRenderer` |

---

### `scenario_stress_test`

| Field | Required | Notes |
|-------|----------|-------|
| `recipe` | ✓ | `"scenario_stress_test"` |
| `confidence_tier` | ✓ | |
| `sections.Hypothesis` | ✓ | 1–2 sentence claim being tested |
| `sections["Supporting Evidence"]` | ✓ | 3 bullet points |
| `sections["Challenging Evidence"]` | ✓ | 3 bullet points |
| `sections["Key Assumptions"]` | ✓ | Numbered list; tag each `[HELD]` / `[FRAGILE]` / `[UNVERIFIED]` |
| `sections.Verdict` | ✓ | One-line conclusion with qualifier |
| `corpus_citations` | ✓ | ≥ 1 |

**Assumption tag colours:** `[HELD]` → green · `[FRAGILE]` → amber · `[UNVERIFIED]` → red

---

## 4. CorpusCitation shape

```typescript
type CorpusCitation = {
  id:            string;          // UUID — must exist in Supabase; verified before storage (H1)
  title:         string;
  score:         number;          // semantic similarity 0–1
  source_type?:  SourceType;

  // source_type-specific fields
  organisation?: string;          // project
  funder?:       string;          // live_call
  deadline?:     string | null;   // live_call — ISO date string
  chunk_id?:     string;          // knowledge_chunk / hive_chunk
  document_id?:  string;          // knowledge_chunk
  publisher?:    string;          // knowledge_doc / knowledge_chunk
  article_id?:   string;          // hive_chunk / hive_article
};

type SourceType =
  | "project"
  | "live_call"
  | "knowledge_doc"
  | "knowledge_chunk"
  | "hive_chunk"
  | "hive_article";
```

**Source label mapping** (consistent across evidence panel + trust rail):

| `source_type` | Badge label | Colour |
|---------------|-------------|--------|
| `project` | R&D Project | indigo |
| `live_call` | Open Call | green |
| `knowledge_doc` | Policy | blue |
| `knowledge_chunk` | Policy | blue |
| `hive_chunk` | HIVE | purple |
| `hive_article` | HIVE | purple |

---

## 5. HiveCitation shape

```typescript
type HiveCitation = {
  article_id: string;   // hive.articles.id — UUID; must exist in DB
  chunk_id?:  string;   // hive.document_chunks.id — optional, for provenance
  title:      string;   // from hive.articles.project_title (fallback: measure_title)
  score:      number;
};
```

HYVE resolves to article level for citation; chunk_id is retained for provenance only.

---

## 6. EvidenceCoverage shape

```typescript
type EvidenceCoverage = {
  projects_found:         number;
  live_calls_found:       number;
  knowledge_docs_found:   number;
  hive_chunks_found:      number;
  source_diversity:       number;   // count of distinct source types
  top_similarity:         number;
  average_similarity:     number;
  evidence_gaps:          string[];
  suggested_confidence_tier: ConfidenceTier;
  coverage_note:          "thin" | "adequate" | "strong";
};
```

Computed by `set_artifact_block()` from verified citations. Stored in `AgentState.evidence_coverage`. Read by `set_decision_spine()` to enforce the confidence ceiling (H2 hardening).

---

## 7. Chart ownership rule

```
ArtifactBlock.chart_specs  = charts that BELONG to the artefact
                              (travel with it, render inside the recipe surface)
                              Examples: BCR sensitivity chart in a brief,
                              investment-by-year in a stats dashboard

AgentState.charts          = temporary workspace / exploratory charts
                              (generated while the agent is thinking, not part of
                              a formal deliverable)
```

The `stats_dashboard` recipe renders `artifact.chart_specs` inline via `ChartRenderer`. The `brief_five_case` recipe may optionally render charts below the Five Case sections. The `evidence_panel` and `scenario_stress_test` recipes do not normally include charts.

---

## 8. Backward compatibility when porting to InnovationAtlas4.0

| Item | Clone behaviour | Main repo requirement |
|------|-----------------|-----------------------|
| `artifact.recipe` | Optional; falls back to type inference | Required; agent must always set it |
| `detectRecipe()` | Prefers explicit, falls back to section names | Keep both paths; add lint warning when recipe is missing |
| `chart_spec` (old field) | Removed | Was never in production — no migration needed |
| `AgentState.charts` | Still used for workspace charts | Keep; distinguish from `artifact.chart_specs` in UI |
| Citation `score` vs `similarity` | Verifier outputs both; summary reads either | Normalise to `score` only in main repo |

---

## 9. Files to change in InnovationAtlas4.0

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `RecipeType`, `recipe?` and `chart_specs?` to `ArtifactBlock`; remove `chart_spec?: object` |
| `src/components/dashboard/layout/artifact-panel.tsx` | Replace with clone version (recipe router) |
| `src/components/dashboard/layout/trust-rail.tsx` | Replace with clone version (source badges + HIVE section) |
| `src/components/dashboard/recipes/` | Copy all four recipe components (new directory) |
| `agent/state.py` | Add `RecipeType`, `recipe`, `chart_specs` to `ArtifactBlock` |
| `agent/tools.py` | Add `recipe` and `chart_specs_json` params to `set_artifact_block` |
| `agent/graph.py` | Merge updated system prompt sections |

---

## 10. Port risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `ArtifactBlock` in `context_packet.json` has stale shape | Medium | Re-run JSON schema codegen (Zod → Pydantic) after types.ts update |
| `AgentState.charts` consumers break if misidentified as `chart_specs` | Low | Charts are on different keys; search for `artifact_block.chart_spec` (singular, old name) to confirm no stragglers |
| Main repo `initialState` still uses fake demo citations | High | Update `initialState` to use empty `corpus_citations: []` (already done in clone) |
| Brief v2 components import `ArtifactBlock` with old shape | Medium | Brief v2 is superseded — verify no live imports of the old `chart_spec` field |
| `SUPABASE_SERVICE_KEY` exposure during port | High | Run `grep -r "SUPABASE_SERVICE_KEY" .next/static/` after every build |
