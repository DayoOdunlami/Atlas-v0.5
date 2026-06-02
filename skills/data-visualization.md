# Data Visualisation — Art Director Skill

## North Star

Every visual must make the answer clearer, not decorate it.
If removing a chart would make the output more honest, remove it.

---

## Prime Directive — Answer First, Visual Supports

Always open with a one-sentence verdict or `recommendation_card` before any chart.
Users read text before they interpret a visual.

If the visual IS the answer, the sentence above it states what the visual shows
— it does not restate the question.

**Never open with a chart. Never use a chart as a substitute for stating a conclusion.**

The five-second rule: a user must reach the core finding within five seconds.
If a chart requires more interpretation than that, it is wrong for this data.

---

## Composition Rules — Response Structure

```
1. Verdict / recommendation_card     ← always visible, always first
2. Dominant visual                   ← one primary chart
3. Supporting visual (if warranted)  ← smaller, secondary
4. Evidence strip                    ← citation rows, always last
```

Above the fold: `recommendation_card` + dominant visual only.
Below the fold (collapsible): supporting charts, full evidence strip, analysis sections.

Strategic options precede evidence. In Orient and Connect responses, show the
options comparison before the evidence strip.

Maximum 3 visual blocks per response. A response with 6 charts is always worse
than one with 2.

Evidence always last. Citation rows are the final block. They support the
analysis; they are not the analysis.

---

## When a Chart Earns Its Place

A chart only appears when ALL of the following are true:
1. There are ≥ 3 data points of the same type to compare
2. The visual comparison adds information the prose cannot convey
3. The chart type matches the data structure and question

1–2 data points → prose only. A two-bar chart is a sentence. Write the sentence.

**The insight test:** does this visual change what the user would conclude, or
does it merely illustrate what was already said in prose? If it only illustrates,
remove it.

---

## Block Selection — Data Shape to Block Type

### `domain_heatmap`
Use when: ≥ 3 domains have project counts and/or evidence counts.
Shows evidence density across the landscape at a glance.
Required: `[{ domain, project_count, avg_score }]`
Do not use if all domain counts are similar — a bar chart is cleaner.
Library: ECharts

### `knowledge_graph`
Use when: ≥ 4 entities have meaningful relationship clusters (co-funder,
shared theme, overlapping geography) and the cluster structure is the finding.
Required: `{ nodes: [{ id, label, group }], edges: [{ source, target, weight }] }`
Minimum 4 nodes and 3 edges.
Do not use for isolated items with no edges — a ranked list is cleaner.
Library: ECharts

### `options_comparison`
Use when: output contains 2–5 distinct strategic pathways or alternatives with
comparable attributes (fit score, rationale, effort).
Always prefer a structured table over prose paragraphs for options.
Required: `[{ option, fit_score, rationale, action }]`
Do not use for > 5 options — show top 5, note the rest.
Library: Custom table

### `evidence_bar` (horizontal bar)
Use when: ranking items by a score, count, or similarity value.
Always sort descending. Maximum 10 items.
Required: `[{ label, value }]` ≥ 3 items
Do not use when values are all within 10% of each other — use prose.
Library: Recharts

### `radar`
Use when: comparing an entity across exactly 5 balanced dimensions on the same
scale (Five Case Model only: Strategic, Economic, Commercial, Financial, Management).
Required: `[{ dimension, score }]` — always 5 items
Do not use for any other comparison.
Library: ECharts

### `npv_waterfall`
Use when: showing NPV decomposition — how components add up to a total.
Required: `[{ label, value, type: 'positive'|'negative'|'total' }]`
Minimum 2 components before the total bar.
Always show HMT STPR discount rate (3.5%) as subtitle.
Library: Custom Recharts

### `gap_matrix`
Use when: Diagnose intent and evidence gaps have area, severity, and action fields.
Always a table, never prose rows. Maximum 8 rows; consolidate minor gaps.
Required: `[{ criterion, response, claim_state, fit, evidence_strength }]`
Library: Custom table

