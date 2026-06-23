# Atlas — Journey 2: The Economic Case (Green Book / Five Case Model)
### Proof-of-format for value & appraisal questions — built to genuine HM Treasury standard

This is the second worked journey, deliberately the highest-rigour one: it exercises the **green-book skill** (Five Case Model, NPV at 3.5% STPR, optimism bias, switching values, the analogue method for partial evidence). It shows what "world-class" means when the outcome is an *investment decision*, not just a strategic orientation.

Same five-layer structure as Journey 1. Same harmonised sourcing (`[S#]` corpus / `[W#]` web). All NPV/BCR figures are **real arithmetic** computed in Python to the skill's parameters, not illustrative.

Persona: **a CPC strategist asked by a funder "is port shore-power decarbonisation worth backing, and what's it worth?"** — a value question that forces the economic case.

---

## EXEC SUMMARY — the rules this journey establishes

*(This is the part that becomes the skill. The detail below proves each rule.)*

1. **A value question changes the search before a word is written.** The economic case needs *cost analogues* and *benefit benchmarks* fetched up front — you cannot write an NPV from a strategic-orientation query. The skill's first move is "fetch the appraisal inputs," not "describe the field."
2. **Partial evidence is the normal case, and the analogue method is how you appraise anyway** — corpus projects supply cost-per-outcome; web benchmarks supply benefit values; the answer triangulates and *labels every input HAVE/PARTIAL/ASSUME.*
3. **Never a bare point estimate.** Every figure is Low/Central/High with a confidence tier and a switching value. "NPV £5.1m" alone is malpractice; "central +£5.1m, range −£8.8m to +£16.7m, turns negative below £160/tCO₂e, confidence Indicative" is the standard.
4. **The Five Case structure is the artifact's skeleton for value questions** — Strategic / Economic / Commercial / Financial / Management. Not Atlas's invented taxonomy; the Green Book's.
5. **The economic case has its own answer-shapes** — the NPV waterfall, the sensitivity tornado, the Appraisal Summary Table — that the 13 blocks don't natively carry. This is the EconomicCase *recipe* (not a 14th block), and it needs these visuals to be honest.
6. **Confidence caps flow from evidence triage, not vibes.** Cold value question on partial corpus evidence → caps at *Indicative*. It lifts to *Supported* only with named missing inputs (real cost data, measured baseline emissions).

---
---

# TURN 1 — ORIENT→STRATEGIC CASE
### *"Is port shore-power decarbonisation worth CPC backing? Make the case for change."*

## Layer 1 — Answer

> **Strategic case: strong and getting stronger — the policy tailwind is now a regulatory mandate.** Shore power (ships plugging into grid electricity at berth instead of burning fuel) sits exactly where a CPC innovation bet should: a real decarbonisation lever with a *hardening* policy driver and a thin-but-live corpus base.

**The case for change is no longer voluntary.** From 2026 the UK Emissions Trading Scheme extends to domestic maritime `[W1][W2]`, which means at-berth emissions acquire a *direct cost* to operators for the first time — the explanatory memorandum estimates a ~645,000 tCO₂e reduction across the appraisal period `[W2]`. The government's £236m UK SHORE programme is already funding demonstrators `[W3]`, and the Maritime Decarbonisation Strategy sets interim targets of 30% cuts by 2030 and 80% by 2040 `[W4]`. So the "business-as-usual" counterfactual — ports keep burning fuel at berth — is now a *financially penalised* position, not a neutral one. That is the strongest possible foundation for a strategic case: the do-nothing option actively loses money under the new ETS.

**The corpus confirms the innovation layer exists but is early.** CPC's corpus holds a cluster of real port/maritime decarbonisation projects — HydroPort (Portland Port, £629k, live to 2026), SUPPORTIVE port-side supercapacitors (£646k), HIMET hydrogen-maritime (£1.62m), under the large Belfast Harbour anchor (£33.1m) `[S1]`. These are small feasibility-and-pilot scale — the SME innovation tier, exactly as we'd expect ahead of a regulatory forcing function.

