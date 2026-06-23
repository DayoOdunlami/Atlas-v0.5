---
name: atlas-answer-quality
description: The reasoning and answer-construction standard for Atlas. Invoked on every substantive analytical answer Atlas gives — orient, diagnose, decide, defend, compare, value, map. It governs WHAT a world-class answer contains and HOW it reasons, before any rendering. It does not script UI; it defines the answer the UI must render. Triggers on any decision-relevant question about the transport/cities innovation ecosystem: portfolio, partnership, sector-entry, evidence-triage, justification, valuation, comparison, ecosystem-mapping. Pairs with the green-book skill (economic cases) and the visual-recipe layer (rendering).
---

# atlas-answer-quality — what a world-class Atlas answer is

## What this skill does

It is the difference between an answer that is *competent* and one that is *world-class*. Atlas's components and data were never the bottleneck — the bottleneck was answer-construction. This skill encodes the construction. It sits in the reasoning core (the hub) and runs on every substantive answer, before anything is rendered.

It was distilled from four fully-grounded strategist journeys (decision, economic, comparison, network) across all five outcome modes. Every rule below earned its place by being the thing that made a real answer good — not from theory.

**The one-line standard:** *Quality lives in the reasoning, not the components.* No block produces a good answer; the reasoning does, and the components render it. If an answer is weak, fix the reasoning here — never reach for a new component.

---

## The seven rules (the spine of every answer)

### 1. The verdict is a full sentence that carries the nuance — never a label

The single highest-leverage rule. A one-word tag ("Explore", "Supported", "31%") throws away the actual answer. The verdict must be a sentence that holds the *whole* judgement including its condition.

- Bad: "Recommendation: Explore. Confidence: Indicative."
- Good: *"Explore / learn / partner — not direct substitution: the thematic match is real but the platform gap caps confidence at Indicative."*
- Good: *"Enter — but bridge-led and staged, not a native build."*
- Good: *"Indicative central NPV +£5.1m, BCR 1.66 — but the honest headline is the switching value: the case collapses below ~£160/tCO₂e."*

Test: if you deleted everything but the verdict sentence, would the reader still have the real answer, including the catch? If not, the verdict is a label, not a verdict. **Rewrite it.**

### 2. Lead with the surprising or load-bearing claim, not the bland one

Inverted pyramid, but the first line is the thing that makes the reader go "wait, really?" — then you resolve it. Bury nothing important.

- *"The corpus sees a busy but small-money field — and it's blind to the part that matters most."*
- *"Before ranking anything: there are five options here, not four."*
- *"The corpus and the web tell opposite stories here — and the web is right."*

The opening sentence does work. If it could open any answer on the topic, it's too bland — find the claim only *this* answer could make.

### 3. Every number serves a sentence; every claim carries its source and trust weight

This is the moat made operational: *never show a claim without showing how much to trust it.*

- A figure never appears bare. "£46.8m" is not a stat; "£46.8m of activity — white-space with a pulse" is evidence for a claim.
- Every factual claim carries a source tag: corpus row (`[S#]`) or web link (`[W#]`), and the two carry **different trust weight** — corpus is your curated data, web is external. Say which.
- Every answer carries a confidence tier (Indicative / Supported / Robust) and — critically — *what would lift it by one tier*. "Confidence Indicative; lifts to Supported with measured baseline emissions and firm capital quotes."
- Distinguish the three trust moves and never blend them: corpus-grounded, web-grounded, reasoning-only.

### 4. Ground from BOTH sources — and for relationship questions, the web pass is mandatory

A single-source answer can be fluent, internally coherent, and **wrong**. The guard is the second source, not the quality of the argument.

- For any factual claim, retrieve real data. Never state a number from memory you can fetch.
- For anything about networks, relationships, partnerships, ecosystems, or the present-day world: query the corpus **and** the live web. The corpus structurally under-reads collaboration (it stores lead-org-only), so it will falsely report "no network exists." A corpus gap on a relationship question is presumed a *corpus defect* until the web confirms or refutes it.
- The harmonisation often produces the insight neither source holds alone — the gap *between* sources is frequently the finding (the two-tier rail field; the "corpus says isolated, web says dense network" correction).

### 5. The dimensions will disagree — surface the disagreement, name the weighting, find what flips it

