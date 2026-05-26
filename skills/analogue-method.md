---
name: analogue-method
description: Patterns for sector transfer, opportunity matching, and benchmark reasoning. Used by CICERONE for passport transferability and by ATLAS for funding-call fit assessment. Apply when primary evidence is partial and comparable cases must fill the gap.
---

# analogue-method — transferability and opportunity matching

*Patterns for sector transfer, opportunity matching, and benchmark reasoning. Used heavily by CICERONE for passport transferability and by ATLAS for funding-call fit assessment.*

## When to use

- User asks: "This evidence is from sector A — what's it worth in sector B?"
- User asks: "Given this funding call, how good is the fit?"
- User asks: "How does this proposal compare to similar past projects?"
- User asks: "What's a realistic BCR / NPV / funding ask for this kind of project?"

In each case, primary evidence is partial. Analogue reasoning fills the gap by borrowing from comparable cases.

## Pattern 1 — Sector transfer

*Goal: estimate value of a piece of evidence (technology, capability, methodology) when applied to a different sector.*

### Steps

1. **Identify the transferable core.** What specifically is being transferred? Technology, methodology, evidence base, capability? Name it precisely.
2. **Identify the target sector.** What's its size, structure, regulatory regime, technology readiness baseline?
3. **Identify the adjustment factors.** What changes between source and target?
   - Regulatory (e.g. MARPOL for maritime vs RIS3 for rail)
   - Technical (e.g. marine-grade vs rail-grade equipment)
   - Operational (e.g. duty cycles, lifecycles)
   - Commercial (e.g. fleet ownership models, procurement cycles)
4. **Find at least one analogue.** Look in the corpus or public sources for a prior cross-sector transfer with similar structural features. Quote the cost/benefit adjustment factor from that analogue.
5. **Apply the adjustment with explicit ranges.** "Cost adjustment +30 to +60%; analogue source: [name]."
6. **State residual unknowns.** What aspects of the transfer have no analogue? Flag as ASSUME with named expert judgement.
7. **Output Low/Central/High triple with confidence tier.**

### Output structure

```markdown
## Transferability: [source sector] → [target sector]

**Transferable core:** [technology / methodology / evidence base], TRL [n], [cost] in [source] context.

**Adjustment factors:**
- Regulatory: [description]. Analogue: [source].
- Technical: [description].
- Operational: [description].
- Commercial: [description].

**Indicative transfer value:** Low £X.X m / Central £Y.Y m / High £Z.Z m
**Confidence:** [Speculative / Indicative / Supported / Robust]
**Transferability score:** [0–100] — numeric summary of transfer feasibility
```

## Pattern 2 — Opportunity matching (funding call fit)

*Goal: assess how well an organisation or proposal fits an open funding call.*

### Steps

1. **Decompose the call.** What's the funder looking for? Eligibility, themes, evidence requirements, deliverables, scale.
2. **Decompose the proposal/organisation.** What evidence does the user have? What gaps exist?
3. **Match each requirement to evidence status.**
   - HAVE: direct evidence in corpus or stated
   - PARTIAL: some evidence, gaps
   - MISSING: would need to be developed or assumed
4. **Identify analogue past wins.** Find 2–3 comparable funded projects (same scheme, similar scale, similar theme). What was their evidence base? Their funding amount? Their delivery model?
5. **Score fit qualitatively.** Strong / Moderate / Weak per requirement, with one-sentence justification each.
6. **Estimate plausible funding band.** Based on analogue past wins, what's the plausible ask range?
7. **Identify the critical gaps.** Which MISSING requirements are deal-breakers vs nice-to-haves?

### Output template

```markdown
## Funding fit: [proposal] ↔ [call]

**Overall fit:** [Strong / Moderate / Weak]
**Plausible funding band:** £X–£Y m, based on analogues [list]

### Requirement match

| Requirement | Evidence status | Fit | Notes |
| Theme alignment | HAVE | Strong | [evidence] |
| Technical readiness | PARTIAL | Moderate | [gap] |
| Consortium / partners | MISSING | Weak | [what's needed] |

### Critical gaps

1. [Gap] — [why deal-breaking or recoverable]

### Recommendation

[Pursue / Refine and pursue / Defer / Decline]
```

## Pattern 3 — Benchmark intervals

*Goal: place a specific estimate inside a plausible range from comparable cases.*

### Method

1. **Identify the project class.** Transport infrastructure? Innovation feasibility? Place-based regeneration?
2. **Look up published benchmark intervals.** DfT, Treasury, Innovate UK, and others publish portfolio averages.
3. **Place the estimate in the distribution.** Bottom quartile? Median? Top decile?
4. **Reason about the placement.**
5. **Output a brief plausibility check.**

### Published benchmark intervals (UK transport, indicative)

| Class | BCR low | BCR median | BCR high | Source |
|-------|---------|-----------|---------|--------|
| Strategic road | 1.5 | 2.4 | 3.5 | DfT analysis |
| Local transport | 2.0 | 3.0 | 4.0 | DfT analysis |
| Active travel | 5.0 | 13.0 | 20.0 | DfT analysis |
| Rail enhancement | 1.5 | 2.2 | 3.0 | DfT analysis |
| Light rail | 1.0 | 1.6 | 2.5 | NAO analysis |

Use as plausibility checks, not authorities. State the source whenever you cite them.

## Pattern 4 — Counterfactual triangulation

*Goal: estimate the value of an intervention by comparing against a plausible do-nothing trajectory.*

### Method

1. **Define the counterfactual.** What happens in the target context if the intervention doesn't occur?
2. **Quantify the counterfactual where possible.** Costs and benefits of the do-nothing path.
3. **Compute incremental value.** Intervention value minus counterfactual value.
4. **State sensitivity to the counterfactual.**

For passport transferability, the target sector may have its own decarbonisation pathway. The passport's value is the *acceleration* or *additional reduction* against that path, not the absolute reduction.

## Combining patterns

A realistic CPC question often needs more than one pattern:

**"What's the value of this passport applied to the upcoming Innovate UK SMART call for maritime decarbonisation?"**

Needs:
- Pattern 1 (sector transfer): rail → maritime
- Pattern 2 (opportunity matching): how well does the transferred evidence fit the SMART call's requirements
- Pattern 3 (benchmark interval): typical SMART award size for similar projects
- Pattern 4 (counterfactual): maritime baseline trajectory

Output should weave these into a single coherent assessment with one Low/Central/High triple and one confidence tier.

## CICERONE-specific: transferability_score

CICERONE must produce a numeric `transferability_score` (0–100) for every cross-sector assessment. Scoring rubric:

| Score range | Interpretation |
|-------------|---------------|
| 0–25 | Weak — significant regulatory, technical, or operational barriers; limited analogues |
| 26–50 | Partial — some analogues; notable adjustment factors; PARTIAL/MISSING evidence dominates |
| 51–75 | Moderate — defensible analogues; adjustments quantified; HAVE/PARTIAL evidence majority |
| 76–100 | Strong — multiple strong analogues; minimal adjustment; HAVE evidence dominates |

## Anti-patterns

1. **Borrowing analogues without naming them.** Always name the source analogue.
2. **One analogue treated as a rule.** Two or three analogues triangulate; one is anecdote.
3. **Ignoring adjustment factors.** A 1:1 transfer is rarely valid.
4. **Treating benchmarks as targets.**
5. **Skipping the counterfactual.** Value is the delta, not the absolute.
