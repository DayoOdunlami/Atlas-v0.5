# Atlas — One Strategist Journey, Fully Grounded
### Proof-of-format: world-class harmonised answers + the four layers beneath them

This is **one complete journey** (not a static Q&A) showing the deliverable format before I batch the rest. A CPC rail lead moves from orienting → diagnosing → deciding → defending, exactly the flow the North Star describes. Every turn carries five layers:

1. **Answer** — world-class markdown, harmonising Supabase (corpus) + web (live world), with inline citation markers `[S#]` corpus / `[W#]` web.
2. **Citations** — every marker resolved, with source-class and trust note.
3. **Data appendix** — the actual rows/aggregates the answer and its anticipated visuals run on.
4. **Search-sufficiency trace** — anticipated shape → what came back → honoured / partial / empty / richer-available → incompleteness type → patchy-data move → final shape.
5. **Component sort** — per section: prose / block / variant / new component / GenUI, with reasoning.

All data live from Supabase `afysgjiczzptubonbuxs` and web, 18 Jun 2026.

The journey persona: **a CPC rail mode-lead deciding whether rail decarbonisation is a space CPC should put a programme behind.**

---
---

# TURN 1 — ORIENT
### *"Give me the state of play on rail decarbonisation in our corpus."*

## Layer 1 — Answer

> **The corpus sees a busy but small-money field — and it's blind to the part that matters most.** Rail decarbonisation shows **55 projects** but only **£8.2m** of recorded funding `[S1]`, spread across **30 organisations** with **27 still live past 2024** `[S1]`. That's a lot of small projects and very little money — the signature of an *early-stage, fragmented* innovation space, not a consolidated one.

The corpus activity clusters tightly around **two sub-themes**: rail **electrification engineering** (composite cantilevers and overhead-line innovation from Furrer+Frey and the University of Huddersfield) and **freight decarbonisation** (self-powered bogies, hybrid-electric freight locomotives, zero-emission freight power) `[S2]`. Funders are almost monolithically **Innovate UK** `[S2]` — there is essentially no funding diversity in what the corpus can see.

**But here is the thing the corpus cannot tell you, and the web can:** the £8.2m the corpus sees is a rounding error against the real national programme. Network Rail's Traction Decarbonisation Network Strategy targets electrifying ~11,700 single-track-km at roughly **£1m per km** `[W1][W2]`, the government has committed to **removing all diesel-only trains by 2040** `[W3]`, and Great British Railways is now mandated to produce a 30-year decarbonisation strategy `[W3]`. As recently as this month, Network Rail signed renewable-energy deals covering ~80% of its non-traction electricity `[W4]`. So the corpus shows you the *SME innovation layer*; the web shows you the *multi-billion-pound infrastructure programme above it*.

