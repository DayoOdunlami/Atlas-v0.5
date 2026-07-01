# Increment 2 — model-proposed visual intent

**Status:** interim query-relevance gate landed in `visual/opportunity.py` (2026-06-30). Full model-proposed intent still parked for Phase 2 turn planner.

## Interim fix (shipped — v2 pairing)

`select_opportunities()` pairs **question affinity** × **discovery strength** per chart role:

| Mode | When |
|------|------|
| `question-led` | User asked for this shape; discovery meets minimum bar |
| `discovery-led` | Search surfaced strong data the question did not explicitly ask for |
| `aligned` | Both sides contribute enough to pass threshold |

Hard suppressions remain: SWOT, strategy-alignment funding bars, weak-data suppression.

Substitution: network/connect questions with thin flow data can still attach a **heatmap** (coverage role) when citation matrix is rich.

Scoring metadata is emitted on `visual_opportunities[]` (`query_affinity`, `discovery_strength`, `pairing_score`, `pairing_mode`).

Phase 2 can still replace regex affinity with model-proposed intent after answer shape is known.

## Original diagnosis (still true for templates)

**Query:** "what are the best ways or opportunities to fix rural transport issues?"

**Answer shape:** relational — five opportunity vectors, structural gaps, actors (DRT, community transport, rural MaaS, etc.).

**Canvas rendered:** three funding **bar charts** (null funding by funder, lead-funder skew, corpus-vs-web scale).

**Diagnosis:** `visual_intent.detect_visual_form()` chooses from **query keywords** (`funding`, `grant`, `landscape`, …), not from the answer's actual shape after synthesis. The model wrote a relational analysis; the regex stapled quantitative bars.

**Header bug (fixed separately):** scope bar showed "Maritime decarbonisation" because `corpus_scope` regex `\bmaritime|shipping|port\b` matched the suffix `port` in **transport** — not a stale UI field.

## Confirmation test

```python
from agents.atlas_v5.visual_intent import detect_visual_form

detect_visual_form("who connects to whom in rural transport")  # → none
detect_visual_form("funding breakdown by funder for rural transport")  # → funder_bar
```

A clearly relational query does **not** get a network visual today — bars appear when funding keywords hit or when the orient skeleton (`IncommensurableMagnitudes` / funder charts) is the default instrument regardless of answer shape.

## Increment 2 fix (when unlocked)

Model proposes `visual_intent` from disposition + judgement **after** answer shape is known; regex becomes fallback only. Relational answers → NetworkMap / gap matrix; quantitative asks → bar charts.
