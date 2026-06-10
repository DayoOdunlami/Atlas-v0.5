# Atlas v1.0 — Render Model Spike

## Purpose

This spike turns the validated v0.9 Match Object Workbench into a proper render-model pipeline.

The UI should not render directly from raw Supabase rows. It should render from a normalised object:

```text
AtlasRenderModel
```

## Function boundary

```python
build_atlas_render_model(match_id, canonical_question_id)
```

For the spike, the function is demonstrated over the v0.9 static fixture. In production, the function should query Supabase.

## Why this matters

v0.9 proved that the `matches` object is the right Workbench backbone. But the UI still needs a consistent shape that hides database quirks.

The render model provides that shape:

```text
match + passport + target + claims + evidence_map + gaps
→ normalised evidence states
→ normalised block content
→ visual choices
→ inspector index
→ snapshot metadata
```

## Render model structure

The generated object contains:

- `artifact_id`
- `model_version`
- `canonical_question_id`
- `layout_template`
- `mode`
- `source_object`
- `target_object`
- `decision_spine`
- `blocks`
- `inspector_index`
- `snapshot`
- `data_quality_notes`

## What this spike proves

- One stored match can produce multiple rendered views.
- The UI can render from a stable model rather than raw table structure.
- Inspector content can be indexed centrally.
- Blocks can declare their visual type.
- The same fixture supports Browse, Workbench, Act and Defend views.

## What still needs building

1. Replace static fixture with live Supabase query calls.
2. Convert `matches.evidence_map` from loose object to structured array.
3. Add `affected_claim_ids`, `what_would_change`, and provenance to `matches.gaps`.
4. Implement evidence-state normalisation as a backend service.
5. Persist snapshot/brief output.
6. Add tests for each CanonicalQuestion recipe.

## Verdict

This is the correct next architectural move.

The product direction is no longer the main risk. The main risk is whether Atlas can reliably transform database records into trustworthy evidence artifacts.

The render model is the bridge.
