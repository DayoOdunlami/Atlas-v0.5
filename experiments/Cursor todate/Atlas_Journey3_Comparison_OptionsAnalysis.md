# Atlas — Journey 3: The Comparison (Options Analysis)
### Proof-of-format for "compare X vs Y vs Z" questions — built to Green Book options-analysis standard

Third worked journey. Where Journey 2 valued *one* option, this compares *several* — and the discipline that separates a world-class comparison from a feature-grid is the Green Book's **options framework**: always include do-nothing/do-minimum, score against explicit critical success factors, and resist collapsing multi-criteria reality into a single misleading number.

Same five-layer structure, same harmonised sourcing (`[S#]` corpus / `[W#]` web). The comparison data is real: four transport modes with genuinely different decarbonisation-funding profiles.

Persona: **a CPC portfolio lead deciding which transport mode to prioritise for a new decarbonisation innovation programme.**

---

## EXEC SUMMARY — the rules this journey establishes

1. **A comparison is not a table — it's a verdict that survives the reader checking your working.** The hero is still a recommendation ("prioritise X because—"); the matrix is the *evidence*, not the answer. A feature-grid with no verdict is abdication.
2. **Every option must be scored on the same explicit criteria, and the criteria must be named, not implied.** Green Book: critical success factors, stated up front. The reader must be able to disagree with a *score*, which means they must see the *axis*.
3. **Always include the do-nothing baseline.** A comparison of only the active options hides the most important question: is any of them better than not acting? (Here: "no new programme" is a real option.)
4. **The dimensions will disagree — that's the insight, not a problem to hide.** When option A wins on funding-maturity but option B wins on transferability, the honest answer surfaces the tension and says which criterion should dominate *and why*, rather than averaging them into a false ranking.
5. **A single composite score is dangerous and must be earned.** Weighted scoring is legitimate only if the weights are explicit and the sensitivity to those weights is shown. Otherwise rank on the dominant criterion and name it.
6. **Comparison has its own answer-shapes:** the scored matrix (heatmap), the radar (multi-criteria per option), and the ranked verdict. These are the ComparisonMatrix recipe — and like EconomicCase, it's a composition, not a single card.

---
---

# TURN 1 — ORIENT→FRAME THE OPTIONS
### *"We're launching a decarbonisation innovation programme. Which transport mode should we prioritise?"*

## Layer 1 — Answer

> **Before ranking anything: there are five options here, not four — and naming the fifth changes the conversation.** The obvious framing is "rail vs maritime vs aviation vs highways." But the Green Book discipline forces a fifth: **do nothing new** — i.e. keep CPC's effort spread rather than concentrating it in one mode. That baseline matters because the whole premise ("prioritise one mode") is only worth it if focusing beats spreading. I'll carry it through as the comparator.

**The four active options have sharply different shapes — and the corpus reveals it immediately.** These aren't four versions of the same thing; they're structurally different bets `[S1]`:

| Mode | Projects | Total £ | **Avg grant** | Live since 2024 | Orgs |
|---|---|---|---|---|---|
| Highways & Integrated | 205 | £136.3m | £940k | 72 | 127 |
| Aviation | 73 | £47.4m | £1.22m | 45 | 37 |
| Maritime | 38 | £46.8m | **£1.73m** | 19 | 26 |
| Rail | 55 | £8.2m | **£221k** | 27 | 30 |

**The non-obvious reading — and this is what a feature-grid would miss.** The modes don't just differ in *size*; they differ in *funding structure*. Maritime runs the **fewest, biggest bets** (£1.73m average — large consolidated projects), while rail runs **many tiny ones** (£221k average — fragmented pilots). Highways is the **broad incumbent** (205 projects, 127 orgs — a crowded mature field). Aviation sits between, with large grants but a concentrated org base (37 orgs). So "which mode" is really "which *funding structure* fits CPC's role" — and that reframing is the actual decision.

**The criteria this comparison must score on (named up front, per Green Book CSFs):** (1) *policy-driver strength* — how hard is the regulatory forcing function; (2) *funding maturity* — is the field consolidated or fragmented; (3) *crowding* — is there room for CPC to add value or is it saturated; (4) *transferability* — does proof in this mode travel to others; (5) *CPC strategic fit*. Turn 2 scores all five options against these. *Confidence: Supported — the structural data is hard corpus fact; the scoring in T2 mixes corpus + web + judgement.*