**Three Horizons framing (per the skill):** this is a **Horizon 2** bet — emerging, not core, not speculative. The technology works (Aberdeen has a live shore-power install `[W5]`); what's unproven is the *UK-wide commercial model*. That H2 classification shapes the economic case below: it warrants Real Options thinking (stage-gated) rather than a single upfront commitment. *Confidence: Supported — the strategic case rests on hard policy facts, not estimates.*

## Layer 2 — Citations

| Marker | Source | Class | Trust note |
|---|---|---|---|
| S1 | `atlas.projects`, maritime/port + decarbonisation, by funding | Corpus | High; real projects, real costs/dates |
| W1 | House of Lords Library — ETS maritime extension order 2026 | Web (parliament) | Authoritative, recent (Mar 2026) |
| W2 | Same — 645,000 tCO₂e appraisal-period estimate | Web (parliament) | Government's own impact assessment |
| W3 | GOV.UK — UK SHORE £236m programme | Web (gov.uk) | Primary |
| W4 | Protea / GOV.UK — Maritime Decarb Strategy 30%/80% targets | Web | Targets confirmed across two sources |
| W5 | Port of Aberdeen — live shore-power install, 60,000 tCO₂e/20yr | Web (port operator) | Primary; the key benefit analogue |

## Layer 3 — Data appendix
```
Corpus analogues (cost side):
  HydroPort (Portland Port)        £629k   2025→2026  live
  SUPPORTIVE port supercapacitors  £646k   2021→2022
  HIMET hydrogen-maritime          £1.62m  2021→2022
  Belfast "Return to Sailing"      £33.1m  2020→2026  (anchor, atypical scale)
Web benchmarks (benefit side):
  Aberdeen shore power: 60,000 tCO2e / 20yr = 3,000 tCO2e/yr  [the central benefit anchor]
  UK SHORE programme: £236m  |  ETS maritime from 2026  |  targets 30% by 2030, 80% by 2040
```

## Layer 4 — Search-sufficiency trace
| Anticipated shape | Query | Came back | Verdict | Final shape |
|---|---|---|---|---|
| **Policy-driver narrative** | web: maritime ETS, UK SHORE | Strong, recent | ✅ Honoured | Prose + citation badges |
| **Cost-analogue set** | Supabase port/maritime decarb by £ | 12 rows, real costs+durations | ✅ Honoured | Feeds economic case (T2) |
| **Benefit benchmark** | web: shore power tCO₂e value | Aberdeen 60k/20yr — *exactly* the per-year anchor needed | ✨ Richer-than-hoped | Central benefit input |

