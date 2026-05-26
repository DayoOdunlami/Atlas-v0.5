---
name: evidence-triage
description: Framework for valuing and reasoning under incomplete evidence. Used by all four Atlas 5 agents (ATLAS, JARVIS, CICERONE, HYVE). Apply whenever evidence is partial — partial passports, transferability questions, exploratory funding calls.
---

# evidence-triage — partial evidence, confidence, and indicative valuation

*Framework for valuing under incomplete evidence. Reads alongside `green-book.md`. Used heavily by CICERONE for passport transferability questions, by JARVIS for corpus evidence ranking, and by HYVE for climate risk assessments.*

## The HAVE / PARTIAL / MISSING / ASSUME framework

Before producing any valuation or assessment, categorise each required input. Be explicit about each.

**HAVE.** Direct, sourced evidence from the corpus, the user, a benchmark, or an authoritative document. Note the source.

**PARTIAL.** Some evidence but with gaps. E.g. "we know cost in Year 1 but not Years 2–10" or "we know unit cost but not volume."

**MISSING.** No evidence available. Must be either left out explicitly or assumed.

**ASSUME.** A defensible proxy or analogue is being used. Always paired with a named source for the proxy.

## Worked example — partial passport transferability

User asks: "This passport has evidence from a rail decarbonisation pilot — what could it be worth applied to maritime?"

### Step 1 — List required inputs for a valuation

For a transferability indicative value, you typically need:
- Target sector size and addressable subset
- Transferable evidence: technology readiness, performance metrics, cost per unit outcome
- Adjustment factors: regulatory, operational, technical context differences
- Adoption pathway and timeline
- Counterfactual: what's the do-nothing trajectory in target sector

### Step 2 — Triage each input

| Input | Status | Source / Proxy |
|-------|--------|---------------|
| Source-sector evidence (rail) | HAVE | Passport data: 18% emissions reduction, £2.1m unit cost, TRL 7 |
| Target sector size (maritime) | PARTIAL | UK maritime emissions ≈11% of transport (DfT 2024); subset is unclear |
| Transfer technical fit | PARTIAL | Energy-system overlap moderate; combustion-vs-electric differs |
| Cost adjustment factor | MISSING | ASSUME +30–60% for marine-grade equipment (analogue: aviation-to-marine retrofit costs) |
| Regulatory pathway | MISSING | ASSUME 18–36 months for MARPOL-compliant certification |
| Maritime adoption rate | MISSING | ASSUME 2–5% addressable subset per year from year 3 |
| Maritime counterfactual | PARTIAL | IMO 2050 net-zero targets in place; trajectory exists but pace contested |

### Step 3 — Produce Low / Central / High triples

Use the worst-plausible / most-likely / best-plausible values across all PARTIAL and ASSUME inputs.

- **Low:** £X.X m indicative transfer value. Assumes 2% addressable subset, +60% cost adjustment, slow regulatory pathway.
- **Central:** £Y.Y m indicative transfer value. Assumes 3.5% addressable subset, +45% cost adjustment, 24-month regulatory pathway.
- **High:** £Z.Z m indicative transfer value. Assumes 5% addressable subset, +30% cost adjustment, fast regulatory pathway.

### Step 4 — Assign confidence

| Tier | Meaning | When to use |
|------|---------|------------|
| **Speculative** | Mostly ASSUME inputs; analogues thin or contested | Initial scoping; conversation-starter values only |
| **Indicative** | Mix of HAVE/PARTIAL/ASSUME; analogues defensible | First-pass valuation, useful for prioritisation |
| **Supported** | Mostly HAVE/PARTIAL; one or two named assumptions | Suitable for inclusion in OBC; would survive challenge |
| **Robust** | Mostly HAVE; assumptions tested with sensitivity | Suitable for FBC; would survive formal review |

### Step 5 — Tell the user what would lift confidence

Always end an evidence-triaged valuation with: *"This is at [Indicative] confidence. To move to [Supported]: confirm [specific input], obtain [specific evidence], validate [specific assumption]."*

## Output template

When producing a partial-evidence valuation, always include:

```markdown
## Valuation: [proposal name]

**Indicative value:** Low £X.X m / Central £Y.Y m / High £Z.Z m
**Confidence:** [Speculative / Indicative / Supported / Robust]

### Evidence triage

| Input | Status | Source / Proxy |
| ... |

### Key assumptions

1. [Assumption] — source: [analogue / proxy / judgement]
2. ...

### What would lift confidence

To move to [next tier]: [specific actions]

### Switching values

- NPV turns negative if [variable] falls below [value]
- Preferred option flips if [variable] exceeds [value]
```

## Confidence tier mapping for Atlas 5 agents

All four agents must include `confidence_tier` in every response, drawn from this framework:

| Agent | Typical starting tier | Promotion path |
|-------|----------------------|---------------|
| JARVIS | Indicative (corpus found) or Speculative (few results) | → Supported when 3+ verified citations with high similarity |
| ATLAS | Indicative (single project case) | → Supported when cross-corpus evidence + GovUK data |
| CICERONE | Speculative (novel transfer) | → Indicative when 2+ analogues found |
| HYVE | Indicative (HIVE articles found) | → Supported when 3+ verified hive.articles cited |

## Anti-patterns

1. **Single point estimate with no confidence framing.** Always Low/Central/High when uncertainty is real.
2. **Confidence labels divorced from working.** Don't claim "Supported" without showing the HAVE/PARTIAL/ASSUME split.
3. **Buried assumptions.** Every assumption goes in the table; nothing hidden in prose.
4. **Made-up analogue values.** If you don't have a source for a proxy, say "ASSUME based on [domain expertise / judgement]" — don't fabricate a citation.
5. **Refusing to give a number.** "More evidence needed" alone is unhelpful. Produce the indicative number with the right confidence tier, then say what would lift it.
6. **Confidence inflation.** Don't call something "Supported" because it would be useful for it to be.

## Special cases

### When ALL inputs are MISSING

The valuation is **Speculative** at best. Frame it as a "feasibility scoping" rather than a value estimate. Outputs should be range-based and order-of-magnitude.

### When evidence is contested

Distinct from MISSING. Name both estimates explicitly. Run the Low/Central/High using each. Lower confidence by one tier. Report spread as a sensitivity finding.

## Why this matters

The Green Book methodology assumes evidence is present. Real CPC work usually starts from incomplete evidence — a partial passport, an exploratory funding call, a transferability question across sectors. Without this triage discipline, valuations either get refused ("not enough evidence") or fabricated ("here's a confident number based on nothing"). The triage lets the agent produce a useful number while staying honest about what it rests on.
