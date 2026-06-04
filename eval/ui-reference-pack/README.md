# ATLAS UI Reference Pack — surfaces, blocks, and shareable export

Use this folder when you want **second opinions** or **new designs** for what the product renders today — without asking an external AI to invent UI from vague intent.

## Files in this pack

| File | Purpose |
|------|---------|
| [SURFACE-BLOCK-CODEMAP.md](./SURFACE-BLOCK-CODEMAP.md) | **Start here** — architecture, every relevant path, recipe → surface → block mapping |
| [SCORECARD.md](./SCORECARD.md) | Evaluate classifier → surface fit (from design review) |
| [EXTERNAL-AI-BRIEF.md](./EXTERNAL-AI-BRIEF.md) | Copy-paste brief for ChatGPT / Claude / designer |
| [OPINION-ON-REFERENCE-APPROACH.md](./OPINION-ON-REFERENCE-APPROACH.md) | Assessment of the “static reference pack” transcript |
| `../ATLAS-SURFACES-BUNDLE.md` | **Generated** — single file with inlined source (run bundle script) |

## Generate the one-file export

```bash
pnpm bundle:surfaces
```

Output: `eval/ATLAS-SURFACES-BUNDLE.md` (~500KB–1MB). Attach that file to external AI or Notion.

## Production pipeline (do not fork)

```text
Python: visual_recipe_director.build_visual_blocks()
    ↓ visual_blocks[] on artifact_block
TS: block-vocabulary.ts (contracts + examples)
    ↓
TS: block-renderer.tsx (type → component)
    ↓
TS: artifact-pane.tsx RecipeView → *-surface.tsx | *-recipe.tsx
    ↓
/lab/blocks (golden + empty regression)
/ (atlas-workspace live)
```

Static HTML mockups belong here as **reference only** — implementation stays React + vocabulary.

## Sprint 5 alignment

Fits **S5a** (fixture-first, lab pages, new block types). See `eval/sprint5/08-SPRINT-5-OBJECT-LAYER.md`.

Planned reference HTML (optional next step):

```text
eval/ui-reference-pack/examples/
  01-organisation-profile-cpc.html
  02-passport-profile.html
  ...
```

Not generated yet — run EXTERNAL-AI-BRIEF or orchestrator after bundle exists.