**Incompleteness:** *Partial* — corpus has costs but no benefit/emissions data (it's a funding corpus, not an outcomes corpus). **Patchy-data move:** the gap between "corpus has costs, web has benefits" is *resolved by harmonisation* — this is the analogue method in action, and it's only possible because both sources are queried.

## Layer 5 — Component sort
- **Strategic case verdict:** → `RecommendationConfidence` sentence variant.
- **Policy-driver facts:** → prose + citation badges (no corpus rows to chart; web-sourced).
- **Three Horizons classification:** → a small **labelled badge** (H2), not a block — it's one datum that frames everything downstream.
- **Corpus analogue list:** → `OpportunityList`, but here it's *feeding T2*, shown compactly.

---
---

# TURN 2 — DIAGNOSE→ECONOMIC CASE
### *"Put a number on it. What's the value-for-money case?"*

## Layer 1 — Answer

> **Indicative central NPV +£5.1m, BCR 1.66 — but it is genuinely marginal, and the honest headline is the switching value: the case collapses below a carbon price of ~£160/tCO₂e.** This is a *positive but conditional* economic case, and pretending otherwise would be the malpractice the Green Book warns against.

**How this is built (analogue method, because we have partial evidence).** No single corpus project gives a clean NPV, so the appraisal triangulates: *costs* from the corpus port-decarbonisation pilots (£0.6–1.6m band, scaled up to a real shore-power demonstrator) `[S1]`, *benefits* from the Aberdeen analogue (3,000 tCO₂e/yr) `[W5]` valued at DESNZ carbon values, plus an air-quality co-benefit for emissions near port populations `[W6]`. Every input is labelled below as HAVE / PARTIAL / ASSUME — nothing is smuggled in as fact.

**The appraisal (20-year life, 3.5% STPR, 44% optimism bias on capital at SOC stage):**

| Measure | Low | **Central** | High |
|---|---|---|---|
| Capital (post-optimism-bias) | £10.8m | **£5.76m** | £3.0m |
| Carbon + AQ benefit (£m/yr) | £0.30 | **£0.97** | £1.52 |
| **NPV (£m)** | **−8.8** | **+5.1** | **+16.7** |
| BCR | <1.0 | **1.66** | >2.5 |

**What the numbers actually say.** The central case clears the bar (BCR 1.66 > 1, NPV positive) `[CALC]`. But the range straddles zero — the Low case (high costs, low emissions saved) is firmly *negative*. And the **switching value is the real story**: NPV turns negative if the effective carbon price falls below ~£160/tCO₂e `[CALC]`. Since the new maritime ETS is precisely what puts a price on this carbon `[W1]`, **the economic case is effectively a bet on the ETS carbon price holding above £160** — which is a policy-risk bet, not a technology bet.

**The Green Book reading:** this is a *legitimate SOC-stage case to proceed to OBC* — positive central NPV, honest downside, a clear switching value to monitor. It is **not** a case for unconditional full commitment. Per the Three Horizons H2 classification, the right structure is **Real Options / stage-gated**: fund the feasibility+demonstrator, treat the full rollout as an *option* exercised only if the ETS price and measured emissions savings land above the switching value. *Confidence: Indicative — partial evidence, central estimate rests on one benefit analogue and assumed carbon values. Would lift to Supported with: measured baseline at-berth emissions for the target port, and firm capital quotes.*

## Layer 2 — Citations

| Marker | Source | Class | Trust note |
|---|---|---|---|
| S1 | corpus cost analogues (T1 appendix) | Corpus | HAVE — real costs |
| W5 | Aberdeen 3,000 tCO₂e/yr | Web | PARTIAL — one analogue, transferred |
| W6 | UK maritime decarb consultation — at-berth AQ benefits near populations | Web (gov.uk) | PARTIAL — qualitative, monetised by assumption |
| W1 | maritime ETS (carbon price mechanism) | Web | HAVE — policy fact |
| CALC | Python NPV at skill parameters (3.5% STPR, 44% OB, 20yr) | Computed | Arithmetic is exact; *inputs* are Indicative |

## Layer 3 — Data appendix (the evidence triage — the heart of Green Book honesty)
```
INPUT                          STATUS      SOURCE / BASIS
Capital cost band              PARTIAL     corpus pilots £0.6-1.6m, scaled to shore-power demonstrator
Optimism bias 44%              HAVE        Green Book SOC-stage standard works upper
O&M £0.15m/yr                  ASSUME      proportion of capital, no corpus data
Emissions saved 3,000 t/yr     PARTIAL     Aberdeen analogue (60,000/20yr), transferred
Carbon value £250/t central    ASSUME      DESNZ carbon values band (indicative flat proxy)
Air-quality co-benefit +30%    ASSUME      Green Book damage-cost convention, indicative
Discount rate 3.5%             HAVE        Green Book STPR
Project life 20yr              HAVE        matches Aberdeen analogue horizon

COMPUTED (exact arithmetic on above):
  NPV central +£5.12m | Low −£8.77m | High +£16.68m
  BCR central 1.66
  Switching value: NPV=0 at ~£160/tCO2e
```

## Layer 4 — Search-sufficiency trace
| Anticipated shape | Query/compute | Result | Verdict | Final shape |
|---|---|---|---|---|
| **NPV waterfall** | Python on triaged inputs | Clean central + range | ✅ Honoured | npv_waterfall recipe |
| **Sensitivity tornado** | switching value calc | One dominant lever (carbon price) | ✅ Honoured — and reveals carbon price is *the* swing factor | sensitivity_tornado recipe |
| **Appraisal Summary Table** | Low/Central/High assembly | Complete | ✅ Honoured | AST recipe |
| **Per-input provenance** | evidence triage | Mix of HAVE/PARTIAL/ASSUME | ✅ Honoured | assumptions_ledger recipe |

**Incompleteness:** *Partial* throughout — this is the normal CPC case the skill is built for. **Patchy-data move:** **analogue method + Low/Central/High + switching value** — appraise honestly under partial evidence rather than refusing or faking precision. *Extrapolation is used here — but explicitly flagged* (carbon value, O&M are ASSUME), which is the only legitimate use.

## Layer 5 — Component sort (the EconomicCase recipe, in full)
This is the turn that proves EconomicCase is a **rich recipe, not a generic card** — and why it needs visuals the 13 blocks don't carry:
- **The verdict + switching-value headline:** → `RecommendationConfidence` sentence variant. The switching value *is* the verdict here.
- **NPV Low/Central/High:** → **`npv_waterfall`** visual (from `/lab/visualisation`) — shows how capital, carbon benefit, AQ benefit build to net NPV. Prose alone buries this.
- **Sensitivity:** → **`sensitivity_tornado`** — and critically it shows carbon price as the dominant bar, which *is* the insight. This visual earns dominant placement because the whole case hinges on it.
- **The Low/Central/High table:** → **Appraisal Summary Table** (Green Book standard format) — a structured table, not prose.
- **Evidence triage (HAVE/PARTIAL/ASSUME):** → **`assumptions_ledger`** — this is the moat made visible: every number shows its provenance and status. Renders near the figures, not as a footer.
- **Confidence cap + what-lifts-it:** → `EvidenceStateSummary` confidence-cap variant, inline.

**The finding:** EconomicCase composed of {sentence-verdict + npv_waterfall + sensitivity_tornado + AST + assumptions_ledger + confidence-cap} is a *recipe over five existing visual recipes* — which is exactly why it should stay a recipe, not become a 14th block. But the recipe must be specced this richly or it collapses into a thin card that can't carry Green Book weight. **This resolves the divergence from the two discovery passes: recipe, yes — but fortified, not lightweight.**

---
---

# TURN 3 — TRANSLATE→TRANSFERABILITY (the analogue method's hardest case)
### *"We have evidence this works at Aberdeen. Does that value transfer to a smaller English port?"*

## Layer 1 — Answer

> **Partially — and the transfer is honest only if you adjust for three named differences and widen the confidence band.** This is exactly the "value translation across contexts" question that is Atlas's core differentiator, and the disciplined answer is neither "yes it transfers" nor "no it doesn't" — it's "here is what survives the move and what doesn't."

**What transfers cleanly.** The *technology* and the *per-unit physics* transfer — shore power cuts at-berth fuel burn the same way in Aberdeen or Portsmouth `[W5]`. The carbon-pricing driver is national, so the ETS benefit applies identically `[W1]`. These are HAVE-grade transfers.

**What needs adjustment (the analogue-method core).** Three differences must be priced in before the Aberdeen NPV can be claimed elsewhere:
1. **Vessel call volume** — Aberdeen is a high-traffic energy port; a smaller port has fewer ship-hours at berth, so the 3,000 tCO₂e/yr benefit *scales down with traffic*. This is the single biggest adjustment and it can swing the case below the switching value.
2. **Grid connection cost** — capital depends heavily on local grid capacity; a port far from sufficient grid infrastructure faces materially higher connection costs, pushing the Low case more negative.
3. **Berth electrification compatibility** — the vessel mix matters; ports serving vessels that can't take shore power get less benefit per £ spent.

**The translated verdict.** The Aberdeen analogue establishes that shore power *can* clear the bar — but transferring its specific NPV to a smaller port without adjusting for call volume and grid cost would be the "cherry-picking analogues" anti-pattern. The honest transferred estimate is *wider and lower-confidence*: a smaller port's central NPV could plausibly sit anywhere from modestly negative to modestly positive depending on traffic, which means **the transferability answer is itself a recommendation to measure the target port's call volume and grid cost before committing** — those two numbers determine which side of the switching value it lands. *Confidence: Indicative, and explicitly lower than the Aberdeen-specific case — transferred evidence cannot exceed the confidence of its weakest adjustment.*

## Layer 2 — Citations
| Marker | Source | Class | Trust note |
|---|---|---|---|
| W5 | Aberdeen analogue | Web | The source case being transferred |
| W1 | ETS national driver | Web | Transfers cleanly (national) |
| (adjustments) | analogue_method.md reasoning | Skill/method | Named adjustments, not data — flagged as method-derived |

## Layer 3 — Data appendix
```
Transfer ledger (analogue method):
  Technology physics      → TRANSFERS (HAVE)
  ETS carbon driver       → TRANSFERS (HAVE, national)
  Benefit magnitude       → ADJUST DOWN by call-volume ratio (PARTIAL — target port volume unknown)
  Capital cost            → ADJUST UP by grid-distance (PARTIAL — target grid unknown)
  Vessel compatibility    → ADJUST by berth mix (MISSING — needs target port data)
Result: transferred NPV band wider & lower-confidence than source; sign depends on 2 unmeasured inputs.
```

## Layer 4 — Search-sufficiency trace
| Anticipated shape | Source | Result | Verdict | Final shape |
|---|---|---|---|---|
| **Transfer/adjustment ledger** | analogue method over T2 + web | Three clear adjustments | ✅ Honoured | TransferLanes-style verdict (travels / needs reframing / needs evidence) |
| **Re-run NPV for target port** | — | **Cannot** — two key inputs MISSING for any specific small port | ❌ **Empty — declared** | Becomes a "measure these two things first" recommendation |

**Incompleteness:** *Missing* (target-port call volume, grid cost). **Patchy-data move:** **convert gap → recommendation** — "measure call volume and grid cost; those determine the sign." The gap *is* the actionable output.

## Layer 5 — Component sort
- **Transfer verdict:** → **`TransferLanes`** (travels-as-is / needs-reframing / not-credible-here / evidence-needed) — the exact block for this, and Journey 1 never exercised it. The three adjustments map to the four lanes.
- **The "measure these two first" output:** → `ActionPlan` one-primary-action variant.
- **Why confidence is lower than source:** → `EvidenceStateSummary` — "transferred evidence ≤ weakest adjustment" rendered as the cap reason.

---
---

# TURN 4 — DEFEND→FULL FIVE-CASE SNAPSHOT
### *"Give me the one-page business case I can put to the investment board."*

## Layer 1 — Answer

> **Strategic Outline Case: proceed to OBC, conditional and stage-gated.** Here is the proposal across all five cases, at SOC depth, honest about what each case can and cannot yet claim.

**Strategic Case** — *Strong.* The case for change is regulatory, not voluntary: maritime ETS from 2026 makes at-berth emissions a priced cost `[W1]`, against national targets of 30% by 2030 / 80% by 2040 `[W4]`. BAU (burn fuel at berth) is now a financially penalised counterfactual. Strategic fit with CPC's decarbonisation and maritime mandate is direct. Horizon 2.

**Economic Case** — *Positive but marginal.* Indicative central NPV **+£5.1m**, BCR **1.66** over 20 years at 3.5% STPR with 44% optimism bias `[CALC]`. Range −£8.8m to +£16.7m. **Switching value: NPV negative below ~£160/tCO₂e** — the case is a bet on the ETS carbon price. Confidence Indicative; lifts to Supported with measured baseline emissions and firm capital quotes.

**Commercial Case** — *Sketched (appropriate at SOC).* Delivery via a port-operator partnership on the UK SHORE / ZEVI model `[W3]`; the Aberdeen/PowerCon install is the proven commercial template `[W5]`. Procurement strategy to be developed at OBC.

**Financial Case** — *Affordable at demonstrator scale.* Capital £3–11m (post-OB band) is within UK SHORE's £236m programme envelope `[W3]`; this is an exchequer/grant-funded demonstrator, distinct from the whole-society NPV above. Funding route exists.

**Management Case** — *Stage-gated by design.* Per the H2 classification and Real Options logic: fund feasibility + demonstrator now, with the full rollout as an **option exercised only if** measured emissions and the ETS price clear the switching value. Innovation-accounting milestones (metered funding against validation gates), not upfront commitment. Benefit realisation measured via tCO₂e saved and at-berth air quality.

**The board recommendation:** approve SOC → OBC for a single demonstrator, with two explicit gates — (1) measure target-port call volume and grid cost (the transferability unknowns), (2) confirm ETS carbon price trajectory above £160/tCO₂e. Do not approve full rollout at this stage; the evidence supports an option, not a commitment. *Overall confidence: Indicative, conditional — which is the correct and honest status for an SOC on partial evidence.*

## Layer 2 — Citations
*(All markers as established in Turns 1–3: S1 corpus analogues; W1 ETS; W3 UK SHORE; W4 targets; W5 Aberdeen; CALC computed NPV. No new sources — Defend re-uses the journey's accumulated evidence.)*

## Layer 3 — Data appendix
```
Five Case completeness at SOC (per skill's SOC→OBC→FBC table):
  Strategic ~80% ✔  Economic ~40% (indicative NPV done) ✔  Commercial sketched ✔
  Financial outline ✔  Management stage-gate defined ✔
Gates to OBC: (1) target-port call volume + grid cost  (2) ETS price > £160/tCO2e switching value
```

## Layer 4 — Search-sufficiency trace
| Anticipated shape | Source | Result | Verdict | Final shape |
|---|---|---|---|---|
| **Five Case one-pager** | reuse all prior turns | Complete at SOC depth | ✅ Honoured | Five-Case structured brief |
| **New searches** | — | **None needed** — Defend/package re-uses accumulated journey state | ✨ Confirms Journey 1's finding | — |

**Patchy-data move:** **condition the decision on the gaps** — the two gates make the blind-spots into explicit decision gates, the highest-honesty move. **Confidence cap (Indicative) is load-bearing** — it's what makes "approve an option, not a commitment" the correct call.

## Layer 5 — Component sort
- **The five-case structure:** → **EconomicCase recipe at full extension** = the Five Case Model as the artifact skeleton, each case a section. This is the Snapshot/Brief freeze point.
- **Each case's verdict:** → small `RecommendationConfidence` per case (strong / marginal / sketched…).
- **The two gates:** → `ActionPlan` — two primary gated actions.
- **The whole turn:** → **Snapshot/Brief** — portable one-pager for the board. The journey's natural artifact output.

---
---

# What Journey 2 adds beyond Journey 1

**It proves the EconomicCase recipe must be rich.** Turn 2 shows EconomicCase = {sentence-verdict + npv_waterfall + sensitivity_tornado + AST + assumptions_ledger + confidence-cap}. That's a composition of five visual recipes — which is *why it stays a recipe, not a 14th block*, but also why it can't be lightweight. This settles the divergence between the two discovery passes: **recipe, fortified.**

**It exercises blocks Journey 1 didn't** — `TransferLanes` (Turn 3, the transferability lanes) and the Green Book Appraisal Summary Table (a structured-table shape). Coverage is widening as intended.

**It shows the search-changes-with-the-skill point concretely.** A value question fetches *cost analogues + benefit benchmarks* up front (Turn 1's appendix) — a completely different query plan from Journey 1's orientation search. The skill determines the search, exactly as predicted two turns back.

**The legitimate use of extrapolation appears** — carbon value and O&M are ASSUME-flagged inputs, used because the analogue method requires them, but never hidden. This is the one place extrapolation is allowed, and the assumptions_ledger is how it stays honest.

**Confidence discipline is visibly tighter** — every figure carries Low/Central/High + tier + switching value + what-lifts-it. This is the standard the agent must hit before rendering; no component produces it — the *reasoning* does.

---

*Journey 2 complete. NPV/BCR/switching values are real arithmetic (Python, Green Book parameters). All claims cited to corpus rows or web sources. Next candidate journeys: a comparison-heavy flow (ComparisonMatrix / options analysis) and a network/ecosystem flow (NetworkMap at full density) — to complete shape coverage before the set becomes the answer-quality skill.*
