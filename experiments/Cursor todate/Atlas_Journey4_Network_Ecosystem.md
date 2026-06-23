# Atlas — Journey 4: The Network / Ecosystem
### Proof-of-format for relationship & "map the ecosystem" questions — and the sharpest data-liability case in the set

Fourth and final worked journey. It exercises the one shape the first three only ever rendered *sparse*: the **NetworkMap** — Atlas's named core differentiator (the cross-modal bridges). It also turns out to be the most important journey for a reason we didn't plan: **the data does not support the visual the question naively implies**, and the world-class response is to *diagnose that and render what's real* — exactly the liability you predicted three turns ago, caught live against the database.

Same five-layer structure, same harmonised sourcing. The network data is real and was *interrogated for structure*, not assumed.

Persona: **a CPC ecosystem lead asked to "map the partnership network around maritime decarbonisation so we know who to convene."**

---

## EXEC SUMMARY — the rules this journey establishes

1. **Anticipate the visual, then interrogate whether the data is the right *shape* for it — before drawing.** "Map the network" implies an actor-to-actor graph. The corpus does not store that. A naive renderer would draw an empty or near-empty graph and call it a finding. The skill must *check edge structure exists* before committing to a graph.
2. **There are several kinds of "network," and they are not interchangeable.** Actor-to-actor (collaboration), entity-to-mode (bipartite), mode-to-mode (adjacency). The data supports one of these richly and another not at all. Naming which one you're drawing is half the honesty.
3. **A graph with too few edges must degrade to a different shape, not a sad graph.** The maritime *actor* network has ~zero collaboration edges (each org has one project). The honest render is a *typed actor inventory*, not a force graph with no springs.
4. **The differentiator (cross-modal bridges) is real but is a *node property*, not an *edge*.** "418 bridges" = 418 entities that individually span modes — not 418 connections between actors. Surfacing this correctly is what makes the differentiator trustworthy rather than oversold.
5. **The mode-to-mode graph IS rich and IS the differentiator's true home** — 6 nodes, weighted edges, highways as hub. That graph is honest, glanceable, and genuinely unique to Atlas. Render *that* prominently.
6. **NetworkMap is a recipe with a fallback ladder:** force-graph (if edges dense) → ego-network (if one-node-centric) → typed inventory (if nodes-but-no-edges) → adjacency matrix (if dense-but-small). The renderer picks down the ladder by *measured edge density*, not by request.

---
---

# TURN 1 — ORIENT→MAP REQUEST
### *"Map the partnership network around maritime decarbonisation — who should we convene?"*

## Layer 1 — Answer

> **Before I draw anything: the corpus can map two of the three networks you might mean, and the third — the one your question implies — it genuinely cannot. Naming that is the honest starting point.** "Partnership network" implies *who works with whom*. But the maritime-decarbonisation organisations in the corpus are almost all single-project actors `[S1]` — there are essentially **no shared-project collaboration edges to draw**. A force-graph of "who partners with whom" would be a screen of disconnected dots, which would *look* like a finding ("no collaboration!") but would actually be a *data limit* masquerading as one.

**What the corpus genuinely contains, instead, are two real and useful structures:**