## Layer 2 — Citations
| Marker | Source | Class | Trust note |
|---|---|---|---|
| S1 | `atlas.projects`, decarbonisation, by mode | Corpus | High; real counts, funding, recency |

## Layer 3 — Data appendix
```
Mode profiles (decarbonisation projects):
  Highways: 205 proj, £136.3m, avg £940k, 72 live, 127 orgs   → broad incumbent
  Aviation:  73 proj, £47.4m,  avg £1.22m, 45 live,  37 orgs   → large grants, concentrated
  Maritime:  38 proj, £46.8m,  avg £1.73m, 19 live,  26 orgs   → few big bets
  Rail:      55 proj, £8.2m,   avg £221k,  27 live,  30 orgs   → many small pilots
  [Option 5: "no new programme / stay spread" — the do-nothing baseline]
```

## Layer 4 — Search-sufficiency trace
| Anticipated shape | Query | Came back | Verdict | Final shape |
|---|---|---|---|---|
| **Comparison matrix** (modes × metrics) | Supabase grouped aggregate | 4 modes, 6 clean metrics each | ✅ Honoured | ComparisonMatrix |
| **Funding-structure insight** | (derived from avg-grant column) | Sharp divergence (£221k vs £1.73m) | ✨ Richer-shape-available — the avg-grant column carries an insight the raw counts don't | Highlighted in matrix |
| **The do-nothing option** | — | Not in data; *added by method* | ✅ Green Book discipline | Carried as comparator |

**Incompleteness:** none material at this framing stage. **Patchy-data move:** n/a — corpus fully honours the framing. The *method* adds the do-nothing option the data can't supply.

## Layer 5 — Component sort
- **The five-options framing + criteria list:** → prose / GenUI. This is the reasoning that makes the comparison honest; it has no fixed shape.
- **The mode-profile matrix:** → `ComparisonMatrix` — but at this turn it's *descriptive* (raw metrics). The *scored* version comes in T2.
- **The funding-structure insight:** → a callout, not a chart. It's a one-sentence reframe that the matrix supports.

---
---

# TURN 2 — DIAGNOSE→SCORE THE OPTIONS
### *"Score them properly. Which actually wins?"*

## Layer 1 — Answer

> **On the dominant criterion — room for CPC to add distinctive value — maritime wins. But it's a genuine multi-criteria call, and the criteria disagree, so here's the honest scoring rather than a single rigged number.**

**The scored matrix (each option rated against the five named criteria, Low/Med/High):**

| Criterion | Highways | Aviation | **Maritime** | Rail | Do-nothing |
|---|---|---|---|---|---|
| Policy-driver strength | Med (EV mandates) `[W-rail]` | **High** (SAF mandate, ETS free-allowances gone 2026) `[W1]` | **High** (maritime ETS from 2026, UK SHORE £236m) `[W2]` | Med-High (2040 diesel ban, but stop-start funding) `[W3]` | n/a |
| Funding maturity | High (consolidated, £940k avg) | High (£1.22m avg) | High (£1.73m avg — biggest bets) | **Low** (£221k, fragmented) | n/a |
| Room to add value (un-crowding) | **Low** (205 proj, 127 orgs — saturated) | Med (37 orgs) | **High** (38 proj, 26 orgs — thin) `[S1]` | Med-High (small money, room) | n/a |
| Transferability (proof travels) | High (337 bridges, the hub) `[S2]` | Med (109 bridges) | **High-quality** (86 bridges but 0.84 avg — fewest but strongest) `[S2]` | Med (141 bridges, 0.80) | n/a |
| CPC strategic fit | Med (incumbent, less differentiating) | Med (SAF is industry-led) | **High** (white-space + mandate + CPC maritime remit) | Med | Low |

**Reading the disagreement honestly.** Highways wins *funding maturity* and *raw transferability* but loses *room-to-add-value* badly — it's saturated, so CPC adds little. Aviation has the *hardest policy driver* but SAF is industry/fuel-producer-led, so CPC's convening role fits less well, and it's technically nascent/high-risk `[W4]`. **Maritime is the only option that scores High on the criterion that should dominate for an innovation accelerator — room to add distinctive value — while also clearing the policy-driver and transferability bars.** Its bridges are fewest but strongest (0.84) `[S2]`, meaning its proof transfers *well* even if narrowly.

