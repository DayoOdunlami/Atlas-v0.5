# Atlas Composable Evidence Workbench — Master Product Spec

**Version:** v0.7 consolidation  
**Purpose:** unify the Atlas Omega Composer, block library, chat/artifact/inspector model, layout grammar, and data-visual registry into one build contract.

---

## 0. Executive summary

Atlas should be built as a **chat-assisted evidence workbench**.

The user can converse with Atlas, but the **main artifact remains the source of truth**. Chat helps control, refine and explain the work. The artifact records the structured answer. The inspector proves every claim. Snapshot exports the evidence-backed decision object.

Core operating line:

```text
Chat controls and explains.
Artifact structures and records.
Inspector proves.
Snapshot exports.
```

The product should not become either:

```text
a rigid catalogue of fixed pages
```

or:

```text
a vague infinite canvas where anything can appear anywhere
```

Instead, Atlas uses:

```text
CanonicalQuestion
→ recipe
→ layout template
→ block selection
→ data-shape assessment
→ visual selection
→ trust/provenance overlay
→ inspector behaviour
→ snapshot/export
```

---

## 1. Product north star

**Atlas turns fragmented innovation evidence into defensible strategic decisions.**

Its core principle is:

> Never show a claim without showing how much to trust it and where it came from.

The product exists to help users:

1. Understand an organisation, capability, project, call, opportunity or market.
2. Explore many opportunities or actors.
3. Assess fit between capability and demand.
4. Translate evidence from one context into another.
5. Decide whether to pursue, partner, pass, monitor or defend.
6. Act on gaps and next moves.
7. Defend the judgement under challenge.
8. Snapshot the structured evidence object into a brief or pack.

---

## 2. Locked model

Do **not** reopen these unless there is a genuine structural flaw.

### 2.1 Modes

| Mode | Job | Layout emphasis |
|---|---|---|
| Browse-many | Scan many opportunities, organisations, themes or actors | Browse Command View |
| Workbench-one | Work one decision / object up | Workbench Decision Spine or Evidence Inspector / Defend |

### 2.2 Workspace shell

```text
Collapsed nav rail
+ Copilot / chat panel
+ Main artifact
+ Inspector / utility drawer
```

### 2.3 Stable vocabulary

| Type | Allowed values |
|---|---|
| Evidence state | verified / self-reported / inferred / unknown / contested |
| Provenance | stored / derived / live-gap |
| Gap magnitude | small / medium / large / unknown |
| Transfer outcome | travels as-is / needs reframing / not credible here / evidence needed |
| Confidence tier | Speculative / Indicative / Supported / Robust |

Do not invent synonyms in the UI.

---

## 3. Chat / artifact / inspector contract

### 3.1 Chat controls and explains

Chat can:

- ask and refine questions;
- clarify scope;
- trigger morphs;
- summarise the artifact;
- request evidence;
- command Act / Defend / Compare / Snapshot;
- explain confidence caps and gaps.

Chat must not:

- be the only place where the answer appears;
- hide provenance;
- create claims that do not exist in the artifact;
- become the official record.

### 3.2 Artifact structures and records

The artifact is the structured source of truth.

It must show:

- current question;
- object/context;
- recommendation or current answer;
- confidence tier;
- evidence-state mix;
- main gap or risk;
- key reasoning visual;
- claims/evidence summary;
- available morphs;
- snapshot/export state.

The artifact must stand alone if exported or screenshotted.

### 3.3 Inspector proves

The inspector opens from any claim, confidence tier, gap, recommendation, evidence badge, edge or visual cell.

It shows:

- claim assertion;
- evidence state;
- provenance;
- source / evidence container;
- reasoning;
- confidence cap logic;
- what would change the conclusion;
- missing evidence / live gaps.

### 3.4 Snapshot exports

Snapshot freezes the current artifact into a shareable object:

- board brief;
- defend pack;
- decision note;
- opportunity brief;
- evidence appendix.

Chat can be included as context, but the structured artifact is the record.

---

