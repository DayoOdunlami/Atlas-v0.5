# Surface Composition — Response Assembly Skill

## North Star

The user reaches the answer in under 3 seconds.
Everything else supports that answer — never competes with it.

This skill governs **how** content is arranged and written.
Chart selection is in `data-visualization.md` — do not duplicate those rules here.

---

## The Waterfall (mandatory order)

Every surface response assembles in this order:

```
1. headline          — one sentence, the verdict (REQUIRED, never a placeholder)
2. insight_card      — 2–3 sentences max; why the headline is true
3. dominant_visual   — one chart or table (from art director / visual_blocks)
4. supporting_body   — mode-specific sections (collapsed where possible)
5. evidence_strip    — citations collapsed: "8 verified sources →"
6. action            — one primary next step (workspace, not report)
```

Never render charts before the headline.
Never show the same table twice (gap matrix OR surface table, not both).

---

## Headline rules

The headline is a **verdict**, not a label.

Correct:
- "CPC should not bid until operational safety data exists for urban UAS."
- "The UK CAT landscape is active but CPC's evidence is thin in deployment trials."

Banned (never emit):
- "Diagnose surface — gap analysis in progress."
- "Innovation Landscape"
- "Evidence Gap & Value Translation Report"
- Any string containing "in progress" or the recipe name alone

Requirements:
- Max 30 words
- Active voice
- States what the user should believe or do
- Must appear in JSON field `headline` on every mode response

---

## insight_card

- Max 3 sentences
- Expands the headline with the single most important "because"
- No bullet lists
- Include confidence caveat when tier is Speculative or Indicative

---

## Chat vs artifact split

**Chat message (left panel):**
- Repeat the headline only
- One line: "{N} verified sources · {tier} · see artifact →"
- Optional: one suggested follow-up action
- Max 80 words total

**Artifact (right panel):**
- Full waterfall assembly
- All depth lives here

Never put the full gap matrix or Five Case sections in the chat stream.

---

## Progressive disclosure

Above the fold (always visible):
- headline + insight_card + dominant_visual

Below the fold (collapsed by default):
- supporting sections
- full evidence strip
- secondary visuals

Maximum 3 visual blocks per response.

---

## Mode-specific assembly

### Orient
- headline → terrain verdict
- dominant: domain_heatmap OR knowledge_graph (not both unless ≥8 sources)
- supporting: key players, CPC position (if lens=CPC)
- action: "Diagnose fit →" or "Find opportunities →"

### Connect
- headline → best opportunity route
- dominant: options_comparison OR evidence_bar for live calls
- action: "Diagnose fit for [call] →"

### Diagnose
- headline → apply / reposition / evidence-build verdict
- dominant: gap_matrix (structured gap_rows[], not prose)
- supporting: value translation, entry friction chips
- action: "Build Five Case for this →" (only when user may escalate to Act)

### Act
- headline → invest / defer / reject recommendation
- dominant: radar + npv_waterfall when NPV present
- Five Case sections collapsed except Strategic + Economic

### Defend
- headline → withstands / fails scrutiny verdict
- dominant: evidence_bar by confidence tier
- supporting: objections + responses

---

## Claim states in prose

Every evidence claim in insight_card or sections must carry its state inline:
- ✓ stated — directly cited
- ~ inferred — agent-derived (include brief rationale)
- ? unknown — no data
- ⚠ contested — sources disagree

Never hide uncertainty behind polished prose.

---

## Three risks (report separately)

Never collapse into one score:
- **Evidence risk** — is the claim proven?
- **Fit risk** — does the solution match the need?
- **Entry risk** — can the user access this opportunity?

Name each explicitly in Diagnose and Connect surfaces.

---

## JSON contract (required fields per mode)

All modes must emit in parsed JSON:

```json
{
  "headline": "string — required",
  "analysis": "string — insight_card body",
  "sections": { },
  "decision_spine": { "decision", "recommendation", "confidence_tier", "key_assumption", "next_action" },
  "corpus_citations": [ ],
  "confidence_tier": "Speculative|Indicative|Supported|Robust"
}
```

Diagnose additionally:
```json
{
  "evidence_gaps": [ ],
  "entry_friction_tags": [ ],
  "gap_rows": "derived from evidence_gaps by verify_citations — do not duplicate in prose"
}
```

---

## Title rules for visual blocks

Block titles state the **insight**, not the chart type.

Correct: "Safety case cannot be defended without operational trial data"
Incorrect: "Evidence density across 4 organisations"

The art director (`build_visual_blocks`) should receive insight titles from the headline where possible.