**The orienting insight:** rail decarbonisation isn't an empty field or a crowded one — it's a **two-tier field**. A thin, Innovate-UK-funded SME innovation layer (what CPC's corpus captures) sitting beneath a massive, slow, electrification-led national programme (what the corpus misses entirely). Any CPC play has to know which tier it's entering. *Confidence: Supported on the corpus layer; the national-programme layer is web-sourced and should be treated as context, not corpus fact.*

## Layer 2 — Citations

| Marker | Source | Class | Trust note |
|---|---|---|---|
| S1 | `atlas.projects` aggregate, rail+decarbonisation, 18 Jun 2026 | Corpus | Own data, high trust; funding_amount has nulls so £8.2m is a *floor* not a total |
| S2 | `atlas.projects` top-10 by funding, rail+decarbonisation | Corpus | High; one top row has null lead_org (data-quality flag) |
| W1 | House of Commons Transport Cttee, *Trains fit for the future?* — TDNS 11,700 STK | Web (parliament.uk) | Authoritative; 2020 baseline, may have moved |
| W2 | UK Power Networks Services — ~£1m/km electrification cost | Web (industry) | Industry estimate, corroborated by RIA £0.75–1.5m/STK |
| W3 | Rail Industry Connect, *UK Rail in 2026* — 2040 diesel phase-out, GBR 30-yr strategy | Web (industry, Jan 2026) | Recent; policy direction stable |
| W4 | Network Rail Media Centre, World Environment Day 2026 — renewable CoPPA deals | Web (Network Rail, ~2 wks old) | Primary source, very recent |

## Layer 3 — Data appendix

**Aggregate (drives the stat strip):**
```
rail_total=103 · rail_decarb=55 · rail_decarb_fund_floor=£8.2m · rail_decarb_live=27 · rail_decarb_orgs=30
```
**Top projects (drives the ranked list / sub-theme grouping):**
```
25kV Battery Train Charging Station Demo — [null org] — IUK — £740k — 2023→2025
Composite Twin Track Cantilever (CTTC) — U. Huddersfield — IUK — £533k — 2024→2025
Intelligent Multimodal Logistics Brokerage — Rockshore — IUK — £520k — 2010→2013
ICAGE greener electrification cantilever — Furrer+Frey GB — IUK — £408k — 2024→2025
Zero Emission Rail Freight Power — Steamology Motion — IUK — £400k — 2020→2021
Freight Skate self-powered bogie — TDI Europe — IUK — £400k — 2022→2024
High Power Mainline Hybrid Freight — Meteor Power — IUK — £399k — 2021→2022
+ 48 more
```

## Layer 4 — Search-sufficiency trace

| Anticipated shape | Query run | Came back | Verdict | Final shape |
|---|---|---|---|---|
| **Stat strip** (count, £, live, orgs) | Supabase aggregate | All 5 numbers clean | ✅ **Honoured** | StatTriplet/strip |
| **Ranked list** (top projects) | Supabase top-10 | 10 rows, 1 null org | ⚠️ **Honoured w/ data-quality flag** | OpportunityList, null org shown as "(unnamed lead)" |
| **Sub-theme grouping** | (derived from titles) | 2 clear clusters emerged | ✨ **Richer-shape-available** — not anticipated, but the titles cluster cleanly into electrification vs freight | Optional grouped view |
| **National-programme context** | Web search | Strong, recent macro data | ✅ Honoured (web-class) | Prose only — no corpus rows to chart |

**Incompleteness type:** *Partial* — funding_amount has nulls, so £8.2m is a floor (flagged in-answer). *Absent* — the national-programme tier is structurally outside the corpus (surfaced via web, labelled as context).
**Patchy-data move:** **Surface honestly** (the £8.2m floor + the two-tier framing both name the limit rather than papering over it). The web layer *converts* the corpus blind-spot into the answer's central insight — the gap between tiers is the finding.

## Layer 5 — Component sort

- **Two-tier insight (the hero):** full-sentence verdict → `RecommendationConfidence` **sentence variant**. The one-word-tag version would destroy the whole "two-tier field" point.
- **55 / £8.2m / 27 live / 30 orgs:** → **new `StatStrip` component** (the at-a-glance gap). Floor-not-total caveat rendered as a small footnote on the £ figure.
- **Top projects:** → `OpportunityList` (with null-org handling).
- **Electrification-vs-freight split:** → *optional* subtle grouping inside OpportunityList; **not** a separate chart — too little data to justify dominant visual. Degraded by choice.
- **National programme tier:** → **prose / GenUI**. No corpus rows back it; forcing a visual would fabricate false precision. Stays narrative with web citations as clickable badges.

---
---

# TURN 2 — DIAGNOSE
### *"Why is the corpus funding so thin? Is this a real gap or are we just not seeing it?"*

## Layer 1 — Answer

> **It's both — and separating the two is the whole diagnosis.** The thinness is partly *real* and partly a *coverage artefact*, and they need different responses.

**The real part.** Within what the corpus captures, rail decarbonisation genuinely *is* small-money and fragmented: 55 projects averaging well under £200k each, almost all Innovate-UK competition grants `[S1][S2]`. That's a true picture of the **SME grant-funded innovation layer** — lots of small bets, no large consolidated programmes. This isn't a measurement error; it's what early-stage innovation funding actually looks like.

**The artefact part.** The corpus is **structurally blind to three big funding channels** that the web confirms are where the real money sits: (1) Network Rail / DfT capital electrification spend (£1m/km against an 11,700-STK target — i.e. billions) `[W1][W2]`; (2) the emerging GBR 30-year programme `[W3]`; and (3) **CPC's own TRIG grants**, which are entirely absent from the corpus `[GAP]`. So a large fraction of the "thinness" is simply *out of frame* — not absent from the world, absent from the dataset.

**The diagnostic verdict:** the £8.2m is a true reading of the *innovation-grant tier* and a *misleading* reading of the *field as a whole*. If you use the corpus to answer "how much rail-decarb innovation funding exists for SMEs?" it's trustworthy. If you use it to answer "how big is rail decarbonisation?" it under-reads by orders of magnitude. **The fix isn't analytical, it's ingestion:** the single highest-value corpus action is bringing TRIG in, because that closes the one blind-spot CPC actually controls — the other two tiers are external and can stay as web-context. *Confidence: Robust on the diagnosis; the remedy (ingest TRIG) is a known, closable action.*

## Layer 2 — Citations

| Marker | Source | Class | Trust note |
|---|---|---|---|
| S1, S2 | as Turn 1 | Corpus | — |
| W1–W3 | as Turn 1 | Web | — |
| GAP | `atlas.live_calls.source` enum contains no TRIG; known corpus gap | Corpus-absence | This is a *declared blind-spot*, not an inference |

## Layer 3 — Data appendix

```
avg_project_size = £8.2m / 55 ≈ £149k  (floor, given nulls)
funder concentration: Innovate UK ≈ all top-10 (monopoly funder in-corpus)
source enum (atlas.live_calls): Find a Tender, Horizon Europe, GOV.UK, Innovate UK  → no TRIG
```

## Layer 4 — Search-sufficiency trace

| Anticipated shape | Query | Came back | Verdict | Final shape |
|---|---|---|---|---|
| **Real-vs-artefact split** | reuse Turn-1 data + enum check | Clean | ✅ Honoured | Two-column "real / artefact" structure |
| **Blind-spot declaration** | enum inspection | TRIG confirmed absent | ✅ Honoured (as *absence*) | AnswerabilityCard / blind-spot callout |
| **Funder concentration viz** | top-10 funders | All Innovate UK — *no variance* | ❌ **Empty-of-contrast** — a "distribution" of one category isn't a chart | Degraded to a sentence ("monopoly funder") |

**Incompleteness type:** *Absent* (TRIG) + *Real-sparse* (genuine small-money tier).
**Patchy-data move:** **Convert gap → recommendation.** The TRIG blind-spot becomes "ingest TRIG" — the gap is reframed as a product action, the highest-honesty move. This is the move you specifically wanted the search to reach for rather than "making the best of it."

## Layer 5 — Component sort

- **Real-vs-artefact structure:** → prose / GenUI. It's a *reasoned distinction*, no fixed shape; componentising would flatten it.
- **TRIG blind-spot:** → **new `AnswerabilityCard`** (declared limit + the closable action). Pure moat shape; renders near the verdict, not as a footer.
- **Funder concentration:** → **prose, not a chart.** A one-category "distribution" is the classic over-claiming visual — the trace caught it and degraded it. Good example of *anticipated-shape-not-honoured → downgrade.*
- **"Ingest TRIG" recommendation:** → `ActionPlan` **one-primary-action variant**.

---
---

# TURN 3 — DECIDE
### *"If we enter, where's our angle — and who would we work with?"*

## Layer 1 — Answer

> **Your angle is the bridge, not the mode. Enter rail decarbonisation through its connection to highways — and anchor on the electrification-engineering cluster, not freight.** Two corpus structures point the same way.

**First, the partner shortlist writes itself from the data.** The electrification sub-cluster has clear, *currently-active* anchors: **Furrer + Frey GB** (overhead-line electrification, live to 2025) and the **University of Huddersfield** (composite cantilever innovation, live to 2025) `[S2]`. These aren't dormant names — they're funded now, working the exact sub-theme (cheaper electrification) where the national £1m/km cost problem `[W2]` creates the biggest pull. Freight decarbonisation, by contrast, is older and more scattered in the corpus (most freight projects ended 2021–2024) `[S2]` — a thinner partnering base today.

**Second, the cross-modal structure tells you the transfer direction.** Rail's bridges are overwhelmingly to **highways** — 121 combined Highways↔Rail bridges at ~0.80 average strength `[S3]` — and almost nonexistent to aviation (4) or weak to digital (7) `[S3]`. That means rail-decarbonisation proof *travels best to and from highways* (shared challenges: electrification infrastructure, depot charging, asset management). The national context reinforces it — the web framing of "stations as multimodal hubs" `[W5]` is literally a rail-highways integration point. So the defensible angle is **rail-decarbonisation-as-integrated-infrastructure**, borrowing and lending proof across the highways bridge, anchored on the electrification-cost problem with Furrer+Frey / Huddersfield as the live partners.

**The honest limit:** the cross-modal bridge data is strong for highways but *too sparse to chart meaningfully* for the other modes — so this recommendation rests on the one strong bridge, not a rich multi-modal web. That's enough to act on, but it's a single-bridge bet, not a diversified one. *Confidence: Supported.*

## Layer 2 — Citations

| Marker | Source | Class | Trust note |
|---|---|---|---|
| S2 | `atlas.projects` top-10 (org + recency) | Corpus | High; recency is the load-bearing field |
| S3 | `atlas.cross_modal_bridges`, rail pairs | Corpus | High; **note casing gotcha** — modes stored "Rail"/"Highways" capitalised (see trace) |
| W2 | £1m/km electrification cost | Web | as Turn 1 |
| W5 | UK Power Networks Services — stations as multimodal hubs | Web (industry) | Framing/opinion, not hard data — labelled as such |

## Layer 3 — Data appendix

**Rail cross-modal bridges (drives the network graph):**
```
Highways–Rail: 81 bridges, avg 0.79   |  Rail–Highways: 40, avg 0.81   → combined 121
Digital–Rail:   7 bridges, avg 0.84
Aviation–Rail:  4 bridges, avg 0.85
(maritime–rail: effectively absent)
```
**Live partner anchors (drives the shortlist):**
```
Furrer + Frey GB — electrification/OLE — live to 2025
U. Huddersfield — composite cantilever — live to 2025
(freight cluster: Steamology, TDI, Meteor Power — mostly ended 2021–2024)
```

## Layer 4 — Search-sufficiency trace

| Anticipated shape | Query | Came back | Verdict | Final shape |
|---|---|---|---|---|
| **Network graph** (rail ego-network) | bridges WHERE rail ∈ pair | **First query returned [] — casing mismatch** (`'rail'` vs stored `'Rail'`) | ⚠️ **Anticipated-shape-failed-then-recovered** — re-queried, got 121+7+4 | Network graph **honoured for highways, sparse elsewhere** |
| **Partner shortlist** | top projects + recency | Clean, recency present | ✅ Honoured | OpportunityList / partner cards |
| **Multi-modal web** | full bridge set | Only highways is dense | ⚠️ **Partial** — graph would mislead if drawn as a full web | Degraded: draw the *one strong edge* prominently, others as faint/labelled-thin |

**Incompleteness type:** *Sparse* (non-highways bridges) + a *retrieval-failure-then-recovery* (the casing bug — exactly the silent-ILIKE-class failure the corpus has form for; logged so the real search node guards against it).
**Patchy-data move:** **Surface honestly** — the "single-bridge bet, not diversified" caveat names the sparsity rather than drawing a falsely rich graph.

## Layer 5 — Component sort

- **The angle (hero verdict):** → `RecommendationConfidence` sentence variant.
- **Partner shortlist:** → `OpportunityList` / partner-card variant, recency as the sort key (the field that makes it useful).
- **Cross-modal structure:** → `NetworkMap` — **but rendered honest-to-density:** the Highways↔Rail edge dominant, Digital/Aviation edges faint and labelled "sparse." This is the textbook case from your liability question: *the visual must degrade to match the data, not draw a pretty full web.* Minimum-data-threshold rule in action.
- **The casing gotcha:** → not user-facing, but a **search-node spec item** — the trace is the deliverable for Cursor here.

---
---

# TURN 4 — DEFEND
### *"A funder says 'you're betting a programme on one cluster and one bridge.' Hold or fold?"*

## Layer 1 — Answer

> **Hold — but concede the shape of the bet honestly.** The challenge is fair and the answer is not to deny it but to show the bet was *chosen*, not stumbled into.

**What I defend.** The electrification angle isn't arbitrary — it targets the single biggest cost problem in the entire national programme (£1m/km against an 11,700-STK target) `[W1][W2]`, with live, funded partners working exactly that problem *now* `[S2]`. And the highways bridge isn't a lucky correlation — it's 121 connections at 0.80 strength `[S3]`, the strongest cross-modal relationship rail has, reinforced by the national "multimodal hub" direction `[W5]`. A bet on the strongest available structure is a defensible bet.

**What I concede.** Yes, it's concentrated. The non-highways bridges are too thin to diversify across `[S3]`, the freight sub-cluster is ageing `[S2]`, and — the concession that matters most — **the corpus cannot see CPC's own prior rail work (no TRIG)** `[GAP]`, so I cannot rule out that CPC has already placed bets here that should change the angle. The honest position is: *this is the best-supported entry the visible data allows, explicitly conditional on closing the TRIG blind-spot before committing budget.*

**Where that leaves the decision.** The recommendation survives challenge as a *staged, conditional* bet: commit to one anchor project on electrification-cost with Furrer+Frey/Huddersfield, across the highways bridge, **after** ingesting TRIG to confirm CPC isn't duplicating its own history. It does *not* survive as an unconditional multi-year programme commitment — and it was never claimed as one. The confidence cap (Supported, not Robust) was carrying that honesty all along. *Confidence: Supported, conditional on TRIG.*

## Layer 2 — Citations

| Marker | Source | Class | Trust note |
|---|---|---|---|
| S2, S3 | as Turns 1/3 | Corpus | — |
| W1, W2, W5 | as Turns 1/3 | Web | — |
| GAP | TRIG absence | Corpus-absence | The load-bearing concession |

## Layer 3 — Data appendix
```
Defensible-claim ledger:
  electrification targets £1m/km national cost problem  → backed [W1][W2] + live partners [S2]  → SURVIVES
  highways bridge strongest available (121 @ 0.80)      → backed [S3]                            → SURVIVES
  concentration / single-bridge                         → conceded, backed by sparsity [S3]      → CONCEDE
  ageing freight cluster                                → conceded [S2]                          → CONCEDE
  CPC's own prior work invisible                        → conceded [GAP]                         → CONCEDE (caps confidence)
```

## Layer 4 — Search-sufficiency trace

| Anticipated shape | Query | Came back | Verdict | Final shape |
|---|---|---|---|---|
| **Claim-by-claim defence ledger** | reuse all prior turns' data | Complete | ✅ Honoured | survive/concede ledger (ClaimLedger audit variant) |
| **No new search needed** | — | Defend mode *re-uses* the journey's accumulated evidence | ✨ **Key journey finding** | — |

**Incompleteness type:** *Absent* (TRIG) — now load-bearing as the central concession rather than a footnote.
**Patchy-data move:** **Surface honestly + condition the decision on closing it.** The blind-spot becomes a *gate* on the recommendation, not just a caveat.

## Layer 5 — Component sort

- **Survive/concede ledger:** → `ClaimLedger` **audit variant** (survive / concede per row) + `ObjectionResponse`. The richest table in the journey — Defend mode earns its heaviest component.
- **The conditional verdict:** → `RecommendationConfidence` sentence variant, with the TRIG condition rendered *as part of the verdict*, not below it.
- **Whole-journey artifact:** → this turn is the natural **Snapshot/Brief** freeze point — verdict + evidence + concessions, portable.

---
---

# What this one journey already teaches (before batching more)

**On state & flow (only visible because it's a journey, not 4 separate Q&As):**
- **Defend mode ran zero new searches** — it re-used the evidence the first three turns accumulated. *Implication: the artifact must carry state across turns; the agent shouldn't re-fetch what the journey already grounded.* This is your "organic healing surface" made concrete — the canvas accretes, it doesn't redraw.
- **The shape changed every turn** — stat-strip → blind-spot-card → network-graph → audit-ledger — while the **hero verdict persisted and evolved**. That's the core canvas behaviour to build: hero stable, supporting shapes swap.

**On your liability question (shape-anticipation vs data reality):**
- **Turn 3 is the proof case.** Anticipated a network graph; the data honoured it *only for highways* and the first query *failed entirely* on a casing bug. The honest render is a graph with one dominant edge and faint labelled-thin others — not a pretty full web. **The minimum-data-threshold + graceful-degradation rule is the single most important thing for Cursor to encode in the renderer.**

**On the four patchy-data moves you wanted the search conscious of:**
- Turn 1 used **surface honestly** (the £ floor).
- Turn 2 used **convert-gap-to-recommendation** (ingest TRIG).
- Turn 3 used **degrade-the-shape** (sparse bridges).
- Turn 4 used **condition-the-decision-on-the-gap** (TRIG as a gate).
- **Extrapolation was never used** — correct; it has no place in an epistemics-first product except flagged, and nothing here warranted it.

**On components (the build list this journey implies):**
- **New:** `StatStrip`, `AnswerabilityCard` (both appeared as real gaps, both moat-relevant).
- **Confirmed:** `OpportunityList` (again).
- **Variants:** `RecommendationConfidence`→sentence; `ActionPlan`→one-primary; `ClaimLedger`→survive/concede audit; `NetworkMap`→density-honest rendering.
- **Stays prose/GenUI:** the national-programme tier, the real-vs-artefact reasoning, every connective argument.
- **Biggest lesson, unchanged from the worked example:** the thing that makes these answers good is the *reasoning skill*, not the components. The components render it; they don't create it.
