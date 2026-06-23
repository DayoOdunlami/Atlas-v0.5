---
name: atlas-chart-encoding
version: 1.0
description: When to use which chart — data-to-viz decision rules for Atlas v5 ChartSpec.
---

# Atlas — Chart encoding (data-to-viz)

Use with **visual_intent** and **ChartSpec** builders. The LLM chooses *whether* a chart helps;
Python chooses *which* encoding and validates the ECharts option.

## Decision tree (binding)

| Data shape | User intent | Chart kind | Notes |
|------------|-------------|------------|-------|
| 1 numeric variable | distribution | bar or histogram | Never pie for one number |
| Category + numeric | compare / rank / breakdown | horizontal bar | Funder, theme, mode counts |
| Time + numeric | trend / over time | line | Needs time series in evidence |
| Network edges | connect / supply chain | network graph | Use NetworkMap recipe, not ChartSpec |
| Part-of-whole (few cats) | share / composition | bar preferred | Pie only if ≤5 segments and sums to 100% |
| Two-tier magnitudes | orient / programme vs corpus | IncommensurableMagnitudes recipe | Not bar chart |

## Trust

- Chart data must come from SQL aggregates or keyed figures — never hand-typed in markup.
- `spec.chart.data_keys` must list every keyed figure used.
- Under corpus-only lane, do not chart borrowed web series; use prose + dashed callout.
- Under dual lane, corpus series = owned, web context = borrowed (separate series or callout).

## When NOT to chart

- Single stat (use stat strip)
- Fewer than 2 categories
- Evidence bag empty on both lanes for that dimension
- User asks for SWOT / journey orient (use templates)

See https://www.data-to-viz.com/ for the full decision space; Atlas implements a subset via recipes + ChartSpec.