1. **A typed actor inventory** — the ecosystem *does* have a clear cast, just not yet connected: harbour authorities (Belfast, Portland, Aberdeen, Associated British Ports), combined authorities (North of Tyne, Orkney), industrials (BT, Siemens, 2-DTech), academia (Queen's University Belfast), and a relevant catapult (Offshore Renewable Energy Catapult) `[S1]`. That's a convening list — *who exists* — even without *who-works-with-whom*.

2. **The cross-modal bridge structure** — Atlas's differentiator — which is a **mode-to-mode** network, not an actor one (Turn 2).

**So the honest answer to "map the network" is: I can give you the cast of actors to convene, and the mode-level transfer map that tells you which adjacent fields to pull partners from — but I cannot draw a maritime-internal collaboration graph, because the collaborations either haven't happened yet or aren't recorded.** And that absence is itself the most actionable finding: *the maritime decarbonisation ecosystem is a set of isolated actors, not yet a network — which is precisely the gap a convening body like CPC exists to close.* The lack of edges is the business case. *Confidence: Supported — the actor inventory is hard corpus fact; the "not yet a network" reading is a direct, honest inference from the edge sparsity.*

## Layer 2 — Citations
| Marker | Source | Class | Trust note |
|---|---|---|---|
| S1 | `atlas.projects` lead orgs, maritime+decarbonisation | Corpus | HAVE — real orgs; **each has ~1 project = no co-occurrence edges** |

## Layer 3 — Data appendix
```
Maritime-decarb actor inventory (the nodes — typed):
  HARBOUR AUTH:   Belfast Harbour (2 proj, £33.5m), Portland Port, Aberdeen Harbour, Associated British Ports
  COMBINED AUTH:  North of Tyne, Orkney Islands Council
  INDUSTRIAL:     BT, Siemens PSE, 2-DTech, EV Dot Energy, Apollo Engineering
  ACADEMIC:       Queen's University Belfast
  CATAPULT:       Offshore Renewable Energy Catapult
EDGE CHECK: nearly all orgs have project_count = 1 → no shared-project edges → NOT a drawable collaboration graph
```

## Layer 4 — Search-sufficiency trace
| Anticipated shape | Query | Came back | Verdict | Final shape |
|---|---|---|---|---|
| **Actor force-graph** ("who partners whom") | Supabase orgs by maritime-decarb | 20 orgs, **nearly all single-project** | ❌ **Anticipated-shape-NOT-honoured** — no edges exist | **Degrade** → typed actor inventory |
| **Typed actor inventory** | same data, grouped by org type | Clean cast, clear types | ✅ Honoured (the fallback) | typed inventory |
| **"Not yet a network" insight** | (inference from edge absence) | The absence IS the finding | ✨ Richer-shape — the missing edges are the business case | Surfaced as the lead insight |

**Incompleteness:** *Structurally absent* — actor-to-actor edges are not in the corpus (a relationship table would be needed). **Patchy-data move:** **convert gap → recommendation** — "the ecosystem isn't yet connected; that's the convening opportunity." The textbook honest move, and here the absence is *more* valuable than a graph would have been.

## Layer 5 — Component sort
- **The "three networks, I can draw two" framing:** → prose / GenUI. The reasoning that prevents the dishonest graph.
- **The typed actor inventory:** → **`NetworkMap` degraded to a typed-node inventory** (or `OpportunityList` grouped by actor-type). Nodes shown, *no fake edges drawn*. This is the fallback-ladder rule in action.
- **The "not yet a network" insight:** → `RecommendationConfidence` sentence variant — the absence-of-edges as the convening case.

---
---

# TURN 2 — CONNECT→THE REAL NETWORK
### *"OK, then show me the cross-modal map — where does maritime connect to other modes?"*

## Layer 1 — Answer

> **This is where Atlas's differentiator earns its name — and it's a genuinely rich, honest graph: a six-node mode-to-mode network with highways as the unmistakable hub.** Unlike the actor graph, this one has real, weighted edges and a clear structure.

**The network (modes as nodes, edges weighted by shared bridging entities) `[S2]`:**
- **Highways is the hub** — it connects to every other mode and carries the heaviest edges: Highways↔Rail (121 combined), Highways↔Digital (101), Highways↔Aviation (75), Highways↔Maritime (40).
- **Maritime's position** — it links most strongly to **Highways (40)** and **Digital (32 combined)**, and barely to Rail (8) or Aviation (10). So maritime's transfer neighbours are highways and digital, full stop.
- **Edge *quality* inverts the volume story** — maritime's edges are the *strongest* in the network despite being fewest: Maritime↔Digital runs 0.84–0.87, Maritime↔Highways 0.83–0.86 `[S2]`, against a network average around 0.80. Maritime has *few but excellent* connections.

**What this means for convening.** If the actor network (Turn 1) tells you the maritime ecosystem is a set of isolated actors, this mode network tells you *where to import partners from*: the highways and digital fields are maritime's strongest transfer neighbours, so the convening strategy is **not** "find maritime partners" (there are few) — it's "**bring highways and digital decarbonisation actors into a maritime room**," because the bridge structure says their proof transfers best. The two networks combine into a single recommendation: convene the isolated maritime actors *plus* imported highways/digital actors, around the strongest bridges.

**One honest caveat on the differentiator.** These "bridges" are a *node property*, not actor edges — they're 251 projects + 167 live-calls that each individually span ~3–4 modes `[S3]`. So the mode-to-mode graph is real, but it's built by aggregating *which modes each cross-cutting entity touches*, not by observing actors collaborating. That's a legitimate and useful network — but it's "modes that co-occur in cross-cutting work," not "organisations that partner." Naming that keeps the differentiator trustworthy. *Confidence: Supported — real weighted edges, honestly characterised.*

## Layer 2 — Citations
| Marker | Source | Class | Trust note |
|---|---|---|---|
| S2 | `atlas.cross_modal_bridges` grouped by dominant_pair | Corpus | HAVE — 12 weighted mode-edges, real scores |
| S3 | `cross_modal_bridges` by entity_type | Corpus | HAVE — 251 projects + 167 live_calls; avg 3.3–3.9 modes each |

## Layer 3 — Data appendix
```
Mode-to-mode network (nodes = 6 modes; edges = shared bridging entities, weighted):
  Highways↔Rail      121 edges  @ 0.79-0.81   ← heaviest
  Highways↔Digital   101        @ 0.78-0.86
  Highways↔Aviation   75        @ 0.79-0.81
  Highways↔Maritime   40        @ 0.83-0.86
  Maritime↔Digital    32        @ 0.84-0.87   ← maritime's strongest
  Aviation↔Digital    19        @ 0.79-0.88
  (Rail↔Aviation ~5, the weakest edge in the network)
Differentiator structure (the honest characterisation):
  418 "bridges" = 251 projects + 167 live_calls, each spanning avg 3.3-3.9 modes
  → it is a NODE PROPERTY (entity spans modes), aggregated into mode-edges
  → NOT actor-to-actor collaboration edges
```

## Layer 4 — Search-sufficiency trace
| Anticipated shape | Query | Came back | Verdict | Final shape |
|---|---|---|---|---|
| **Mode-to-mode force graph** | bridges grouped by pair | 12 weighted edges, 6 nodes, clear hub | ✅ **Honoured — richly** | NetworkMap (force graph) — finally at full density |
| **Differentiator characterisation** | bridges by entity_type | Revealed it's node-property not edges | ✨ **Critical structural finding** | Honest caveat, prevents oversell |
| **Edge-quality-vs-volume** | avg score per pair | Maritime fewest-but-strongest | ✨ Richer-shape | Highlighted (edge width vs colour) |

**Incompleteness:** none for the mode graph — this is the one shape the corpus *fully* honours. **Patchy-data move:** **surface the differentiator's true structure honestly** — characterise it as node-property-aggregated, not actor edges. This is the difference between a trustworthy differentiator and an oversold one.

## Layer 5 — Component sort (the NetworkMap recipe, finally at full density)
- **The mode-to-mode graph:** → **`NetworkMap` / `knowledge_graph` (ECharts force) at full density** — 6 nodes, 12 weighted edges, highways visually central. *Edge width = volume, edge colour = strength* (so the "maritime fewest-but-strongest" insight is visible: thin but bright edges). This is the differentiator's true visual home and the first time across four journeys it renders rich.
- **The convening recommendation:** → `RecommendationConfidence` sentence variant — "convene maritime + imported highways/digital actors."
- **The differentiator caveat:** → `EvidenceStateSummary` — "bridges are a node property, not actor edges" as a trust note attached to the graph, not buried.

---
---

# TURN 3 → DIAGNOSE→THE CONVENING GAP
### *"So who, specifically, should be in the room — and what's missing?"*

## Layer 1 — Answer

> **The room has three groups, and the most important attendee is the one the data says is absent.** Combining both networks gives a specific, defensible convening list — plus a named structural hole.

**Group 1 — the maritime anchors (from the actor inventory).** Belfast Harbour (the £33.5m anchor, live to 2026), Portland Port (HydroPort, live to 2026), Aberdeen Harbour (proven shore-power site), Associated British Ports `[S1]`. These are the conveners' core — real, live, maritime-decarbonisation actors.

**Group 2 — the imported transfer neighbours (from the mode graph).** Because maritime's strongest bridges are to highways and digital `[S2]`, the room should import decarbonisation actors from those fields — highways electrification and digital-systems players whose proof the bridge structure says transfers best. This is the non-obvious convening move the network analysis unlocks: *don't fill the room with maritime specialists, fill the gaps with highways/digital ones.*

**Group 3 — the catalyst.** Offshore Renewable Energy Catapult is in the corpus `[S1]` and is the natural cross-cutting infrastructure partner (ports + renewables + decarbonisation).

**The named hole.** Two structural absences the data makes explicit: (1) **no existing collaboration links** between any of these actors — the room would be a *first* convening, not a reinforcement of existing ties (Turn 1); and (2) **CPC's own position is invisible** — TRIG isn't in the corpus, so whether CPC has already convened any of these actors cannot be checked `[GAP]`. The honest convening brief is therefore: *this is a cold-start network, and you should confirm against TRIG whether any of these relationships already exist before assuming the room is new.* *Confidence: Supported on the cast; Indicative on "cold-start" because the TRIG blind-spot could hide existing ties.*

## Layer 2 — Citations
| Marker | Source | Class | Trust note |
|---|---|---|---|
| S1 | actor inventory (T1) | Corpus | HAVE |
| S2 | mode bridges (T2) | Corpus | HAVE |
| GAP | TRIG absence | Corpus-absence | The load-bearing caveat — could hide existing CPC ties |

## Layer 3 — Data appendix
```
Convening list (synthesised from both networks):
  ANCHORS (maritime, live):   Belfast Harbour, Portland Port, Aberdeen Harbour, ABP
  IMPORTS (transfer-neighbour): highways-decarb + digital-decarb actors (per strongest bridges)
  CATALYST:                   Offshore Renewable Energy Catapult
STRUCTURAL HOLES:
  (1) zero existing collaboration edges → cold-start convening
  (2) TRIG invisible → cannot confirm CPC's existing relationships
```

## Layer 4 — Search-sufficiency trace
| Anticipated shape | Source | Result | Verdict | Final shape |
|---|---|---|---|---|
| **Convening list** | synthesise T1 actors + T2 bridges | Specific, typed, defensible | ✅ Honoured | typed list / annotated network |
| **"Who's missing"** | edge-absence + TRIG gap | Two named holes | ✅ Honoured (as declared gaps) | AnswerabilityCard |
| **Re-search** | — | None — synthesises T1+T2 state | ✨ Journey state re-use | — |

**Patchy-data move:** **convert gaps to actions** (import transfer-neighbours; confirm against TRIG) — both holes become convening instructions.

## Layer 5 — Component sort
- **The three-group convening list:** → `NetworkMap` annotated (anchors + imports + catalyst as typed nodes) OR `OpportunityList` grouped by role. The network view is better here because the *relationships-to-be-built* are the point.
- **The two structural holes:** → `AnswerabilityCard` (cold-start + TRIG blind-spot).
- **The import-from-adjacent-modes move:** → `ActionPlan` — the primary convening action.

---
---

# TURN 4 → DEFEND→THE ECOSYSTEM BRIEF
### *"Give me the convening brief, and defend why this room and not a bigger one."*

## Layer 1 — Answer

> **Convene a focused room of ~8–10: the four maritime anchors, a small set of imported highways/digital decarbonisation actors, and Offshore Renewable Energy Catapult as catalyst — and the defence of "why not bigger" is that the network structure says breadth would dilute, not strengthen.**

**Why this room (the positive case).** It's built from two real structures, not intuition: the actor inventory supplies live maritime anchors `[S1]`; the mode-to-mode bridge graph supplies the *specific* adjacent fields whose proof transfers best (highways, digital — maritime's strongest edges at 0.83–0.87) `[S2]`. Offshore Renewable Energy Catapult bridges ports and renewables. Every attendee is justified by a data relationship, not a guess.