**Why I'm not giving you a single weighted score.** I could multiply these into one number, but it would be rigged by my weight choices. The honest version: *if* CPC's role is "add distinctive value where the market is thin" (which is its mandate), then *room-to-add-value* is the dominant criterion, and maritime wins clearly. If the weight were instead on *funding maturity* or *raw scale*, highways would win — but that would be CPC competing in a crowded field, against its own differentiating purpose. **The ranking is maritime > rail > aviation > highways > do-nothing, conditional on the value-add weighting — and I'm naming the weighting so you can overrule it.** *Confidence: Supported, with the explicit caveat that the rank depends on the stated weighting.*

## Layer 2 — Citations
| Marker | Source | Class | Trust note |
|---|---|---|---|
| S1 | mode profiles (T1) | Corpus | HAVE |
| S2 | `atlas.cross_modal_bridges` per-mode totals + avg strength | Corpus | HAVE — Highways 337/0.81, Rail 141/0.80, Aviation 109/0.80, Maritime 86/0.84 |
| W1 | Aviation SAF mandate, ETS free-allowances end 2026 | Web | HAVE — strong driver, but industry-led |
| W2 | Maritime ETS 2026 + UK SHORE £236m | Web | HAVE |
| W3 | Rail 2040 diesel ban, stop-start funding risk | Web | HAVE (Journey 1 sources) |
| W4 | Aviation decarb "high risk, nascent tech" (CCC) | Web | HAVE — caveat on aviation |

## Layer 3 — Data appendix
```
Bridge connectivity (transferability criterion):
  Highways 337 bridges @ 0.81   Rail 141 @ 0.80   Aviation 109 @ 0.80   Maritime 86 @ 0.84
  → Maritime: fewest but strongest connections (quality over quantity)
Scoring weights (EXPLICIT, overrulable):
  dominant = "room to add value" (CPC mandate = act where market is thin)
  → under this weight: Maritime > Rail > Aviation > Highways > do-nothing
  → under "funding maturity/scale" weight: Highways would win (but contradicts CPC purpose)
```

## Layer 4 — Search-sufficiency trace
| Anticipated shape | Source | Result | Verdict | Final shape |
|---|---|---|---|---|
| **Scored matrix** (options × criteria) | corpus + web + judgement | Complete, every cell sourced | ✅ Honoured | ComparisonMatrix (heatmap) |
| **Radar per option** | same data, per-option view | 5 criteria × 5 options | ✅ Honoured | radar (small multiples) |
| **Single weighted score** | — | *Deliberately not produced* | ⚠️ **Refused-by-discipline** | Ranked verdict + explicit weight instead |

**Incompleteness:** *Judgement-laden* — some cells (strategic fit) are reasoned, not measured; flagged as such. **Patchy-data move:** **surface the weighting honestly** rather than hiding it in a composite — the anti-pattern the Green Book names ("cherry-picking to confirm a preferred answer") is avoided by making the weight overrulable.

## Layer 5 — Component sort (the ComparisonMatrix recipe)
- **The verdict + named weighting:** → `RecommendationConfidence` sentence variant. The *weighting statement* is part of the verdict — without it the rank is dishonest.
- **The scored matrix:** → **`ComparisonMatrix` as a heatmap** (`gap_matrix`/`options_comparison` recipe) — colour intensity = score. This is where the disagreement between criteria becomes *visible*: you can see maritime's row is green on value-add where highways is red.
- **Per-option profile:** → **`radar`** small-multiples (5 criteria per option) — lets the reader see each option's *shape*, not just its rank. Subtle, supporting — not dominant.
- **The refused composite score:** → deliberately absent; a `EvidenceStateSummary` note explains *why* (weighting transparency). This is a case where the world-class move is **not rendering** something the user might expect.

---
---

# TURN 3 — TRANSLATE→TEST THE RANKING
### *"How sensitive is 'maritime wins' to your assumptions? Convince me it's not just your weighting."*

## Layer 1 — Answer

> **It's robust to most re-weightings but not all — and the one weighting that flips it is itself the real strategic question.** This is the switching-value logic from the economic case, applied to a multi-criteria comparison: don't defend the rank, *find what would change it.*

**Where maritime's lead holds.** If you up-weight *policy-driver strength*, maritime stays top (its ETS driver ties aviation's and beats the rest) `[W1][W2]`. If you up-weight *transferability quality*, maritime stays top (highest bridge strength at 0.84) `[S2]`. If you up-weight *CPC strategic fit*, maritime stays top (white-space + mandate). So across three of the five criteria, maritime is stable.

