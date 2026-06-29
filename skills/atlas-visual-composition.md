---
name: atlas-visual-composition
version: 2.0
description: How Atlas composes the canvas. Free HTML/SVG with locked facts and geometry holes.
---

# Atlas — Visual Composition Skill (v2)

## Runtime inputs (binding)

- **disposition** — do not compose if `composition_mode` is `none`, `degrade_prose`, or `reference_recipe`
- **lane_mode**, **external_skipped**, **corpus_thin** — from EvidenceBag meta
- **Parallel dual lane (default):** corpus and web are peer sources — synthesise both; neither is default authority
- **available_keys** — from KeyedFigureIndex; only these keys in `{{key}}` holes
- **web.* absent under corpus-only** — when `external_skipped` is true, `web.programme_upper_gbp` is NOT in
  available_keys; two-tier compositions must degrade (prose, single-tier, honest gap label) — never fabricate
- **scale_policies allowlist:** `compressed_bar_v1`, `linear_bar_v1`, `refuse_to_scale_v1`

## Prompt order (binding)

1. Resolve disposition (surface, canvas_action, composition_mode)
2. Write judgement fields (verdict, soWhat, tier, claims)
3. Emit `canvas_markup` **only if** `composition_mode == free_compose`; otherwise null

## Trust rules (summary)

- Every figure: `{{stats.project_count}}` etc. — never type numbers
- To-scale geometry: `{{scale(stats.funding_floor_gbp, policy=compressed_bar_v1, peer=web.programme_upper_gbp)}}`
  — never hand-type value-encoding pixels
- Mark materials: `data-material="owned|borrowed|inferred|absent"` and `data-key="..."`
- Four materials legible in greyscale (solid / dashed / hatched / torn)
- Empty bag → no instrument; single point → no comparison shape

## Output

Renderable HTML + inline SVG with holes only. Self-check is drafting aid; deterministic merge+gate is the trust boundary.

### SWOT template (when user asks for SWOT)

Use a 2×2 grid with quadrant labels STRENGTHS / WEAKNESSES / OPPORTUNITIES / THREATS.
Mark materials per quadrant: strengths=owned, weaknesses=inferred, opportunities=borrowed, threats=absent.
Optional stat strip at top with `{{stats.project_count}}` and `{{stats.funding_floor_gbp}}`.
Include `data-testid="swot-quadrant"` on the outer section.

### Journey orient template (state of play / decarbon / corpus orient)

Four-stat strip + optional web tier block when `web.programme_upper_gbp` in available_keys.
Include `data-testid="journey-orient"`. Verdict prose beside or below stats — never orphan figures.

### ChartSpec (funder breakdown)

When user asks for funder / funding breakdown, brain may attach `spec.chart` (ECharts bar) —
do not duplicate the same numbers in free HTML unless adding narrative context.

See `contracts/atlas-v5/GENUI_MINIMAL_STACK.md` for merge, gate, and fallback ladder.

## Visual consistency (suggested — not mandatory)

The canvas **spine** above your markup uses locked Atlas tokens. Match them when you can;
break the pattern only when a strong narrative reason exists (unusual layout, emphasis, contrast).

| Token | Value | Use |
|-------|-------|-----|
| canvas bg | `#FBFAF7` | Section backgrounds |
| ink | `#1A1714` | Headlines, body |
| inkSoft | `#5A5249` | Secondary text |
| inkFaint | `#94908A` | Labels, captions |
| rule / ruleSoft | `#d4d0c8` / `#EFEBE4` | Borders, dividers |
| corpus | `#3F7A52` | Corpus-owned emphasis |
| corpusWash | `#EEF4EE` | Corpus callout bg |
| web | `#B6CADB` | Web/borrowed lane |
| gap | `#B07A2E` | Blindspot / contested |
| declared | `#8B6914` | User-stated claims |

**Typography:** serif for verdict-like headlines; sans for body; mono (9–11px, uppercase, letter-spacing) for section labels.

**Patterns that read cohesive:**
- Section label row: mono uppercase label + 1px ruleSoft border below
- Stat callout: corpusWash or ruleSoft background, rounded-lg, max-width ~720px
- Two-column grid: gap 16–24px, align tops with spine above

**Autonomy:** You may invent layout (timeline, matrix, diagram) when it serves the answer.
Do not default to generic gradient cards, purple AI slop, or off-brand neon.
If unsure, mirror the spine: verdict hero → supporting block → optional chart narrative.
