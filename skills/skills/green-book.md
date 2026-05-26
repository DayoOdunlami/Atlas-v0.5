---
name: green-book
description: Use when the user asks to appraise, value, build a business case for, or assess the economic merit of a project, programme, or innovation — especially in a UK public-sector or transport-innovation context. Applies HM Treasury Green Book methodology (Five Case Model, NPV, optimism bias, sensitivity analysis, distributional impacts) and pulls in complementary techniques (Real Options, SROI, Three Horizons, ECV, ATAR, Innovation Accounting) where the Green Book leaves gaps.
---

# green-book — UK Green Book appraisal methodology and innovation valuation

## What this skill does

Applies HM Treasury's 2026 Green Book methodology as the spine for project appraisal, business case development, and economic valuation. Augments the Green Book with complementary techniques where it leaves gaps — specifically for innovation, deep uncertainty, partial evidence, and cross-sector transferability questions.

**It is methodology-pure.** It tells the agent *how* to think and *what* to compute.

## The hierarchy (read this first)

1. **Green Book is the spine.** Five Case Model, NPV at 3.5% STPR, optimism bias, sensitivity analysis, distributional impacts, Appraisal Summary Tables. Authoritative for UK public-sector decisions.
2. **Complementary techniques augment, do not replace.** Real Options thinking, SROI, Three Horizons framing, ECV, ATAR, Innovation Accounting — each fits *inside* a Green Book case when the situation warrants it. Never lead with these; lead with the Green Book.
3. **Evidence triage governs everything.** When evidence is partial (the normal CPC case), explicitly classify what's known, what's assumed, what's missing. Produce Low/Central/High estimates with confidence scoring. See `evidence-triage.md`.

## The Five Case Model (the spine)

The 2026 Green Book confirms the Five Case Model as the single framework for business case development.

### Strategic Case — case for change
- **Case for change**: why government needs to act
- **Theory of change**: how the proposal produces intended outcomes
- **Business-as-usual (BAU)**: counterfactual if proposal is not implemented
- **SMART objectives**: Specific, Measurable, Achievable, Realistic, Time-limited
- **Strategic fit**: alignment with originating org and wider UK public objectives

For innovation cases, Three Horizons framing fits here — categorise the project as Horizon 1 (core), 2 (emerging), or 3 (future).

### Economic Case — value for money

The analytical core. Assesses economic costs and benefits to society as a whole over the full life of the proposal.

- **Options Analysis**: long list → short list (always include do nothing/do minimum)
- **Social Cost-Benefit Analysis**: NPV at 3.5% Social Time Preference Rate; declining schedule for years 31+
- **Optimism bias**: applied to costs (and sometimes benefits), declining as risk management matures
- **Sensitivity analysis**: switching values, scenario testing
- **Distributional impacts**: how costs/benefits fall across groups, regions, demographics
- **Unmonetised benefits**: described transparently when monetisation isn't possible

### Commercial Case — commercial viability

Can the solution be delivered through a workable commercial deal? Procurement strategy, asset ownership, key contractual issues, risk allocation.

### Financial Case — affordability

Are the costs within budget? Exchequer impact (separate from NPV). Funding sources. Whole-life affordability.

### Management Case — deliverability

Can it be delivered successfully? Change management plan, benefit realisation plan, risk register, monitoring and evaluation.

For innovation cases, Innovation Accounting / Metered Funding fits here — stage-gated release of funds against validation milestones.

## SOC → OBC → FBC progression

| Stage | Purpose | Status of cases |
|-------|---------|----------------|
| **Strategic Outline Case (SOC)** | Scoping. Confirm strategic context, make robust case for change. | Strategic ~80%, Economic ~40%, others sketched |
| **Outline Business Case (OBC)** | Identify preferred option. Detailed options analysis, robust NPV comparison. | Strategic 100%, Economic ~90%, Commercial ~60%, Financial ~70%, Management ~60% |
| **Full Business Case (FBC)** | Procurement complete, recommended deal written up. | All cases 100% |

Optimism bias is highest at SOC, declines as risk management matures.

## The 'no extra case' principle

The 2026 Green Book is explicit: *"There is no need to invent an additional case to accommodate a special feature of a proposal."* Environmental, security, legal, regulatory or ethical considerations can be expressed as objectives, critical success factors, or social costs/benefits within the appraisal.

## Decision tree: when to enrich with complementary techniques

| If the proposal is… | Pull in… | Where it sits |
|--------------------|---------|--------------|
| Innovation-portfolio context (where does this fit across H1/H2/H3?) | **Three Horizons** | Strategic Case → strategic fit |
| Deep uncertainty about commercial success (stage-gated decision) | **Real Options Valuation** | Economic Case → sensitivity analysis / option value |
| Benefits resist monetisation (social, environmental) | **SROI principles** | Economic Case → unmonetised benefits and wider impacts |
| High-risk innovation needing risk-adjusted ranking | **ECV** | Economic Case → expected-value calculation |
| Early-stage product needing market sizing | **ATAR** | Economic Case → demand modelling |
| Stage-gated delivery for high-uncertainty project | **Innovation Accounting / Metered Funding** | Management Case → delivery approach |
| Cross-sector transferability question (partial passport) | **Analogue method** | Economic Case → valuation under partial evidence |

## Calculations

The skill performs actual calculations — not just describes them:

- NPV at 3.5% STPR: `NPV = Σ (B_t - C_t) / (1.035)^t` for t = 0..n
- Optimism bias: apply HMT category-specific uplift (Standard: 44% for non-standard buildings; 66% for standard buildings; Rail: 40%; Roads: 15%)
- BCR = PV(benefits) / PV(costs), where PV uses 3.5% discount rate
- Declining discount rate schedule for years 31+: 3.0% (31–75), 2.5% (76–125), 2.0% (126–200)

## Evidence triage

Apply HAVE / PARTIAL / MISSING / ASSUME classification to every input. See `evidence-triage.md` for the full framework. Produce Low/Central/High estimates. Never produce bare point estimates when evidence is partial.

## Output discipline

When producing a business case:
1. **State the stage explicitly** — SOC, OBC, or FBC
2. **Use the Five Case structure as headings** — do not invent your own taxonomy
3. **Always cite evidence sources** — corpus row IDs, document references, or explicit assumption flags
4. **Present numbers with confidence framing** — Low/Central/High plus confidence score
5. **End with monitoring and evaluation plan**

## Anti-patterns (what NOT to do)

- **Quoting BCR without optimism bias.** Always apply.
- **Cherry-picking sensitivity scenarios.** Use switching values to identify breakpoints.
- **Conflating financial and economic case.** Different scopes, different numbers.
- **Treating unmonetised benefits as 'soft'.**
- **Producing 'precise' numbers when evidence is partial.** Always signal confidence.
- **Inventing extra 'cases' for innovation, sustainability, etc.**
- **Claiming high confidence without sensitivity analysis.**

## Sources

- The Green Book: UK Government Guidance on Appraisal, 2026 edition (HM Treasury, 5 February 2026)
- Assessing Business Cases: a short plain English guide (HM Treasury supplementary guidance)