### `sankey`
Use when: data contains source → target → value triples representing funding flows.
Required: `[{ source, target, value }]`
Requires ≥ 3 distinct sources/targets and ≥ 6 total relationships.
Do not use for fewer relationships — a table is cleaner.
Library: ECharts

### `scatter`
Use when: two quantitative variables are both meaningful and a correlation or
cluster pattern is the finding.
Required: `[{ label, x, y }]` ≥ 15 data points for meaningful scatter.
Atlas use case: gap severity (x) × effort to close (y).
Library: ECharts

### `bar`
Default for categorical comparison when no specialist block applies.
Use horizontal bars when category labels are long. Always start at zero.
Maximum 12 bars.
Library: Recharts

### `area_line`
Use only when data has a genuine time dimension (year, quarter, month) and
trend direction is the point. Do not use area for proportions.
Library: Recharts

---

## Conflict Resolution — When Two Blocks Could Apply

**`domain_heatmap` vs `knowledge_graph`:**
Use heatmap when evidence density is the finding (how much exists per domain).
Use knowledge graph when relationships are the finding (who connects to whom).
They answer different questions. If unsure, heatmap is cheaper to read and
easier to parse at a glance. Never use both in the same response unless the
corpus is rich enough to justify two dominant visuals.

**`evidence_bar` vs `options_comparison`:**
Use options_comparison when strategic choice is the point (2–5 pathways with
attributes to compare). Use evidence_bar when relative ranking by score is the
point. Never use both for the same data in the same response.

**`radar` vs `bar` for Five Case:**
Radar is reserved exclusively for Five Case five-pillar scoring. A bar chart
comparing Five Case sections is never correct — use radar or prose.

**`gap_matrix` vs `scatter` (Diagnose):**
Gap_matrix is always the primary block for Diagnose intent. Add scatter only
when ≥ 5 gaps have both severity AND effort data — it shows the priority
quadrant. Never use scatter as the primary block for Diagnose intent.

**`sankey` vs `evidence_bar` for funding flows:**
Use Sankey when the flow between source and destination IS the finding. Use
evidence_bar when the amount per funder is the finding. Sankey requires directed
relationships; evidence_bar just requires a ranking.

---

## Charts to Avoid

**Pie and donut charts:** Angle perception is inaccurate. A horizontal bar chart
always communicates proportional comparison more clearly. Donut acceptable only
for a single summary metric with ≤ 2 categories.

**3D charts of any kind:** They distort magnitude. Never use.

**Dual y-axis charts:** They imply a relationship that may not exist.
Use two separate charts instead.

**Line charts for non-time data:** Lines imply continuity. Only use for genuine
time series.

---

## Colour Encoding — Atlas System (do not override)

### Confidence tier palette
Confidence tier colours encode epistemic status and apply to the entire
response container — not just badges.

```
Speculative  → slate/zinc palette  |  opacity-60  |  dotted borders
Indicative   → amber palette       |  opacity-75  |  dashed borders
Supported    → blue palette        |  opacity-90  |  solid borders
Robust       → emerald palette     |  opacity-100 |  solid borders, bold
```

A Speculative response looks lighter and more tentative than a Robust one.
Speculative or Indicative tier requires a caveat in text — not just a badge.

### Claim state palette

```
✓ stated    → teal     (directly extracted, cited source)
~ inferred  → amber    (agent-derived, tooltip shows rationale)
? unknown   → grey     (no data found — show the gap, do not hide it)
⚠ contested → red-amber (sources conflict, tooltip shows both)
```

Never show evidence without its claim state.

### Evidence density in heatmaps

```
High (≥ 6 items) → blue-600 / teal-600
Medium (3–5)     → zinc-500
Low (1–2)        → zinc-300
None (0)         → hollow cell, labelled "sparse"
```