**The one weighting that flips it.** If you up-weight **raw scale / funding maturity** — i.e. "go where the most money and activity already is" — then **highways wins decisively** (£136m, 205 projects, 127 orgs) `[S1]`. That's not a rounding flip; it's a complete reversal. So the entire decision reduces to one question: **is CPC's job to amplify where activity already concentrates, or to seed where it's thin?** Maritime wins under "seed thin"; highways wins under "amplify concentrated."

**The honest resolution.** This is a judgement, not a calculation, and it belongs to CPC's mandate, not to me. But the mandate is reasonably clear — an *innovation accelerator* exists to de-risk and seed emerging areas, which is the "seed thin" reading, under which maritime wins. If CPC were instead a *delivery body* scaling proven things, highways would win. **So the ranking is robust given CPC's actual role — and the one thing that would overturn it is a change in what CPC is for, which is above this decision's pay grade.** That's the most honest defence of a ranking: not "the number says so" but "it holds unless your identity changes." *Confidence: Supported — and explicitly conditional on the seed-vs-scale identity question.*

## Layer 2 — Citations
*(All markers as Turns 1–2; no new sources — sensitivity testing re-uses the scored matrix.)*

## Layer 3 — Data appendix
```
Sensitivity of the ranking to criterion weighting:
  up-weight policy-driver     → Maritime holds
  up-weight transferability   → Maritime holds
  up-weight strategic fit     → Maritime holds
  up-weight raw scale/maturity → HIGHWAYS WINS  ← the only flip
Switching question: "seed thin areas" (maritime) vs "amplify concentrated activity" (highways)
  = CPC identity question, not a data question
```

## Layer 4 — Search-sufficiency trace
| Anticipated shape | Source | Result | Verdict | Final shape |
|---|---|---|---|---|
| **Sensitivity / switching analysis** | re-weight the T2 matrix | One clean flip identified | ✅ Honoured | sensitivity view (which weight flips the rank) |
| **New data** | — | None needed — re-uses scored matrix | ✨ Journey state re-use (as Journeys 1–2) | — |

**Incompleteness:** the flip-criterion (CPC identity) is *outside the data entirely* — correctly surfaced as a judgement, not faked. **Patchy-data move:** **escalate the gap to the decision-maker** — "this depends on what CPC is for, which is your call" — the honest ceiling of a data-driven comparison.

## Layer 5 — Component sort
- **The sensitivity result:** → a **focused sensitivity visual** — show the rank under each weighting, highlight the one flip. This is the comparison analogue of the tornado chart.
- **The "seed vs scale" question:** → prose / GenUI. It's the irreducible judgement; componentising it would trivialise it.
- **The conditional verdict:** → `RecommendationConfidence` with the identity-condition rendered *in* the verdict.

---
---

# TURN 4 — DEFEND→THE OPTIONS APPRAISAL SUMMARY
### *"Give me the one-pager for the investment board, including why we rejected the others."*

## Layer 1 — Answer

> **Recommendation: prioritise maritime decarbonisation for the new programme — and here is the full options appraisal, including honest reasons each alternative was rejected.** A world-class comparison defends its winner by *fairly* stating the case for the losers, not by strawmanning them.

**Preferred option — Maritime.** Wins on the criterion that matches CPC's mandate (room to add distinctive value in a thin field), while clearing the policy-driver bar (ETS from 2026 + UK SHORE £236m) `[W2]` and offering the highest-quality transferability (bridge strength 0.84) `[S2]`. Robust to all re-weightings except raw-scale.

**Rejected options — and the genuine case for each (then why not):**
- **Highways** — *Strongest case:* most activity, money and partners; lowest delivery risk; the hub of all cross-modal transfer (337 bridges) `[S2]`. *Why rejected:* saturated (205 projects, 127 orgs) — CPC would be adding marginal value to a crowded field, contradicting its seed-thin purpose. The strongest *alternative*, and the right choice if CPC's role were scaling not seeding.
- **Aviation** — *Strongest case:* hardest regulatory forcing function (SAF mandate, ETS free-allowances ending) `[W1]`. *Why rejected:* SAF is fuel-producer-led with a CfD-style revenue mechanism `[W1]` — the value-add sits with industry and DESNZ, not a convening accelerator; also CCC-rated high-risk/nascent `[W4]`.
- **Rail** — *Strongest case:* room to add value, real 2040 driver. *Why rejected:* funding is fragmented and stop-start `[W3]`, and the macro programme is electrification-capital-led (Network Rail) — less innovation-accelerator-shaped. A credible second choice.
- **Do-nothing (stay spread)** — *Strongest case:* preserves optionality, no concentration risk. *Why rejected:* the premise of the programme is that focus beats spread under a hardening policy environment; do-nothing forgoes the white-space first-mover advantage maritime offers.