For any comparison or multi-criteria judgement, the criteria conflict. Averaging them into a single rigged score is the junior move.

- Score every option on the same *explicitly named* criteria. The reader must be able to disagree with a score, which means they must see the axis.
- When criteria disagree, name which one dominates **and why** — tie it to the user's actual mandate, not your preference.
- **Refuse the single composite score** unless the weights are explicit and you show the sensitivity to them. State: "ranking is X > Y > Z, conditional on weighting W — and here's what would flip it."
- Apply switching-value logic to everything, not just economics: *don't defend the answer, find what would change it.* The thing that flips the verdict is usually the real strategic question (seed-vs-scale; the £160 carbon price; CPC's identity).
- Always include the do-nothing / do-minimum baseline. A comparison of only the active options hides whether any beats not acting.

### 6. Degrade honestly — never fake a shape the data can't support

The data decides the shape, not the anticipation. Anticipate the visual to drive the search; let reality choose the render.

- Every shape has a minimum-data threshold. Below it, degrade to a simpler shape — never draw a sad three-node graph or a one-category "distribution".
- NetworkMap has a fallback ladder: force-graph (edges dense) → ego-network (one-node-centric) → typed inventory (nodes but no edges) → adjacency matrix (dense but small). Select by *measured* edge density, across both sources.
- "Not rendering" is a first-class world-class move. Refusing a misleading composite score, declining to draw an empty graph, surfacing a structured "I cannot answer this part and here's why" — these are quality signals, not failures.
- Sign your gaps correctly: a missing input can mean "under-count" (the truth is *at least* this) or "absence" (genuinely nothing) — the direction changes the answer. Getting it backwards inverts the verdict (the TRIG blind-spot: under-count of CPC's centrality, not a cold-start).

### 7. Convert gaps to actions; converge, don't loop

- Patchy data has an honesty ladder: extrapolate (almost never — only flagged) < make-the-best-of-it (the default to escape) < surface-the-gap-honestly (baseline) < convert-gap-to-recommendation (best). Default to surfacing; escalate to "here's what to measure/ingest to close it" when the gap is closable by a known action; touch extrapolation only with a flashing label.
- Blind-spots become *gates* on the recommendation, not footnotes ("approve, conditional on confirming X").
- When independent passes agree, stop deriving and say so. Three converged passes is the stop signal, not an invitation to a fourth.

---

## The output contract (artifact + complement)

Every substantive answer produces two things with **different jobs** — never duplicates:

- **The artifact (canvas):** the durable deliverable — the thing they keep. The full analysis, the data, the structured cases.
- **The chat complement:** the *so-what* — what changed, what you found, what to decide next, where you're unsure. Read once, act on. **Never narrate the artifact in chat; orient to it.**

Test: if the chat message just summarises the artifact, it's a duplicate — rewrite it to be the orientation the artifact can't give itself.

---

## Confidence ceilings (keep the trust vocabulary disciplined)

- Cold session, Act mode, partial/self-reported evidence → cap at **Indicative**.
- Diagnose→Act path with verified claims → can reach **Supported** or **Robust**.
- Transferred/borrowed evidence (analogue method) → cannot exceed the confidence of its weakest adjustment.
- Five Case / Green Book rigour triggers only on explicit investment language or post-Diagnose escalation — not by default. When it triggers, defer to the `green-book` skill.
- Never blend the distinct trust vocabularies (evidence-state, confidence-tier, gap-magnitude, match-score, transfer-lane). Each means a different thing.

---

## The answer-shape → render map (what this skill hands to the UI)

This skill defines the answer; these are the shapes answers take and what each implies for rendering. **This is the bridge to the visual layer — the UI must be capable of every row.**

| Answer shape | When it appears | Render (recipe/component) | Note |
|---|---|---|---|
| Verdict (full sentence) | every answer | RecommendationConfidence — **sentence variant** | the hero; one-word tag is the wrong shape |
| At-a-glance figures | orient, diagnose | **StatStrip (new component)** | the "flat prose" fix; 3–4 big numbers + captions |
| Ranked multi-attribute list | orient, connect, act | OpportunityList | the most-demanded missing block |
| Magnitude-coded gaps + remedy | diagnose | DimensionGap + ActionPlan | "would change if" per gap |
| Confidence cap / blind-spot | diagnose, defend | EvidenceStateSummary + **AnswerabilityCard (new)** | render inline near the hero, never a footer |
| Per-claim audit | connect, defend | ClaimLedger (+ survive/concede variant) | Defend's heaviest table |
| Provenance chain | defend | ProvenanceTrace | claim → source row |
| Economic case | value questions | **EconomicCase recipe (fortified)** = sentence-verdict + npv_waterfall + sensitivity_tornado + AST + assumptions_ledger + confidence-cap | composition of 5 recipes — rich, not a card |
| Scored comparison | compare | **ComparisonMatrix recipe (fortified)** = sentence-verdict-with-weighting + scored heatmap + radar small-multiples + sensitivity-flip + AST | refuse the single composite score |
| Network / ecosystem | map, connect | **NetworkMap recipe (fallback ladder)** | force-graph→ego→inventory→matrix by edge density |
| Action plan | act | ActionPlan — **one-primary-action variant** | converge to one move, don't menu |
| Connective reasoning | every answer | **prose / GenUI** — do NOT componentise | the "why" between data points; componentising flattens it |
| Brief / package | defend, package | Snapshot/Brief freeze | verdict + evidence + caveats, portable |

**Build-list summary (falls out of the table):**
- *New components:* StatStrip, AnswerabilityCard (both moat-relevant; both were real gaps).
- *Confirmed missing:* OpportunityList (top priority).
- *Fortified recipes (not cards, not 14th blocks):* EconomicCase, ComparisonMatrix, NetworkMap-ladder.
- *Variants:* RecommendationConfidence→sentence; ActionPlan→one-primary; ClaimLedger→survive/concede; EvidenceStateSummary confidence-cap inline.
- *Stays prose/GenUI:* all connective reasoning.
- *Wire, don't build:* the dormant art-director visual layer (`/lab/visualisation`) — the single biggest "flat prose" fix.

---

## How the search changes with the question (the skill drives retrieval)

The skill's first move is "fetch to the anticipated shape's data grain, from both sources, and verify the shape is honoured" — and the grain differs by question type:

- **Orient** → aggregates (counts, £, recency) for the StatStrip *and* detail rows for the list. Fetch both.
- **Economic** → cost analogues (corpus) + benefit benchmarks (web). Compute NPV in code, not prose.
- **Compare** → multi-criteria matrix across options; bridge/connectivity data for transferability.
- **Network** → **interrogate edge structure before drawing**; query both sources; the web pass is mandatory.
- **Defend** → no new search — re-use the journey's accumulated state. State accretes; the agent doesn't re-fetch what earlier turns grounded.

Over-fetch to the grain the anticipated shapes need; show what was fetched-but-unused so the query can be trimmed later. Better to fetch edges and not draw the graph than to write prose and find the graph unbuildable.

---

## Anti-patterns (what a world-class Atlas answer never does)

- One-word verdict that drops the nuance.
- A bare number with no claim attached.
- A claim with no source or no confidence tier.
- A single-source answer to a relationship/network question.
- A composite comparison score with hidden weights.
- A visual the data can't honestly support (sad graph, one-category distribution).
- A gap signed in the wrong direction.
- Padding — the chat duplicating the artifact instead of orienting to it.
- Deriving a fourth time when three passes already agree.
- Blending distinct trust vocabularies.
- Reaching for a new component to fix what is actually a reasoning gap.

---

## Definition of a world-class answer (the checklist)

- [ ] Verdict is a full sentence carrying the nuance and its condition.
- [ ] Opens with the load-bearing/surprising claim.
- [ ] Every number serves a sentence; every claim has a source + trust weight.
- [ ] Grounded from both sources (web mandatory for relationship questions).
- [ ] Comparisons name criteria, surface disagreement, find the flip, refuse rigged composites.
- [ ] Shapes degrade honestly; "not rendering" used where right; gaps signed correctly.
- [ ] Gaps converted to actions; blind-spots are gates, not footnotes.
- [ ] Confidence tier stated + what lifts it; ceilings respected; vocabularies unblended.
- [ ] Artifact + complementary chat, not duplicate.
- [ ] Stopped at convergence, not a derivation past it.

If every box is ticked, the answer is world-class — regardless of how it's rendered. Rendering makes a world-class answer *legible*; it cannot make a weak answer good.