**Why not bigger (the defence against scope-creep).** Three reasons the network analysis gives: (1) maritime's transferable connections are *concentrated* in two modes — adding rail or aviation actors brings weak-bridge proof (Maritime↔Rail ≈8, Maritime↔Aviation ≈10) `[S2]` that won't transfer, so they'd be passengers not contributors; (2) the maritime actor base is *genuinely small* (≈26 orgs) `[S1]` — there aren't more strong maritime anchors to add; (3) a cold-start network (no existing edges) forms better small — you're building first relationships, and first relationships need a room people can actually connect in.

**The honest concession.** This rests on the corpus's view, which (a) cannot see CPC's own prior convening (TRIG) `[GAP]`, and (b) characterises "bridges" as cross-cutting entity properties rather than observed collaborations (Turn 2) — so the transfer logic is *structural inference*, strong but not proof of real working relationships. The brief should be acted on as a well-grounded first convening, confirmed against TRIG, not as a map of relationships already known to work. *Overall confidence: Supported, conditional on TRIG check — and explicitly a structural-inference network, not an observed-collaboration one.*

## Layer 2 — Citations
*(All markers as Turns 1–3; Defend re-uses accumulated journey state, no new searches.)*

## Layer 3 — Data appendix
```
ECOSYSTEM CONVENING BRIEF:
  ROOM (~8-10): Belfast Harbour, Portland Port, Aberdeen Harbour, ABP (anchors)
                + 2-3 highways/digital decarb actors (imports, strongest bridges)
                + Offshore Renewable Energy Catapult (catalyst)
  WHY NOT BIGGER: weak bridges to rail/aviation; small maritime base; cold-start forms better small
  CONCESSIONS: TRIG-invisible; bridges = structural inference not observed collaboration
  GATE: confirm against TRIG before assuming room is "new"
```