Absence is signal. Never fill empty cells. Show them hollow.

### General rules

- Use ≤ 6 colours in any single chart
- Sequential scales for quantitative data (more = darker)
- Categorical scales for unrelated discrete categories
- Do not apply colour to decorate. Colour encodes meaning.

---

## Design Constraints

**Data-ink ratio:** Remove gridlines unless they serve a specific reference
purpose. Remove background fills from chart areas. Every pixel that does not
encode data should be questioned.

**Labels over legends where possible:** Direct labelling reduces eye travel.
Use a legend only when direct labelling creates clutter.

**Titles state the insight, not the chart type:**
Correct: "CPC's evidence is thin in aviation and digital products"
Incorrect: "Evidence density by domain"
The title is the conclusion. The chart is the evidence for it.

**Axes must be honest:** Y-axis starts at zero for bar charts unless showing
deviation from a baseline (which must be explicitly labelled).

**Tooltips add information, not repeat it:** Tooltips show: precise value,
source (if applicable), one contextual datum.

**Tables beat charts when exact values matter:** Use a chart only when the
pattern, trend, or shape is the point.

---

## Atlas 5 Conventions

**Recommendation card always first:** When `recommendation_action` is set in
state, it renders as the topmost visible element — before any chart.

**Citation count is always shown:** Every visual response shows the source
count. "Based on 8 verified sources" builds trust.

**Verified citations only:** Do not include any project in a visual block that
was not verified in `verify_citations`. Unverified IDs are excluded from all
chart data.

**Three risks are always separate:** Evidence risk, Fit risk, and Entry risk
must be shown as three distinct indicators. Never collapse into a single score.

**Sparse is signal — show it:** When corpus has no coverage for a domain:
- In heatmaps: hollow cell labelled "sparse — 0 projects"
- In evidence lists: explicit row "No corpus evidence found for [domain]"
Do not hide absences.

**Confidence ceiling rule:** A chart can never imply higher confidence than
the response tier allows. A Speculative response showing precise NPV figures
must carry "ASSUMPTION:" labels on every quantified bar.

**CPC-inward vs outward framing:**
For CPC-inward queries: dominant visual shows CPC's evidence strength.
For outward queries: dominant visual shows the external landscape.
These require different visual treatments. Do not conflate them.

**Entry friction tags render as chips/badges, not charts.** Do not visualise
a list of tags as a bar chart. Tags are categorical labels, not values.

**Progressive disclosure is mandatory for long responses:** Above the fold:
verdict + dominant visual only. Everything else is collapsed by default.

---

## Default Visual Per Surface Intent

These are the art director's starting assumptions per recipe intent.
Override only when the data shape demands a different block.

```
orient    → domain_heatmap   (if ≥3 domains with evidence counts)
              knowledge_graph (if cluster relationships are the finding, ≥6 sources)
              fallback:        evidence_bar ranked by similarity score

connect   → options_comparison (always, if ≥2 options exist)
              supporting:       evidence_bar (secondary, collapsible)

diagnose  → gap_matrix       (always — the primary block for this intent)
              supporting:      scatter (severity × effort if ≥5 gaps)

five_case → radar            (five pillars, always)
              supporting:      npv_waterfall (if npv_value is set)

defend    → evidence_bar     (claims sorted by confidence tier, descending)
              no chart required if evidence is thin — prose only is correct
```

The dominant visual for each intent is fixed unless the data does not meet the
minimum required for that block. Fall back to the next option listed.
Never force a chart when the data is insufficient.

---

## Source References

General principles derived from:
- IBM Carbon Design System: carbondesignsystem.com/data-visualization
- Cleveland & McGill (1984) "Graphical Perception" — encoding hierarchy
- Tufte, E.R. "The Visual Display of Quantitative Information"

Atlas-specific rules (confidence tiers, claim states, three-risk separation,
sparse-as-signal, CPC-inward framing) derived from Atlas v5 North Star.