## 4. CanonicalQuestion taxonomy

The CanonicalQuestion is the entry point for composing the canvas. It identifies the user’s intent and maps to a block recipe and layout.

| CQ-ID | User question | Intent | Mode | Default layout |
|---|---|---|---|---|
| cq.explore.pipeline | What is in the pipeline for this theme/sector? | Explore | Browse-many | Browse Command View |
| cq.explore.landscape | Who is working on this topic? | Explore | Browse-many | Browse Command View |
| cq.compare.options | Compare these calls / orgs / options | Compare | Browse-many or Workbench-one | Browse Command View / Workbench |
| cq.read.object | What is this organisation/capability/project good at? | Read | Workbench-one | Workbench Decision Spine |
| cq.assess.fit | How does this capability fit this opportunity? | Assess-fit | Workbench-one | Workbench Decision Spine |
| cq.translate.transfer | Can evidence from context A transfer to context B? | Translate | Workbench-one | Workbench Decision Spine |
| cq.diagnose.gap | What is the gap between us and what this needs? | Diagnose | Workbench-one | Workbench Decision Spine |
| cq.decide.pursue | Should we pursue / partner / pass? | Decide | Workbench-one | Workbench Decision Spine |
| cq.act.next | What should we do next? | Act | Workbench-one | Workbench Decision Spine |
| cq.defend.justify | How do I justify this to a panel/board? | Defend | Workbench-one | Evidence Inspector / Defend |
| cq.package.brief | Turn this into a brief / board pack | Package | Workbench-one | Snapshot / Brief Builder |
| cq.explain.why | Why did Atlas conclude this? | Universal morph | Any | Inspector expansion |

`cq.explain.why` is not a normal destination page. It is a universal morph that opens the proof layer for the current block or judgement.

---

## 5. Analytical block library

The system should maintain a stable block pantry. New things should normally be variants of these blocks, not new blocks.

| Block | Job | Typical visuals |
|---|---|---|
| ContextCard | Shows source/target/object identity and context | compact cards, paired source-target cards |
| OpportunityList | Browse many opportunities or calls | ranked/filterable table |
| ClaimLedger | Lists claims with evidence state and provenance | audit table |
| EvidenceStateSummary | Shows trust mix and confidence cap | stacked evidence bar, confidence rail |
| ProvenanceTrace | Shows source path and evidence trail | inspector drawer, citation stack |
| MatchBench | Shows requirement coverage and fit | requirement coverage matrix |
| DimensionGap | Shows source-target/context gaps | source-target rows, gap matrix |
| ComparisonMatrix | Compares options against criteria | options matrix, scorecard |
| NetworkMap | Shows actors and relationships | graph, stakeholder map |
| TransferLanes | Shows what travels, reframes, fails or needs evidence | four lane board |
| RecommendationConfidence | Shows decision and confidence | decision card, confidence tier |
| ActionPlan | Converts gaps into next moves | checklist, timeline |
| ObjectionResponse | Prepares defence under challenge | challenge-response table |
| SnapshotBrief | Freezes selected blocks into a shareable output | brief outline / board pack |

### Anti-sprawl rule

A new block earns its place only if it:

1. serves at least two intents; or
2. is the sole carrier of a non-negotiable trust/provenance function; or
3. is the defining interaction for a mode/question and cannot be a variant of an existing block.

Otherwise it is a **variant**, not a new block.

---

## 6. Layout templates

Do not use one rigid page for every question. Use **one grammar with three layout emphases**.

---

### Template A — Browse Command View

**Best for:** explore.pipeline, explore.landscape, compare.options.

**User job:** scan many things and decide what to open.

```text
Top: filters / scope / search / sort
Main: list, map, or comparison
Right: selected object preview
Action: Open in Workbench / Assess fit / Compare selected / Compose brief
Chat: helps refine query and scope
Inspector: opens after object selection
```

**Default visible blocks**

- OpportunityList
- NetworkMap or ComparisonMatrix
- ContextCard preview
- EvidenceStateSummary summary
- Open in Workbench action

