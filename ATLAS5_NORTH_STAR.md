# ATLAS5_NORTH_STAR.md — Product Outcomes (canonical, mirror of Notion North Star v3.1)

> **Status:** Locked. **Authority:** product outcomes layer (what / why / for whom).
> **Source:** mirrored faithfully from the Notion canonical "🧭 Atlas v5 — North Star and Validation Thesis (v3.1)" (last verified 2026-06-15). When MCP connections are restored, Notion will be harmonised to match this file.
> **Companions:** `CLAUDE.md` (stack anchor) · `ATLAS5_BRAIN_ADR.md` (brain & rendering paradigm) · `ATLAS5_IMPLEMENTATION_PLAN.md` (sequenced work).
> **Build rule:** *Do not build a landscape. Build a route-finder.*

---

## Public-facing sentence

**Atlas helps users compare what exists against what is wanted, then explains the fit, the gap, the risk, and the next strategic move.**

---

## What Atlas is

Atlas is a **decision-orientation engine** for innovation, funding, and strategic opportunity work. It helps users move from *"there is too much fragmented information"* to *"I understand the opportunity, the evidence, the risks, and what to do next."*

It does this by maintaining a **structured truth layer** (Passports and Requirement Specs, extracted by agents from messy sources) and a **strategic interpretation layer** (matching, lenses, and artefacts).

---

## The product spine

```
Entity Passport → Requirement Spec → Atlas Match → Strategic Artefact → Defensible Action
```

Every feature decision traces back to a step on this spine. If it does not, it does not belong in v5.

---

## Two analogies for non-technical buyers

**Atlas is not a map — it is a satnav plus scout.**
A map shows everything. A satnav asks where you are trying to go. A scout warns: *"Do not take that road; the bridge is out. This longer route has the funding, the partners, and fewer regulatory barriers."*

**A Passport is not a CV — it is a travel document plus cargo manifest.**
A CV says who you are. A Passport says what this product, project, organisation, or programme claims it can do, what proof it carries, where that proof is valid, what conditions apply, and where it may not be accepted without translation.

---

## Governing principle

**Structure goes in the objects. Intelligence goes in the matcher and the artefact.**

Passports and Requirement Specs are **structured records, not reasoning engines.** They can contain inferred fields, but every inference must be labelled, traceable, and challengeable. The objects do not hide reasoning inside polished prose. They record what is known and how confidently it is known.

The smart reasoning happens when Atlas matches those records and produces a strategic artefact. This separation is what makes Atlas defensible. Without it, Atlas becomes agents producing plausible text — useful perhaps, but not reliable enough for professional decision-making.

---

## Architecture in one line

**Passports describe what is. Requirement Specs describe what is wanted. Atlas matches them and explains the fit, the gap, the risk, and the move.**

How it works:
- Agents extract Entity Passports from entity sources: uploaded evidence, project documents, product descriptions, organisation profiles
- Agents extract Requirement Specs from demand sources: funding calls, sector challenges, procurement notices, investment theses, strategic priorities
- Both are stored with embeddings (for retrieval) and structured fields (for matching)
- When a query arrives, Atlas retrieves candidate Requirement Specs against a Passport
- The matcher computes: **Passport × Requirement Spec → fit, gaps, risks, move**
- The artefact renders the evidence trail, assumptions, risks, and recommended action

Extracted records must be refreshable, versioned, and traceable to source snapshots.

---

## Five outcomes

**1. Orient**
Focus on a decision and surface the terrain that matters to it. Atlas does not show the whole landscape — it shows what matters given who the user is, what they have, and what they are trying to decide.

**2. Connect**
Find credible opportunity routes that would not be obvious. This includes adjacent sectors, relevant funders, potential partners, comparable projects, hidden applications, and policy or investment signals. Every connection must be explainable — no black-box similarity suggestions.

**3. Diagnose**
Surface what proof would unlock value, fit, safety, adoption, or credibility in a new context. This is not simple gap detection. It is **value translation.**

**4. Act**
Produce a decision-ready artefact and recommend the next move. Possible moves: apply, partner, gather evidence, reposition, pause, monitor, stop, escalate for deeper review.

**5. Defend**
Help the user hold up under challenge in a board, panel, procurement, funding, or stakeholder room. Defend is not just the final step — it is the quality standard across the whole journey.

---

## Data model

### Entity Passport
An Entity Passport describes something that exists with identity and ownership.
Examples: Product, Project, Organisation, Programme, Capability.
It captures: identity, owner, claims, evidence, maturity, constraints, provenance, claim states.

### Requirement Spec
A Requirement Spec describes what is wanted.
Examples: funding call, sector challenge, procurement need, investment thesis, strategic priority, market-entry requirement.
It captures: need or challenge, eligibility, desired outcomes, evidence demands, constraints, deadlines, value criteria, entry friction, weighting, provenance, claim states.