**The board recommendation:** approve maritime as the priority mode, with rail as the named fallback, **explicitly conditional on confirming CPC's role as seed-thin rather than scale-concentrated** (the one assumption that would flip the rank to highways). Stage the commitment per the economic-case logic — anchor project first, programme expansion as an option. *Overall confidence: Supported, conditional on the seed-vs-scale identity confirmation.*

## Layer 2 — Citations
*(All markers as Turns 1–3; Defend re-uses accumulated evidence, no new searches.)*

## Layer 3 — Data appendix
```
Options Appraisal Summary (Green Book AST format):
  PREFERRED: Maritime — wins on value-add + policy + transfer-quality; robust except raw-scale
  ALT 1:     Highways — wins only under scale weighting (contradicts mandate)
  ALT 2:     Rail — credible fallback; fragmented funding
  ALT 3:     Aviation — strong driver but industry-led, high-risk
  BASELINE:  Do-nothing — forgoes white-space first-mover
  GATE: confirm CPC = seed-thin (not scale-concentrated) before commit
```

## Layer 4 — Search-sufficiency trace
| Anticipated shape | Source | Result | Verdict | Final shape |
|---|---|---|---|---|
| **Options Appraisal Summary Table** | reuse all turns | Complete with reject-reasons | ✅ Honoured | Green Book AST / ComparisonMatrix |
| **New searches** | — | None — full re-use of journey state | ✨ Confirmed pattern across all 3 journeys | — |

**Patchy-data move:** **condition the decision on the identity gate** — the seed-vs-scale question becomes an explicit board gate, not a hidden assumption.

## Layer 5 — Component sort
- **The options appraisal + reject-reasons:** → **`ComparisonMatrix` at full extension** = the Green Book Appraisal Summary Table, every option a column, the preferred one highlighted, reject-reasons as a row. The Snapshot/Brief freeze point.
- **Per-option verdict:** → small `RecommendationConfidence` per option (preferred / alt / rejected).
- **The identity gate:** → `ActionPlan` — one primary gated decision.
- **Whole turn:** → **Snapshot/Brief** — the board one-pager.

---
---

# What Journey 3 adds beyond Journeys 1–2

**It proves ComparisonMatrix is a recipe, not a card** — like EconomicCase. The full comparison = {sentence-verdict-with-named-weighting + scored heatmap matrix + radar small-multiples + sensitivity-flip view + Appraisal Summary Table}. Five visual recipes composed. Same finding as Journey 2: **recipe, fortified — not a thin card.**

**It establishes the single most transferable comparison rule:** *the dimensions will disagree, and the disagreement is the insight.* A world-class comparison doesn't average criteria into a false ranking — it surfaces which criterion dominates, names the weighting, and shows what re-weighting would flip the result. This is the comparison analogue of the economic case's switching value.

**It shows "not rendering" as a world-class move (Turn 2).** The refusal to emit a single composite score — and explaining why — is itself the quality signal. A junior tool computes the weighted average; a world-class one refuses and makes the weighting overrulable. The component sort has to allow *deliberate absence*, not just presence.

**It exercises the do-nothing discipline** — every prior journey had an implicit "act" framing; this one carries the Green Book baseline explicitly, which changes the answer (the do-nothing option forces the "focus vs spread" question that's actually central).

**The cross-journey pattern is now confirmed three times:**
- The reasoning skill (not components) carries the quality — the named weighting, the sensitivity flip, the fair case for rejected options are all *agent reasoning*, not block features.
- Defend/package re-uses accumulated journey state; no re-search.
- The hero verdict persists and evolves; supporting shapes swap per turn.
- The "big" recipes (EconomicCase, ComparisonMatrix) are compositions of 4–5 visual recipes — confirming they stay recipes but must be richly specced.

---

*Journey 3 complete. Comparison data real (corpus mode-profiles + bridge connectivity); strategic-fit scoring harmonised with live web policy sources. Next candidate: a network/ecosystem flow (NetworkMap at full density — the one shape still only rendered sparse) to complete coverage before the set becomes the answer-quality skill.*