**Never hide**

- filters;
- selected item;
- why relevant;
- open-in-workbench action.

---

### Template B — Workbench Decision Spine

**Best for:** assess.fit, translate.transfer, diagnose.gap, decide.pursue, act.next.

**User job:** work one decision up.

```text
Top: question + object + trust rail
Centre: decision spine / primary answer
Below-left: reasoning visual
Below-right: claims/evidence summary
Bottom: morph actions
Inspector: evidence/provenance drawer
Chat: explains and commands morphs
```

**Default visible blocks**

- RecommendationConfidence
- EvidenceStateSummary
- DimensionGap or MatchBench
- Top Evidence / Top Gaps
- Key morph actions

**Never hide**

- recommendation/current answer;
- confidence tier;
- evidence-state mix;
- main live gap;
- morph actions.

---

### Template C — Evidence Inspector / Defend Mode

**Best for:** defend.justify, explain.why, audit, panel challenge.

**User job:** stand behind the judgement under challenge.

```text
Top: defended recommendation + confidence
Left/main: objections, weak claims, challenge lines
Right/pinned: evidence inspector / provenance
Bottom: what would change conclusion + snapshot/export
Chat: acts as challenge partner
```

**Default visible blocks**

- ObjectionResponse
- ClaimLedger audit
- EvidenceStateSummary
- ProvenanceTrace
- RecommendationConfidence summary

**Never hide**

- evidence state;
- provenance;
- unknowns/live gaps;
- weak claims;
- what would change conclusion.

---

## 7. Data visual registry

The visual registry is the approved pantry of visuals. The visual selection engine chooses from it.

### 7.1 Registry principle

> Atlas should not choose visuals because they look impressive. It should choose visuals because they make a decision, gap, evidence state or defence clearer without overstating trust.

### 7.2 Visual selection pipeline

```text
User question
→ CanonicalQuestion
→ intent
→ layout template
→ block recipe
→ data shape check
→ eligible visuals
→ trust/provenance check
→ choose primary visual
→ add support text
→ attach inspector behaviour
→ fallback if data is weak
```

### 7.3 Fixed defaults vs dynamic visuals

Some visuals should stay stable because they are part of the trust grammar:

| Block | Fixed/default visual |
|---|---|
| EvidenceStateSummary | stacked evidence bar + cap note |
| ClaimLedger | audit table |
| ProvenanceTrace | evidence trail / citation stack |
| RecommendationConfidence | decision card |
| ObjectionResponse | challenge-response table |
| SnapshotBrief | brief outline |

Other blocks can use dynamic variants:

| Block | Default | Possible alternates |
|---|---|---|
| DimensionGap | source-target gap rows | gap matrix, causal map |
| MatchBench | requirement coverage matrix | fit scorecard, requirement-by-claim table |
| ComparisonMatrix | options × criteria | ranked options, trade-off scorecard |
| NetworkMap | relationship graph | stakeholder map, Sankey/flow if weighted |
| ActionPlan | checklist | timeline, roadmap, dependency view |
| OpportunityList | ranked list | domain heatmap, map, grouped table |

### 7.4 Visual support text

Every visual should include three text layers:

```text
1. Insight headline
2. Interpretation / so what
3. Trust / caveat
```

Example:

```text
Insight: Commercial delivery is the blocking gap.
So what: CPC has strong domain evidence, but the call needs supplier delivery of a digital tool.
Trust caveat: Confidence is capped because tool-delivery evidence is unknown/live-gap.
```

---

## 8. Visual Selection Contract

This is the bridge between the block library and visual registry.

