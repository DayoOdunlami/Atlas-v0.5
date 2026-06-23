# Atlas — Journey 4 (v2): The Network / Ecosystem — Harmonised
### Rebuilt with the parallel web pass that the first draft omitted — and which *corrected its central finding*

This is the corrected Journey 4. The first draft was grounded in Supabase only and concluded the maritime decarbonisation ecosystem was "a set of isolated actors, not yet a network." **That conclusion was wrong** — an artefact of the corpus storing only *lead* organisations per project, which collapses multi-partner consortia to single nodes and erases every collaboration edge. The parallel web pass reveals a dense, already-formed network — *with CPC already inside it.*

This rebuild is kept deliberately transparent about the correction, because the correction **is** one of the most important findings in the whole exercise: **for network/ecosystem questions, the corpus systematically under-reads, and the web pass is mandatory — not optional enrichment.**

Same five-layer structure. Persona unchanged: **a CPC ecosystem lead asked to "map the partnership network around maritime decarbonisation so we know who to convene."**

---

## EXEC SUMMARY — the rules this journey establishes (revised)

1. **The corpus under-reads networks; for relationship questions the web pass is mandatory.** The corpus stores lead-org-only, so consortia vanish into single nodes. A network question answered from the corpus alone will falsely report "no network exists." The web pass is where the edges live.
2. **A single-source answer can be confidently, fluently wrong.** The corpus-only draft was internally coherent and well-reasoned — and its headline was false. Fluency is not correctness. Harmonisation is the guard.
3. **Three kinds of "network," and the corpus and web hold different ones.** Actor-collaboration (web has it, corpus doesn't), entity-to-mode (corpus has it), mode-to-mode adjacency (corpus has it). The honest map needs both sources.
4. **The differentiator (cross-modal bridges) is real but is a node property, not an edge** — still true, still important to characterise honestly (unchanged from draft).
5. **NetworkMap is a recipe with a fallback ladder** selected by *measured edge density* — but density must be measured across *both* sources, or the corpus's structural blindness forces a wrong downgrade.
6. **The most decision-relevant fact can be the one the corpus is structurally blind to.** Here: CPC is *already* a convening hub in two key consortia. The corpus couldn't see it (no TRIG, lead-org-only); the web made it the headline.

---
---

# TURN 1 — ORIENT→MAP REQUEST
### *"Map the partnership network around maritime decarbonisation — who should we convene?"*

## Layer 1 — Answer

> **The corpus and the web tell opposite stories here — and the web is right. Read from the corpus alone, this looks like a field of isolated single-project actors with no collaborations. Read with the web, it is a dense, already-formed network of consortia — and CPC is already inside the most important ones.** The discrepancy is not noise; it is the corpus's structural limit, and naming it is the honest starting point.

**Why the corpus mis-reads it.** The maritime-decarbonisation organisations in the corpus almost all show a single project each `[S1]`, which *looks* like "no shared work, no edges." But the corpus records only the **lead** organisation per project. A multi-partner consortium of eight organisations appears as one node `[S1]`. So the apparent isolation is an artefact of the data model, not a fact about the ecosystem.

**What the web reveals — a warm, connected network.** The same actors are densely collaborating, in named consortia `[W1][W2]`:
- **Port of Aberdeen "Shore Power in Operation"** — a live consortium of Port of Aberdeen + **Connected Places Catapult** + DOF Subsea + Tidewater Marine + OSM Thome + University of Manchester's Tyndall Centre, with Buro Happold and Energy Systems Catapult `[W1][W3]`.
- **Irish Sea Green Shipping Corridor (Belfast–Liverpool)** — **CPC** + Royal HaskoningDHV + Liverpool John Moores University + University of Liverpool + Queen's University Belfast + Mersey Maritime `[W2]`.
- **ABP North Sea CO₂ corridor** — Associated British Ports + LBC Tank Terminals + North Sea Port (MoU) `[W4]`.

**The single most important fact, which the corpus is structurally blind to:** **CPC is already a convening hub in this ecosystem** — in the Aberdeen consortium *and* the Irish Sea corridor `[W1][W2]`. The corpus can't see this because CPC's own programmes (TRIG) aren't ingested and CPC appears only as a non-lead partner. So the real answer to "who should we convene" is not "assemble a new room" — it is **"you are already in two of the key rooms; the move is to connect the consortia you already sit in."** That reframes the entire task from cold-start convening to warm-network bridging. *Confidence: Supported — the consortia are named in multiple primary-ish sources; exact membership lists may be partial, and currency (live vs recently-concluded) should be checked before acting.*

## Layer 2 — Citations
| Marker | Source | Class | Trust note |
|---|---|---|---|
| S1 | `atlas.projects` lead orgs, maritime+decarbonisation | Corpus | HAVE — but **lead-org-only**; collapses consortia → the source of the mis-read |
| W1 | Port of Aberdeen — "Shore Power in Operation" consortium membership | Web (port operator) | Primary-ish; promotional tone; membership solid, completeness uncertain |
| W2 | Haskoning — Irish Sea Green Shipping Corridor, CPC-led report | Web (consultancy) | Primary-ish; names the consortium incl. CPC |
| W3 | Safety4Sea / Port of Aberdeen — consortium reconfirmed | Web | Corroborates W1 (second source) |
| W4 | Associated British Ports — North Sea CO₂ corridor MoU | Web (port operator) | Primary; an MoU = intent, not yet delivery |

## Layer 3 — Data appendix
```
CORPUS VIEW (lead-org-only → looks edgeless):
  20 orgs, nearly all project_count = 1 → "no collaboration edges" ← ARTEFACT
WEB VIEW (real consortia → dense edges):
  Aberdeen "Shore Power in Operation": Port of Aberdeen — CPC — DOF Subsea — Tidewater —
     OSM Thome — Tyndall(Manchester) — Buro Happold — Energy Systems Catapult
  Irish Sea Corridor: CPC — Royal HaskoningDHV — LJMU — U.Liverpool — QUB — Mersey Maritime
  ABP North Sea CO2: ABP — LBC — North Sea Port (MoU)
KEY FACT corpus is blind to: CPC is a node INSIDE two consortia (not an outside convener)
```

## Layer 4 — Search-sufficiency trace
| Anticipated shape | Source | Came back | Verdict | Final shape |
|---|---|---|---|---|
| **Actor force-graph** | Supabase orgs | single-project each → *apparently* edgeless | ❌ **Corpus mis-reads** — would falsely show "no network" | **Must consult web before concluding** |
| **Actor force-graph** | **Web pass (parallel)** | named consortia with real edges | ✅ **Honoured — the web has the edges** | NetworkMap (real collaboration graph) |
| **CPC's own position** | corpus (TRIG absent) vs web | corpus blind; web shows CPC inside 2 consortia | ✨ **Web supplies the decisive fact** | Reframes the whole answer |

**Incompleteness:** the corpus's actor-edge absence is *structural* (lead-org-only) — **not** a true absence of collaboration, which is the trap the draft fell into. **Patchy-data move:** **the web pass corrects the corpus**, rather than the corpus's gap being surfaced as a finding. This is the key methodological lesson: *a corpus gap is sometimes a corpus defect, and the second source is how you tell the difference.*

## Layer 5 — Component sort
- **The corpus-vs-web discrepancy + reframe:** → prose / GenUI. The reasoning that prevents the false "isolated actors" conclusion.
- **The real consortium network:** → **`NetworkMap` force graph** — actors as nodes, consortium membership as edges, CPC highlighted as a hub. This is the actor-collaboration graph the draft wrongly thought didn't exist.
- **"CPC is already inside" insight:** → `RecommendationConfidence` sentence variant — the reframe from cold-start to warm-bridging.

---
---

# TURN 2 — CONNECT→THE TWO NETWORKS, RECONCILED
### *"Show me how the actor network and the cross-modal map fit together."*

## Layer 1 — Answer

> **There are two real networks and they answer different questions: the web-sourced *actor network* tells you who already works together; the corpus-sourced *mode network* tells you where proof transfers. Used together they give a convening strategy neither gives alone.**

**The actor network (web) — who is already connected.** Two CPC-anchored consortia plus an ABP-led one `[W1][W2][W4]`. The structure: CPC sits at the intersection of the Aberdeen (shore-power/operations) and Irish Sea (corridor/fuels) consortia — making it the **natural bridge node** between two clusters that don't yet directly connect. Aberdeen's cluster is operations-and-infrastructure heavy (ports, vessel operators, engineering); the Irish Sea cluster is academic-and-corridor heavy (three universities, a consultancy, a maritime body). They share CPC and little else.

**The mode network (corpus) — where proof transfers.** Unchanged from the corrected analysis: a six-node mode-to-mode graph with highways as hub, where maritime links most strongly to highways (40) and digital (32 combined), with the *strongest* edge quality in the network (0.83–0.87) despite the fewest connections `[S2]`. The "418 bridges" remain a **node property** (251 projects + 167 live-calls each spanning ~3–4 modes) `[S3]`, honestly characterised — not actor edges.

**How they combine into strategy.** The actor network says CPC already bridges two maritime consortia. The mode network says maritime's transferable proof comes from highways and digital. So the convening move is precise: **CPC should connect its two existing maritime consortia to each other, and import highways/digital decarbonisation actors into the combined room** — because (a) CPC already has the relationships to do the first, and (b) the bridge structure says the second is where transferable proof lives. The two networks are complementary: one supplies the *existing relationships*, the other the *missing-but-valuable* ones. *Confidence: Supported on both networks; the actor network's currency (are both consortia still live?) is the main check needed.*

## Layer 2 — Citations
| Marker | Source | Class | Trust note |
|---|---|---|---|
| W1,W2,W4 | the three consortia (T1) | Web | actor edges |
| S2 | `atlas.cross_modal_bridges` by pair | Corpus | mode edges — real weighted graph |
| S3 | `cross_modal_bridges` by entity_type | Corpus | differentiator = node property, honest characterisation |

## Layer 3 — Data appendix
```
ACTOR NETWORK (web) — two CPC-anchored clusters + one ABP cluster:
  Cluster A (Aberdeen, ops/infra): Port of Aberdeen, DOF Subsea, Tidewater, OSM Thome,
     Tyndall, Buro Happold, Energy Systems Catapult  — bridged by CPC
  Cluster B (Irish Sea, academic/corridor): RHDHV, LJMU, U.Liverpool, QUB, Mersey Maritime — bridged by CPC
  Cluster C (ABP North Sea CO2): ABP, LBC, North Sea Port
  → CPC = articulation point between A and B (they share only CPC)
MODE NETWORK (corpus) — 6 nodes, highways hub; maritime↔highways/digital strongest-but-fewest
COMBINED STRATEGY: connect A↔B (CPC already in both) + import highways/digital actors (strongest bridges)
```

## Layer 4 — Search-sufficiency trace
| Anticipated shape | Source | Result | Verdict | Final shape |
|---|---|---|---|---|
| **Actor collaboration graph** | web | two clusters, CPC as articulation point | ✅ Honoured (web) | NetworkMap (actor) |
| **Mode-to-mode graph** | corpus | 6 nodes, weighted, hub | ✅ Honoured (corpus) | NetworkMap (mode) |
| **Reconciliation of the two** | both | complementary, not redundant | ✨ Harmonisation insight | dual-network view |

**Patchy-data move:** **harmonise — each source supplies the network the other can't.** This is the cleanest demonstration in the whole set that the two sources are *structurally* complementary, not just corroborating.

## Layer 5 — Component sort
- **Actor network:** → `NetworkMap` force graph (web-sourced), CPC highlighted as articulation point.
- **Mode network:** → `NetworkMap` force graph (corpus-sourced) — the differentiator at full density.
- **The reconciliation:** → prose + possibly a small dual-panel; the *insight* (CPC bridges A and B; import from highways/digital) is the verdict, rendered as `RecommendationConfidence`.
- **Differentiator caveat:** → `EvidenceStateSummary` — bridges = node property.

---
---

# TURN 3 — DIAGNOSE→THE CONVENING GAP (corrected)
### *"So who should be in the room — and what's actually missing?"*

## Layer 1 — Answer

> **The room mostly already exists — the gap is not "who to invite" but "two clusters that share only CPC, and one whole transfer-neighbour group that's absent."** The corrected diagnosis is sharper than the draft's because it's working from the real network, not the corpus artefact.

**What already exists (don't re-convene it).** CPC sits in two live-ish maritime consortia `[W1][W2]`. The actors are already in rooms — just not the *same* room. Re-inviting them as if starting fresh would be the error the corpus-only draft would have led to.

**The two real gaps.**
1. **The A–B articulation gap.** The Aberdeen operations cluster and the Irish Sea academic/corridor cluster share *only* CPC `[W1][W2]`. That makes CPC a single point of connection — valuable (CPC is the bridge) but fragile (if CPC steps back, the clusters disconnect). The convening opportunity is to thicken the A–B connection beyond just CPC.
2. **The transfer-neighbour absence.** Neither consortium includes the highways/digital decarbonisation actors that the mode network says carry maritime's most transferable proof `[S2]`. That's the genuinely *missing* group — present in neither existing room.

**The corpus-blindness caveat, now correctly weighted.** TRIG is still absent `[GAP]`, so CPC's *full* set of maritime relationships may be larger than the two web-visible consortia — meaning the network is *at least* as connected as shown, possibly more. (Note this is the opposite of the draft's framing: the corpus gap means we're *under*-counting CPC's connectedness, not that the network is cold.) *Confidence: Supported on the two named gaps; the TRIG gap means CPC's true centrality is a floor, not a ceiling.*

## Layer 2 — Citations
| Marker | Source | Class | Trust note |
|---|---|---|---|
| W1,W2 | the two CPC consortia | Web | actor edges |
| S2 | mode bridges | Corpus | transfer-neighbour identification |
| GAP | TRIG absence | Corpus-absence | now means CPC is *at least* this connected — a floor |

## Layer 3 — Data appendix
```
GAP ANALYSIS (corrected):
  EXISTS: CPC in Cluster A (Aberdeen) + Cluster B (Irish Sea) — already convened
  GAP 1: A and B share ONLY CPC → thicken A-B connection (reduce single-point-of-failure)
  GAP 2: highways/digital transfer-neighbours absent from both → the genuinely missing group
  CAVEAT: TRIG absent → CPC's true connectedness is a FLOOR (under-counted), not cold-start
```

## Layer 4 — Search-sufficiency trace
| Anticipated shape | Source | Result | Verdict | Final shape |
|---|---|---|---|---|
| **Gap analysis** | web actor net + corpus mode net | two real gaps, correctly signed | ✅ Honoured | gap inventory |
| **Re-search** | — | none — synthesises T1+T2 | ✨ journey-state re-use | — |

**Patchy-data move:** **convert gaps to actions** (thicken A–B; import transfer-neighbours) + **correctly sign the corpus gap** (under-count, not absence). The draft mis-signed this — the corrected version treats TRIG-blindness as "CPC is *at least* this central."

## Layer 5 — Component sort
- **The "room already exists, here are the two gaps" diagnosis:** → `DimensionGap` (the two gaps, magnitude-coded) + prose for the reframe.
- **The A–B articulation point:** → `NetworkMap` annotated (CPC highlighted as the sole bridge between clusters).
- **The corpus-blindness caveat:** → `AnswerabilityCard` — but correctly signed as "under-count," not "cold-start."

---
---

# TURN 4 — DEFEND→THE ECOSYSTEM BRIEF (corrected)
### *"Give me the convening brief — and defend the approach."*

## Layer 1 — Answer

> **Recommendation: don't convene a new network — bridge the two you already anchor, and import the transfer-neighbours that are missing from both. The defence is that the data (once read correctly across both sources) shows CPC is already the central connector, so the highest-leverage move is to use that position, not rebuild from scratch.**

**The brief.** Three actions, in leverage order:
1. **Connect Cluster A to Cluster B.** CPC already sits in both the Aberdeen shore-power consortium and the Irish Sea corridor `[W1][W2]`; they currently share only CPC. Convene a combined session — CPC's existing relationships make this low-friction and high-value (two clusters, ~13 organisations, currently linked by a single node).
2. **Import highways/digital decarbonisation actors.** The mode network shows these carry maritime's most transferable proof `[S2]`; neither consortium contains them. This is the genuinely additive invitation.
3. **Confirm against TRIG.** CPC's full maritime footprint is under-counted by the corpus `[GAP]`; check TRIG before assuming the two web-visible consortia are the whole picture — there may be more existing relationships to build on.

**The defence (why this, not a bigger cold-start room).** First, the data says the network already exists and CPC is central to it `[W1][W2]` — starting cold would waste an existing position. Second, the transfer logic is specific: import highways/digital, not rail/aviation, because the bridge structure says only the former transfer well `[S2]`. Third — and this is the honest methodological defence — **the first version of this analysis, from the corpus alone, concluded the opposite (isolated actors, cold-start). It was wrong because the corpus stores lead-org-only. The corrected brief rests on the harmonised reading, and is explicit that the corpus alone would have misled.** That transparency is the strongest defence: the recommendation survives precisely because it was stress-tested against its own single-source error.

**The concession.** The actor network is from promotional/consortium sources `[W1–W4]` — the *existence* of the consortia is solid, but exact membership and *current* live-status need confirming before the combined session is planned. And the differentiator remains a structural-inference network (node-property bridges), not observed actor collaboration on the mode side. *Overall confidence: Supported, conditional on (a) consortium currency check and (b) TRIG confirmation.*

## Layer 2 — Citations
*(All markers as Turns 1–3; Defend re-uses accumulated journey state, no new searches.)*

## Layer 3 — Data appendix
```
ECOSYSTEM CONVENING BRIEF (corrected):
  ACTION 1: Connect Cluster A (Aberdeen ops) ↔ Cluster B (Irish Sea academic) — CPC already in both
  ACTION 2: Import highways/digital decarb actors (strongest bridges; absent from both clusters)
  ACTION 3: Confirm against TRIG (CPC footprint under-counted by corpus)
  DEFENCE: network already exists + CPC central; corpus-only draft was WRONG (lead-org artefact)
  CONCESSIONS: consortium sources promotional; currency unconfirmed; mode-bridges = structural inference
  GATES: (1) consortium live-status  (2) TRIG check
```

## Layer 4 — Search-sufficiency trace
| Anticipated shape | Source | Result | Verdict | Final shape |
|---|---|---|---|---|
| **Convening brief** | reuse all turns (both sources) | complete, corrected | ✅ Honoured | annotated NetworkMap + brief |
| **New searches** | — | none — full journey-state re-use | ✨ confirmed across all 4 journeys | — |

**Patchy-data move:** **condition on two gates + openly carry the self-correction** — the brief names that the single-source version was wrong, which is the highest-honesty move available.

## Layer 5 — Component sort
- **The corrected brief:** → `NetworkMap` at full extension (two clusters + CPC bridge + imported actors) = the ecosystem map. Snapshot/Brief freeze point.
- **The defence (incl. the self-correction):** → `ObjectionResponse` — claim-by-claim, including "the corpus-only read was wrong and here's why."
- **The two gates:** → `ActionPlan` — gated actions.
- **Whole turn:** → **Snapshot/Brief** — portable convening one-pager.

---
---

# What the rebuild changes — and the rule it adds to the skill

**The central finding flipped.** Draft (corpus-only): "isolated actors, cold-start convening, the absence of edges is the business case." Corrected (harmonised): "dense existing network, CPC already central, the move is to bridge what exists." These are *opposite* strategic recommendations from the *same question* — the only difference is whether the web pass ran. That is the single most important demonstration in the entire exercise of why harmonisation is non-negotiable.

**The new skill rule (the most important one this journey produces):**
> **For network/ecosystem/relationship questions, the parallel web pass is MANDATORY, not optional.** The corpus stores lead-organisation-only, so it structurally under-reads collaboration networks and will falsely report "no network." A corpus gap on a relationship question is presumed a *corpus defect* until the web pass confirms or refutes it. Measure edge density across *both* sources before selecting a NetworkMap fallback rung — or the corpus's blindness will force a wrong downgrade to "typed inventory" when a real force-graph exists.

**Two meta-lessons for the whole method:**
1. **A single-source answer can be fluent, internally coherent, and wrong.** The draft was well-argued. Argument quality is not a correctness check; the second source is.
2. **Sign your gaps correctly.** The draft treated TRIG-absence as "network might be cold." The corrected version recognises it as "CPC is *at least* this connected — under-count, not absence." A gap's *direction* matters as much as its existence.

**Everything else from the v1 analysis stands:** the differentiator is a node property not an edge; NetworkMap is a fallback ladder; quality lives in reasoning not components; state accretes; the big blocks are fortified recipes. The rebuild doesn't overturn the cross-journey patterns — it sharpens the harmonisation one to its strongest form.

---

*Journey 4 (v2) complete. The parallel web pass — omitted in v1, caught on review — corrected the central finding from "isolated actors" to "existing CPC-central network." The four-journey set is now uniformly harmonised and ready for skill extraction. The mandatory-web-pass-for-network-questions rule is the key addition.*