> **Status note.** Requirement Spec is a *proposed new object class*, not something Atlas has today. Currently, funding calls live as scraped rows retrieved via vector search, with the LLM doing the matching invisibly. The reframe makes matching explicit, computable, reusable, and auditable. This is a real architectural decision, not a rename.
>
> Before full implementation, Phase 1 must compare model-only matching from unstructured opportunity text against structured Requirement Spec matching on 3–5 real examples. This test informs which Spec fields are worth extracting — run it before schema finalisation. Requirement Specs proceed only if they improve auditability, repeatability, gap quality, confidence calibration, or defensibility.

---

## Claim states — the honesty layer

Every **decision-relevant field** on a Passport or Requirement Spec exists in one of four states:

- **stated** — directly extracted from a source, with citation
- **inferred** — derived by the agent, with an inference rationale
- **unknown** — no reliable data found
- **contested** — sources disagree, with each source recorded

Values carry provenance: either a citation or an inference rationale. This makes extrapolation safe and visible. The agent can infer — but that inference surfaces with its state and reasoning, never hidden as if stated.

**Matcher behaviour:** stated × stated at higher confidence; stated × inferred at reduced confidence with visible rationale; unknown becomes a real gap; contested becomes a risk.

**Confidence tiers** (tied to evidence operations, not vague AI certainty):
- Tier 1 — independently verifiable evidence
- Tier 2 — corroborated evidence or strong inference
- Tier 3 — thin inference, uncorroborated claim, unknown, or contested

This is not optional. It is what makes the structured layer worth having.

---

## Three risk types

Atlas surfaces risk in three structured categories, not as a single score:

- **Evidence risk** — is the claim proven? Tied to Passport claim states.
- **Fit risk** — does the solution genuinely match the need? Tied to matcher output.
- **Entry risk** — can the user actually access this market, procurement route, funder, or sector? Tied to Requirement Spec entry-friction tags.

These risks can move independently. Collapsing them into one number loses signal.

**Definitions:**
- **Fit** = where Passport claims satisfy Spec criteria
- **Gap** = where Spec criteria are unmet, weakly evidenced, unknown, or contested
- **Risk** = why the match may fail despite apparent fit
- **Move** = the recommended next action based on fit, gap, and risk

---

## Entry-friction tags

Entry friction is a decision input, not a consultancy deliverable. Minimum Phase 1 tag set:

`procurement_route` · `prime_partner_needed` · `regulatory_barrier` · `certification_required` · `sales_cycle_length` · `liability_exposure` · `data_access_dependency` · `integration_complexity` · `local_presence_required` · `funding_deadline_pressure`

---

## Diagnose — value translation, not gap detection

The shallow version of "missing evidence" is compliance: *you need ISO 9000, you need a safety case.* That alone is not a product.

The deeper version is **value translation:** which existing proof or value claims from an Entity Passport are meaningful in a new Requirement Spec context? Which need reframing? Which are not yet credible? Which new proof is required before the value will travel?

Evidence is contextual. A rail trial result may be valuable in rail but insufficient for aviation without translation. Atlas surfaces *what would make the value believable here* — not just *what is missing from a checklist.* This is one of Atlas's strongest commercial differentiators.

---

## Defend operationalised

Every artefact must include:
- Evidence trail (citations to Passport fields, Spec fields, and source documents)
- Assumptions (what is inferred, what has been treated as given)
- Confidence tiers (per claim and overall)
- Alternative interpretations (where the match could be read differently)
- Likely objections (what a sceptical reviewer might raise)
- What evidence would change the conclusion
- Recommended next action

A defensible action must include: recommendation, evidence trail, confidence level, key assumptions, main objections, and next evidence to gather.

---

## What Atlas is not

- a generic search interface
- a prettier project database
- a map of everything
- an AI report-writing wrapper
- a full consultancy replacement
- a procurement, legal, or regulatory adviser
- a system that pretends all opportunities are worth pursuing

Where deeper consultancy, due diligence, procurement advice, or technical review is needed, Atlas flags that need. It does not pretend to fill it.

---

## Buyers — many served, one validated first

The engine is designed to be reusable across buyer types: SMEs hunting funding routes, CPC mode leads scoping innovation zones, funders sizing portfolios, Mayoral Strategic Authorities locating capability, and consultancies advising clients.

However, this should be treated as a **hypothesis, not an assumption.** Each buyer will require its own lens, artefact assumptions, terminology, trust threshold, and validation cycle.

**Validation is sequenced, not bundled.** SME validation goes first because it gives a market-priced signal independent of CPC politics. A real "yes" from Sameer strengthens later conversations with Domas, Justin, Chris, and Heather. The architecture remains polymorphic from day one.

---

## UX as conveyance, not polish

UX is how value is digested, not a feature to defer. The order is **substance contract first, then UX investment** — not "UX deferred."

The lesson from v3: UX built before the truth layer is stable is wasted. But once the matcher returns trustworthy output, UX becomes essential to making that output legible, defensible, and confidence-inspiring. The interface should help users understand what is known, what is inferred, what is missing, what is risky, what action is recommended, and what can be defended.