| CQ-ID | Layout | Primary visual | Support visual | Audit/proof | Fallback |
|---|---|---|---|---|---|
| cq.explore.pipeline | Browse Command View | Ranked opportunity list | Evidence-state summary | Inspector on row/source | Unranked filtered list |
| cq.explore.landscape | Browse Command View | Relationship / stakeholder map | Selected object preview | Inspector on node/edge | Grouped entity list |
| cq.compare.options | Browse/Workbench | Options comparison matrix | Evidence-state summary | Criterion rationale inspector | Ranked option list |
| cq.read.object | Workbench Decision Spine | ContextCard + ClaimLedger summary | Evidence-state summary | ProvenanceTrace | Basic profile card |
| cq.assess.fit | Workbench Decision Spine | Requirement coverage matrix | DimensionGap | Requirement evidence inspector | Requirement checklist |
| cq.translate.transfer | Workbench Decision Spine | DimensionGap rows | TransferLanes | ClaimLedger / ProvenanceTrace | Gap table with unknown flags |
| cq.diagnose.gap | Workbench Decision Spine | Gap matrix or gap rows | Evidence-state summary | Inspector by gap/claim | Grouped gap list |
| cq.decide.pursue | Workbench Decision Spine | Recommendation card / options comparison | Evidence-state bar | Recommendation trail inspector | Decision note with caveats |
| cq.act.next | Workbench Decision Spine | Gap-to-action timeline/checklist | Gap summary | Action → linked gap inspector | Action checklist |
| cq.defend.justify | Evidence Inspector / Defend | Objection-response table | Claim audit ledger | ProvenanceTrace pinned | Risk/challenge list |
| cq.package.brief | Snapshot / Brief Builder | Snapshot brief outline | Evidence appendix | Included-block inspector | Plain text brief |
| cq.explain.why | Inspector morph | ProvenanceTrace | Confidence rule / claim rationale | Source trail | Explanation text with missing-data note |

### One visual or two?

Use:

```text
One dominant visual
+ one small trust/support visual
+ inspector/audit on click
```

Avoid showing five competing visuals at once in the main artifact.

---

## 9. Data requirements

The visual grammar creates a data backlog. Atlas should capture or derive these fields.

### 9.1 Claim fields

- claim_id
- claim_text
- evidence_state
- provenance
- confidence_tier
- source_container_id
- source_excerpt
- transfer_outcome
- change_condition
- related_requirement_id
- related_gap_id

### 9.2 Context/dimension fields

- dimension_id
- source_profile
- target_profile
- gap_magnitude
- gap_rationale
- affected_claim_ids
- evidence_state
- provenance

### 9.3 Opportunity/requirement fields

- opportunity_id
- funder
- deadline
- value
- requirement_id
- requirement_text
- coverage_state
- covered_by_claim_ids
- gap_state
- confidence_cap_reason

### 9.4 Relationship fields

- entity_a
- entity_b
- relationship_type
- relationship_strength
- evidence_state
- provenance
- direction
- weight

### 9.5 Action fields

- action_id
- action_text
- owner
- due_date
- sequence
- linked_gap_id
- status
- priority
- evidence_needed

---

## 10. Behaviour rules

| Behaviour | Use when |
|---|---|
| Expand inline | More detail within the same reasoning path |
| Inspector drawer | Evidence, provenance, confidence rule, source trail |
| Replace canvas | User changes intent / CanonicalQuestion |
| Chat command | User asks conversationally to morph, explain or refine |
| Snapshot | User wants a shareable/exportable truth object |
| Debug view | Builder/designer needs coverage map or recipe JSON |

---

## 11. Acceptance tasks

A user should be able to complete these tasks without your explanation.

### Task 1 — Should CPC pursue this?

Pass if user can identify:

- recommended move;
- confidence tier;
- main gap;
- best next action.

### Task 2 — Why is confidence capped?

Pass if user can find:

- evidence-state mix;
- cap reason;
- self-reported evidence issue;
- live gap.

### Task 3 — What should CPC do next?

Pass if user can find:

- action sequence;
- which gap each action closes;
- immediate next step.

### Task 4 — How would I defend this to a board?

Pass if user can find:

- claim audit;
- provenance;
- weak claims;
- objection-response;
- what would change the conclusion.

### Task 5 — How do I move from Browse to Workbench?

Pass if user can:

- select a relevant item;
- see why it is relevant;
- open/assess it in Workbench.

