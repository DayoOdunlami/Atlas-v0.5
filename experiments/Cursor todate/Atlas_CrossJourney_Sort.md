# Atlas v5 — Cross-Journey Sort
### What every instrument across 16 turns becomes in the real app: spine component · recipe · GenUI · skill

Derived from the 16 built Direction-A turns (J1 rail-decarb, J2 Green Book, J3 comparison, J4 network) plus the standalone hand-SVG-vs-ECharts comparison. Classification is by **measured recurrence**, not taste: a thing is a *recipe* only if its shape recurred across turns; *spine* only if it appeared in (near) every turn; *GenUI* if it was bespoke to one answer; *skill* if it's a reasoning move, not a UI element.

**Decision locked this session: where a network/graph instrument is built, use ECharts `layout: 'none'` (never force-directed).**

---

## The recurrence evidence (what the files actually show)

| Element | J1 | J2 | J3 | J4 | Turns present | Verdict |
|---|---|---|---|---|---|---|
| **Confidence ceiling** (tier-derived cap) | ✓✓✓✓ | ✓✓✓✓ | ✓✓✓✓ | ✓✓✓✓ | **16/16** | SPINE |
| **So-what chat rail** (what you're looking at → one decision → gate) | ✓✓✓✓ | ✓✓✓✓ | ✓✓✓✓ | ✓✓✓✓ | **16/16** | SPINE |
| **Sentence-verdict hero** (Newsreader, nuance+condition) | ✓✓✓✓ | ✓✓✓✓ | ✓✓✓✓ | ✓✓✓✓ | **16/16** | SPINE |
| **Provenance-on-demand** (source + trust tier + caveat) | ✓ | ✓✓ | ✓ | ✓✓✓ | 8/16 (every turn that makes a sourced claim) | SPINE |
| **Blind-spot / AnswerabilityCard** (signed as under-count) | ✓✓✓ | ✓✓✓ | — | ✓✓✓✓ | 11/16 | SPINE (conditional) |
| **Carried-from-prior-turns trace** | T2-4 | T2-4 | T2-4 | T2-4 | 12/16 (every turn after T1) | SPINE |
| **Mode pips / ScopeBar** (Or·Cn·Dg·Ac·Df) | ✓ | — | — | ✓ | 4/16 (shell, present once per session) | SPINE (shell) |
| **Network map** (`graph`, `layout:'none'`) | T3 | — | — | T1,T2,T3,T4 | 5 turns, 2 journeys | RECIPE ✓ |
| **Two-tier / incommensurable magnitudes** | T1 | — | — | — | 1 turn | RECIPE (candidate) |
| **Value bridge / NPV waterfall** | — | T2 | — | — | 1 turn | RECIPE (candidate) |
| **Confidence-band (widen & drop)** | — | T2,T3 | — | — | 2 turns, 1 journey | RECIPE (candidate) |
| **Sensitivity-flip** (weight that flips the winner) | — | T2 | T3 | — | 2 turns, **2 journeys** | RECIPE ✓ |
| **Comparison matrix** (radar/heatmap small-multiples, "no single score") | — | — | T1,T2 | — | 2 turns, 1 journey | RECIPE (candidate) |
| **Claim ledger** (survive/concede under pressure) | T4 | — | T4 | — | 2 turns, **2 journeys** | RECIPE ✓ |
| **StatStrip** (3–4 glanceable numbers) | T1 | ✓ | ✓ | ✓ | ~8/16 | SPINE |
| **Recommendation / board one-pager** (Five Case skeleton) | — | T4 | T4 | T4 | 3 turns, 3 journeys | RECIPE ✓ |

---

## THE SORT

### 1 — SPINE COMPONENTS (build first, build real, must never silently fail)
These carry the trust contract. Every one appeared in nearly every turn. They are the moat made physical — if any goes missing or renders wrong, the product's "never show a claim without showing how much to trust it" promise breaks invisibly.

| Component | Interface (props) | Why spine |
|---|---|---|
| `ConfidenceCeiling` | `tier: Indicative\|Supported\|Robust`, `cappedReason` | 16/16. Position **computed from tier**, not decoration. Physically caps canvas. |
| `SoWhatRail` | `looking_at`, `one_decision`, `gate`, `turn: n/of` | 16/16. The chat side of the canvas/chat split. Never duplicates canvas. |
| `VerdictHero` | `sentence`, `tier`, `evolvesFromPrev?` | 16/16. Full sentence carrying nuance + condition. Newsreader. |
| `ProvenanceTrace` | `claim_id`, `source: corpus\|web`, `trust`, `caveat` | The peel-open trust layer. Corpus=solid green, web=dashed blue — material state. |
| `AnswerabilityCard` | `gap`, `sign: undercount\|absence`, `closable_by` | The blind-spot, signed correctly. Sits by the verdict, not in a footer. |
| `CarriedTrace` | `from_turns: []`, `summary` | Proves accretion, not re-derivation. Every turn after T1. |
| `StatStrip` | `stats: [{value,label,tone}]` | The fix for "everything reads as flat prose." |
| `ScopeBar` / mode pips | `object`, `scope`, `mode`, `tier` | The shell. One slim rail (merged from the old two headers). |

**These are NOT parameterised-per-question. They are fixed contracts. Build them once, correctly, and the brain fills their props.**

---

### 2 — RECIPES (named compositions; recurrence-confirmed; build as parameterised)
A recipe fires for a *class* of question. Only the ones that recurred across **2+ journeys** are confirmed; single-journey ones are candidates held until a second class needs them.

**Confirmed (recurred across journeys):**

- **`NetworkMap`** — *5 turns, 2 journeys.* The strongest recurrence in the set. **ECharts `type:'graph'`, `layout:'none'`, roam on, edge-width ∝ weight, provenance-in-tooltip.** Honest-degradation ladder built in: corpus edges solid green, web edges dashed blue, absent nodes dotted/ghost, density never faked. *Slots:* `nodes[], links[], egoCentre?, layoutCoords (computed, not physics)`.
- **`SensitivityFlip`** — *2 journeys (J2 T2, J3 T3).* "Find the one weight that flips the winner." *Slots:* `options[], weightAxis, flipPoint, winnerBelow, winnerAbove`. This is the move that refuses a rigged composite.
- **`ClaimLedger`** — *2 journeys (J1 T4, J3 T4).* Verdict under pressure: which claims survive, which concede. *Slots:* `claims[]{text, survives:bool, concession?}`.
- **`RecommendationCard`** — *3 journeys (J2/J3/J4 T4).* The board one-pager; Five Case Model as skeleton. *Slots:* `verdict, cases[], primaryAction, gate`.

**Candidates (one journey only — build when a second class demands them):**

- **`IncommensurableMagnitudes`** (J1 T1, the two-tier field) — *strong candidate.* Recurs conceptually (corpus-vs-web, SME-vs-total) but only built once. **Carry forward the Turn-1 fix: never label "to scale" unless geometry is computed; use a labelled broken axis.** *Slots:* `upper, lower, ratio, brokenAxisAt, blindSpotAnnotation`.
- **`ValueBridge`** (J2 T2, NPV waterfall) — Green-Book-specific so far. *Slots:* `start, deltas[], end, switchingValue`.
- **`ComparisonMatrix`** (J3 T1-2, radar/heatmap, "no single score") — comparison-specific so far. *Slots:* `options[], criteria[], scores[][], refusedComposite:true`.
- **`ConfidenceBand`** (J2 T2-3) — could fold into `SensitivityFlip` or `RecommendationCard` rather than stand alone.

---

### 3 — GenUI (connective tissue; model composes live within guardrails)
Not built as components. The brain writes these per-answer inside the design system's rules.

- The connective prose between instruments ("What you're looking at", the reasoning that links data points).
- One-off framings: J4's side-by-side "corpus-only vs web-corrected" two-panel (bespoke to the correction story — though if "two readings of one dataset" recurs, promote it).
- The "non-obvious reading" / "the fair case for each loser" prose blocks.
- Any answer whose shape no recipe covers.

**Guardrail:** GenUI may compose freely *but must draw its trust elements from the spine components above* — it never hand-rolls a provenance badge or a confidence cap.

---

### 4 — SKILL (reasoning moves; already captured; NOT UI)
These produced the quality. They live in `atlas-answer-quality-SKILL.md`, not the codebase. The mocks are evidence the skill works — every strong H1 is a skill rule surfaced.

- "A single source can be fluent, coherent, and wrong" → ground from both sources; web mandatory for relationship questions.
- "Sign the gap as under-count, not absence" → the TRIG/blind-spot rule.
- "Never a bare point estimate — give the switching value" → refuse rigged composites.
- "Don't defend the ranking, find the weight that flips it" → comparison discipline.
- "The verdict concedes its own shape" → the defend-turn honesty.
- Instrument **selection** itself (which shape fits this question) is a skill decision, executed by the brain, *then* plated by a recipe/component.

---

## Build order for the agent (dependency-correct)

1. **Undo stack first** (global, before any mutating UI).
2. **Spine components** — `ConfidenceCeiling`, `ProvenanceTrace`, `VerdictHero`, `SoWhatRail`, `StatStrip`, `AnswerabilityCard`, `CarriedTrace`, `ScopeBar`. These unblock everything.
3. **Confirmed recipes** — `NetworkMap` (ECharts `layout:'none'`), `SensitivityFlip`, `ClaimLedger`, `RecommendationCard`.
4. **Wire the brain's answer-spec → render layer** — brain emits {verdict, tier, instrument-choice, claims[]}; render layer maps to spine + recipe + GenUI.
5. **Candidate recipes** only when a second journey-class calls for them.

## Two hard rules for the handoff (the "don't lift the prototype" guards)
- **Strip the `DCLogic` / `x-dc` / `{{ }}` harness.** It is Claude Design's runtime, not yours. From the ECharts file, lift only the **`series` option object + `layout:'none'` + tooltip formatter + the `_tryInit` resize/availability guard pattern** into a real React/ECharts component. The wrapper does not port.
- **Parameterise, don't copy literals.** Every `£8.2m`, `121 · 0.80`, node coordinate is a prop bound to a live query — not a constant. The `.dc.html` is the *picture of done*, never the source.

## ECharts decision (locked)
Adopt ECharts for graph instruments, always `layout: 'none'`. Per the hand-SVG-vs-ECharts comparison file, the library earns its weight via: edge-width-bound-to-data, hover-provenance, zoom/pan. Below ~6 nodes a hand-SVG is equally honest and lighter, but standardising on ECharts `layout:'none'` removes the per-instrument decision and gives one consistent, data-bound graph path. Force-directed (`graph` default / D3-force) stays off the table — it manufactures the false density the network journey exists to refuse.