## Layer 4 — Search-sufficiency trace
| Anticipated shape | Source | Result | Verdict | Final shape |
|---|---|---|---|---|
| **Ecosystem convening brief** | reuse all turns | Complete, defensible | ✅ Honoured | annotated NetworkMap + brief |
| **New searches** | — | None — full journey-state re-use | ✨ Confirmed across all 4 journeys | — |

**Patchy-data move:** **condition on the TRIG gate + name the inference limit** — the two honest caveats become explicit qualifiers on the brief.

## Layer 5 — Component sort
- **The convening brief:** → **`NetworkMap` at full extension** (anchors + imports + catalyst, typed and annotated) = the ecosystem map. The Snapshot/Brief freeze point.
- **"Why this room not bigger":** → `ObjectionResponse` — the defence against scope-creep, claim-by-claim.
- **The TRIG gate + inference caveat:** → `EvidenceStateSummary` + `ActionPlan` (one primary gated action).
- **Whole turn:** → **Snapshot/Brief** — the portable convening one-pager.

---
---

# What Journey 4 adds — and what the full set of four now proves

**Journey 4's unique contribution: the data-liability you predicted, caught live.** The question implied an actor-collaboration graph; the corpus doesn't store one; a naive renderer would have drawn an empty graph and called the emptiness a finding. The world-class response *interrogated the edge structure first*, degraded to a typed inventory, found the real (mode-to-mode) network, and characterised the differentiator honestly as a node-property not an edge. **This is the single most important behaviour for Cursor to encode: check edge density before committing to a graph; degrade down the fallback ladder; never draw a sad graph.**