### Task 6 — Can Atlas choose the right visual?

Pass if the system can show:

- selected CanonicalQuestion;
- selected block;
- primary visual;
- why visual is eligible;
- fallback if data is incomplete;
- inspector behaviour.

---

## 12. Prototype map

| Prototype / spec | Role | Status |
|---|---|---|
| v0.5 Workbench Prototype | Product shell and interaction proof | Use as product-shell baseline |
| v0.6 Visual Registry Prototype | Visual-selection proof | Use as registry baseline |
| Interaction + Visual Grammar Spec | Chat/artifact/inspector behaviour | Folded into this master spec |
| Data Visual Registry Spec | Visual pantry and data requirements | Folded into this master spec |
| Omega Block Library | Stable block pantry | Keep as appendix/source |
| CanonicalQuestion Taxonomy | Question-to-recipe map | Keep as appendix/source |

---

## 13. Implementation sequence

### Phase 1 — Consolidated React prototype

Build one React prototype with:

- collapsed nav rail;
- persistent chat/copilot panel;
- main artifact;
- inspector drawer;
- debug toggle;
- three layout templates;
- visual registry;
- one CPC worked example.

### Phase 2 — Registry-driven rendering

Implement:

```text
question → recipe → layout → blocks → visual selection → inspector
```

Start with:

- EvidenceStateSummary;
- ClaimLedger;
- DimensionGap;
- TransferLanes;
- MatchBench;
- RecommendationConfidence;
- ActionPlan;
- ObjectionResponse.

### Phase 3 — Data integration

Map registry fields to Supabase tables:

- claims;
- passports / passport_claims;
- matches;
- live_calls;
- projects;
- organisations;
- evidence_containers;
- blocks / briefs if used for snapshots.

### Phase 4 — Confidence governance

Do not fake confidence.

Implement a confidence/cap service that explains:

- evidence-state distribution;
- provenance coverage;
- unknown/live gaps;
- contested claims;
- why the surface is Speculative / Indicative / Supported / Robust.

### Phase 5 — Snapshot / brief workflow

Implement:

- save current artifact;
- select included blocks;
- create board brief / defend pack;
- include evidence appendix;
- preserve live gaps and caveats.

---

## 14. Open decisions

These are the remaining meaningful questions.

| Decision | Recommendation |
|---|---|
| Browse as block or separate mode? | Use one grammar with Browse-many mode and Browse Command View |
| Chat left or right? | Left chat rail beside artifact; collapsible for stakeholder mode |
| Inspector drawer or pinned panel? | Drawer normally; pinned in Defend mode |
| Debug visible? | Hidden by default; builder toggle only |
| AI visual choice? | AI proposes from registry; product validates |
| One visual or many? | One dominant visual + one support/trust visual + inspector |
| Chart types now or later? | Registry now; polished chart implementation later |
| New visuals/components? | Allowed if they pass admission rule |

---

## 15. Definition of done for the next build

The next build is successful if:

1. The user can move from Browse → Workbench → Defend → Snapshot.
2. Chat can trigger the movement, but the artifact records the answer.
3. Every claim-bearing block shows evidence state and provenance.
4. The inspector can prove claims, gaps, recommendations and visuals.
5. Visuals are selected from the registry, not hardcoded randomly.
6. Unknowns/live gaps are shown explicitly.
7. Debug/coverage is available but hidden by default.
8. The same fixture can render different views without changing the underlying data.
9. A second fixture can be added without redesigning the UI.
10. The output can become a board brief or defend pack.

---

## 16. Final synthesis

Atlas is now best understood as:

```text
A governed evidence-composition system
wrapped in a chat-assisted workbench shell.
```

The stable architecture is:

```text
CanonicalQuestion taxonomy
+ block pantry
+ visual registry
+ layout templates
+ chat/artifact/inspector contract
+ snapshot workflow
```

The product promise is:

> Ask Atlas a strategic question. It composes a defensible artifact, shows how much to trust it, lets you inspect the proof, tells you what to do next, and packages the result for decision-makers.