---

## Phase 1 scope

**In scope:**
- Passport schema with decision-relevant fields, claim states, and provenance
- Requirement Spec schema with decision-relevant fields, claim states, provenance, and entry-friction tags
- Agent extraction pipeline for Passports from uploaded entity sources
- Agent extraction pipeline for Requirement Specs from the existing opportunities corpus
- Comparison test: model-only matching vs structured Requirement Spec matching on 3–5 real examples (run before schema finalisation — the test informs which Spec fields are worth extracting)
- Structured matcher producing fit, gap, risk, and move
- One artefact: **Evidence Gap & Value Translation Report**
- SME lens system prompt and Product Passport template

**Deferred to Phase 2:**
- Linked context corpus (strategies, news, sector reports)
- Cross-Passport relationship modelling (supply chains, regulatory bodies, comparable products)
- Entity resolution
- Additional lenses (CPC mode lead, funder, MSA)
- Analyst workbench mode
- Synthesised hypothetical Requirement Specs from user briefs
- Additional artefact templates (Opportunity Match Report, Partner Shortlist, Business Case)

---

## Open architectural decisions

**1. Matcher mode vs workbench mode**
Is Atlas primarily a matcher that produces artefacts, or an analyst workbench where users curate, pin, compare, challenge, and assemble defensible decisions?
*Resolved by `ATLAS5_BRAIN_ADR.md` §4: the orchestrator subsumes both. The matcher is a tool; "Workbench-one" and "Browse-many" are operating modes of the same block grammar; the same brain serves matcher-first (Phase 1) and workbench (Phase 2).*

**2. Requirement Spec proof gate**
Requirement Spec is the preferred architecture but must earn its existence. Phase 1 compares structured Spec matching against model-only matching. Proceed only if the structured approach improves auditability, repeatability, gap quality, or defensibility.

**3. Phase 1 artefact choice**
Evidence Gap & Value Translation Report is the current preferred artefact because it is harder to fake with clever search and ties directly to the value-translation differentiator. Test the framing against the simpler Opportunity Match Report in user conversations before finalising.

**4. Claim state UI primitives**
How claim states are visualised to users is not yet fully specified. Render registry §6a of the ADR provides the block-level vocabulary (ClaimLedger, EvidenceStateSummary, ProvenanceTrace); detailed Phase 2 design pending.

---

## Design rules

1. **Orientation over visibility.** Do not show everything; show what matters to the decision.
2. **Explain the route.** Every opportunity route must answer: why this, why now, why this user, what supports it, what is uncertain.
3. **Gaps must be value-linked.** Say why the missing proof matters — fundability, transferability, adoption, procurement, safety, or trust.
4. **Artefacts must be decision-ready.** A report is only useful if it helps someone act or defend a position.
5. **Confidence must mean something.** Tied to evidence operations and claim states, not vague AI certainty.
6. **Structure in objects, intelligence in matcher and artefact.** Do not store SWOTs, recommendations, or derived analysis as fixed truth on the objects.

---

## Build implication checklist

Before adding any feature, ask:
1. Does this help define what exists (Passport) or what is wanted (Requirement Spec)?
2. Does this improve the fit, gap, risk, or move analysis?
3. Does this help the user act or defend?
4. Does this fit Phase 1 scope, or should it be documented for Phase 2?

If no to 1–3: it does not belong in v5. If yes to 1–3 but no to 4: document as Phase 2 and defer.

---

## Phase 1 validation target

One Product Passport (Sameer's tool) matched against Requirement Specs extracted from the most relevant funding calls and sector challenges in the live corpus. Output: one **Evidence Gap & Value Translation Report.**

**Product proof:** Can Atlas turn one messy real-world entity and several messy real-world opportunities into a structured, evidence-backed recommendation that reveals a non-obvious gap, route, or risk the user trusts enough to act on?

**Commercial proof:** Would the user pay to keep receiving this kind of defensible opportunity intelligence?

Validation questions:
- What would you stop doing if this existed?
- What would you use this for next week?
- Who else would need to approve payment?
- What would make this not worth paying for?
- Would you pay £X/month for three months to test it?
- What would you do next based on this report?

---

## North Star statement

**Atlas v5 exists to help innovation teams compare what they have against what a market, funder, or sector needs — then explain the fit, the evidence gap, the entry risk, and the next defensible move.**

Shorter: **Atlas turns fragmented innovation evidence into defensible strategic moves.**

---

*v3.1 — May 2026. Mirrored to repo 2026-06-15. Status: locked. Owner: Dayo. Reviewed against adversarial four-horsemen critique (Google, OpenAI, Anthropic, Palantir lenses).*

*Notion source (when reachable): "🧭 Atlas v5 — North Star and Validation Thesis (v3.1)" — page id `36dc9b38-2a74-8170-ad34-fc4950df3621`.*