**It corrects a live oversell risk in the product itself.** The "418 cross-modal bridges = core differentiator" framing is true but was structurally misunderstood: they're cross-cutting *entities*, not actor *connections*. The mode-to-mode graph they aggregate into IS rich and IS unique — but calling them "bridges between organisations" would be wrong. This is a real finding for the product, not just the format.

**NetworkMap is now specced as a fallback ladder**, not a single visual: force-graph → ego-network → typed inventory → adjacency matrix, selected by *measured edge density*. That's the most sophisticated component spec in the set and it generalises the degradation rule from Journey 1's sparse rail graph.

---

## The four-journey set: what it establishes (the skill is now extractable)

Across Orient/Diagnose/Decide/Defend × four answer-families (decision, economic, comparison, network), the patterns have converged — which by the anti-loop rule is the signal to stop generating and extract:

1. **Quality lives in the reasoning, not the components.** Every journey's best moments — the two-tier framing, the £160 switching value, the named comparison weighting, the "not yet a network" insight — are *agent reasoning*. No block produces them. **This is the headline for the whole exercise: Atlas's "ok, not great" outputs are a reasoning-skill gap, not a component gap.**

2. **The "big" blocks are recipes, fortified.** EconomicCase, ComparisonMatrix, and NetworkMap are each compositions of 4–5 visual recipes with internal logic (fallback ladders, switching values, named weightings) — confirming they stay recipes, but must be richly specced, not thin cards.

3. **Honest degradation is a first-class behaviour.** Sparse graphs degrade; composite scores get refused; missing edges become recommendations; blind-spots become gates. The renderer must support *deliberate absence and downgrade*, not only presence.

4. **The search changes with the question-type.** Orientation fetches aggregates; economic fetches cost-analogues + benefit-benchmarks; comparison fetches multi-criteria matrices; network *interrogates edge structure before drawing*. The skill's first move is always "fetch to the anticipated shape's data grain — and verify the shape is honoured."

5. **State accretes across the journey.** Defend/package never re-searched in any journey — it composed accumulated evidence. The artifact carries state; the hero verdict persists and evolves; supporting shapes swap. This is the "organic healing surface."

6. **Harmonisation generates insight neither source holds.** Corpus + web together produced the two-tier rail finding, the ETS-switching-value economic case, the policy-driver comparison scores, and the honest differentiator characterisation. The blend is not citation hygiene — it's where the insight lives.

**Recommendation:** four journeys is enough. The next move is not a fifth journey — it's extracting these six patterns into the **Atlas Answer-Quality Skill** (the reasoning standard the agent follows *before* rendering) plus the **component/recipe build-list** (the fortified recipes + fallback ladders). That skill + build-list is the blueprint the whole exercise was for.

---

*Journey 4 complete. Network data interrogated for structure, not assumed — the edge-structure finding is real and corrects a live product oversell. The four-journey set is now sufficient to extract the answer-quality skill and the component build-list.*
