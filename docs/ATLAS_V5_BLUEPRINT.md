# Atlas v5 — System blueprint

> **Purpose:** Single source of truth for `/atlas` — architecture, trust, inventory, and navigation.  
> **Audience:** You, engineers, designers, eval. Update when AnswerSpec, graph topology, or inventory changes.  
> **Canonical path:** CopilotKit agent `atlas_v5` → `agents/atlas_v5/graph.py` → `run_turn.py`

---

## How to use this doc

| You want to… | Read section |
|--------------|--------------|
| Understand the whole in one paragraph | [§0 System at a glance](#0-system-at-a-glance) |
| Know what we **recommend** vs what exists today | [§1 Architecture stance](#1-architecture-stance-hub-vs-pipeline) |
| See where the LLM starts and LangGraph ends | [§2 LLM boundary](#2-llm-boundary-where-cognition-lives) |
| Add/remove a recipe, chart, or template | [§10 Element inventory](#10-element-inventory) |
| Navigate by metaphor | [§11 Analogy map](#11-analogy-map-standardized) |
| Product north star & decision surfaces | [§16 Product north star](#16-product-north-star) |
| Change code | [§14 File map](#14-file-map) |

**Blueprint term is always source of truth.** Metaphors (Restaurant, Body) are translation layers — same row in every column.

---

## 0. System at a glance

**One sentence:** User asks on `/atlas` → LangGraph wires a turn → a **shopper** (light model) sets a per-lane shopping list → the **always-run wide pass** fetches corpus ‖ web per that list and builds a locked skeleton → **hub LLM (Sonnet)** judges and optionally composes HTML → **gate** verifies figures → mouth renders AnswerSpec (spine + chart / compose / recipe).

> **"Deterministic" clarified:** the wide pass is *deterministic in structure, not in content* — every lane is **always visited** (this is the gate's guarantee), but *what each lane fetches and how it's weighted* is shaped per query/outcome-mode by the shopper. Markets are fixed; the shopping list adapts; the model never decides *whether* a lane runs. See [§4 Evidence lanes](#4-evidence-lanes-peer-model).

**Three layers:**

| Layer | Name | Role |
|-------|------|------|
| **Mouth** | Next.js + CopilotKit | Display only — never invents data |
| **Brain graph** | LangGraph `atlas_v5` | Schedules nodes, streams partials — **not** the cognition hub |
| **Brain work** | `wide_pass` + `deep_pass` | Evidence (code) + judgement (LLM) |

**Unified visual vocabulary** (use everywhere):

| Blueprint | Plain English | Same slot? |
|-----------|---------------|------------|
| **Recipe** | Standard arrangement (React) | `instrument` |
| **Template** | Prep kit (deterministic HTML) | `canvas.merged_markup` |
| **Compose** | Custom plate (LLM HTML) | `canvas.merged_markup` |
| **Chart** | Inset chart (ECharts) | `chart` — can coexist above compose/recipe |

Template and compose share one slot; template is fallback when LLM is off or compose fails.

---

## 1. Architecture stance: hub vs pipeline

### What exists today (two brains in the repo)

| Path | Pattern | Active when | Used by |
|------|---------|-------------|---------|
| **`atlas_v5`** | **Pipeline evidence + hub judgement** | Always for `/atlas/session` | CopilotKit `atlas_v5` |
| **`orchestrator`** | **Hub-and-spoke tool loop** (`bind_tools`) | `ATLAS5_ORCHESTRATOR_V1=true` | Workbench endpoint |

You are not imagining things: **the repo contains both.** `/atlas` session runs the pipeline path. The orchestrator is the experiment closer to ChatGPT/Claude “pick tools as needed.”

### What we recommend (not just describing — this is the target)

**Hybrid, not pure hub-and-spoke for everything:**

```
┌─────────────────────────────────────────────────────────────┐
│  HUB LLM (Sonnet deep_pass)                                 │
│  Route hint · disposition · verdict · optional compose HTML │
└──────────────────────────▲──────────────────────────────────┘
                           │ reads locked skeleton + keyed figures
┌──────────────────────────┴──────────────────────────────────┐
│  ALWAYS-RUN PIPELINE (wide_pass) — every lane, every turn    │
│  SHOPPER (light model) shapes per-lane list ─┐               │
│  SQL stats ‖ corpus search ‖ web → reconcile │ (never skips) │
│  → assemblers → KeyedFigureIndex → gate       ┘              │
└─────────────────────────────────────────────────────────────┘
```

> **Shopper vs chef (the two minds):** the **shopper** (light model, pre-deep-pass) reasons only about *what to buy in each market* and emits a per-lane shopping list — it has no way to skip a lane (the output schema carries weights/sub-queries per lane, never a set-of-lanes). The **chef** (`deep_pass` Sonnet) reasons freely about *what it all means*. The shopper shops; the chef cooks; only the chef has open judgement.

| Concern | Pure hub-and-spoke (orchestrator-style) | Recommended for `/atlas` |
|---------|----------------------------------------|---------------------------|
| **Parallel corpus + web** | LLM decides whether to call each tool | **Always run both** (peer lanes) — **locked decision** |
| **Which tools / lanes** | LLM picks per turn | **Lanes always run; shopper shapes per-lane sourcing/weighting.** Model never decides *whether* a lane runs |
| **What each lane fetches** | LLM picks per turn | Shopper (light model, pre-deep-pass) sets per-lane list by query/mode; deterministic floor profile when no key |
| **Numbers in the canvas** | LLM may type figures in markup | **Keyed figures** from SQL — LLM fills holes only |
| **Audit / eval** | Hard to replay (“model skipped search”) | Same query → same skeleton → comparable eval |
| **Latency** | Variable tool loops | Bounded wide pass + one deep call |
| **Judgement & voice** | Hub LLM | Hub LLM ✓ |
| **Free HTML layout** | Hub LLM | Hub LLM ✓ (with gate) |

**Your parallel search instinct is correct and is a locked product decision.** The rest does not require abandoning hub-and-spoke — it requires **splitting roles**:

- **Hub** = think, judge, compose (what ChatGPT does well).
- **Pipeline** = fetch, lock, verify (what guardrails need as *inputs*, not as afterthoughts).

### Can guardrails alone fix pure hub-and-spoke?

**Partially — but not enough for Atlas’s product bar.**

The **gate** (`merge` + `composition_pipeline`) is the immune system: it rejects HTML whose `{{stats.project_count}}` holes don’t match the KeyedFigureIndex. That only works if:

1. Figures were **computed before** the LLM spoke.
2. The LLM **did not** skip retrieval that those figures depend on.

In a pure tool loop, the model can:

- Call search once, miss SQL aggregates, still write a confident canvas.
- Omit web lane on “easy” queries — you lose peer richness.
- Take a different tool path each run — eval and demos drift.

**LangGraph is not the guardrail.** LangGraph is the **schedule** (which node runs when). Guardrails are: keyed figures, merge, gate, citation guard, reconcile notes, tier rules.

**Recommendation summary:**

| Keep as code (pipeline) | Keep as hub LLM | Optional future merge |
|-------------------------|-----------------|------------------------|
| Dual lane fetch | Disposition, verdict, compose | Orchestrator tool loop for *workbench* exploration |
| SQL + assemblers | Chat-only replies | More tools behind hub **after** skeleton exists |
| Chart attach (deterministic) | Voice / blindspot | LLM *requests* chart kind; Python still builds option |
| visual_intent regex | | |
| Gate + merge | | |

You are **not** fighting hub-and-spoke for judgement. You **should** fight making the LLM the only thing standing between “user asked” and “evidence fetched.”

---

## 2. LLM boundary: where cognition lives

LangGraph node = **when**; LLM = **who reasons** (only in specific nodes).

```mermaid
flowchart TB
  subgraph NO["No LLM — deterministic"]
    P[prepare]
    G[gather / wide_pass]
    G1[SQL + funders]
    G2[corpus ‖ web]
    G3[assemblers + reconcile]
    G4[keyed figures]
    G5[visual_intent · chart_spec attach]
    SP[stream_spine]
  end

  subgraph SMALL["Small LLM — route only"]
    R[route — Haiku or heuristic]
  end

  subgraph MAIN["Main LLM — deep_pass Sonnet"]
    Y[synthesise]
    Y --> J[judgement + optional canvas_markup]
  end

  subgraph FB["No LLM — fallbacks"]
    T[visual_templates]
    REC[skeleton recipe]
  end

  P --> R
  R -->|substantive| G --> SP --> Y
  R -->|chat| FC[finalize chat LLM/heuristic]
  Y -->|no API key / fail| T --> REC
```

| Stage | LLM? | Module |
|-------|------|--------|
| prepare | No | `graph_nodes.py` |
| route | Haiku **or** heuristic | `turn_classifier.py` |
| source shopper | Haiku **or** floor profile | `source_shopper.py` |
| gather / wide_pass | **No** (fetch); shopper is light LLM | `wide_pass.py`, `source_shopper.py`, `retrieval_fabric.py`, `*_assembler.py` |
| stream_spine | No | `progressive_stream.py` |
| synthesise / deep_pass | **Sonnet** | `deep_synthesis.py` |
| Template / recipe fallback | No | `visual_templates.py`, skeleton `instrument` |
| Chart on spec | No | `chart_spec.py` (after deep path) |

**LangGraph finishes** after `synthesise` or `finalize` — it does not “become” the hub; it wires `run_turn()`.

---

## 3. End-to-end flow (one turn)

```mermaid
flowchart TB
  subgraph User
    Q[User query]
  end

  subgraph Mouth["MOUTH — Next.js /atlas"]
    CK[CopilotKit useCoAgent]
    AS[AtlasAnswerSurface]
    CK --> AS
  end

  subgraph Brain["BRAIN — LangGraph atlas_v5"]
    P[prepare]
    R[route — classify_turn]
    G[gather — wide_pass]
    S[stream_spine — partial]
    Y[synthesise — deep_pass]
    P --> R
    R -->|substantive| G --> S --> Y
    R -->|chat/clarify| F[finalize]
  end

  subgraph Wide["wide_pass — parallel"]
    SQL[(Supabase SQL aggregates)]
    RF[retrieval_fabric]
    C[corpus search ‖]
    W[GovUK + Exa ‖]
    SQL --> Skel[skeleton AnswerSpec]
    RF --> C & W
    C & W --> Recon[reconcile_spec dual-peer]
    Skel --> Recon
  end

  subgraph Deep["deep_pass"]
    VI[visual_intent + templates]
    CS[chart_spec]
    Gate[merge + gate]
    Recon --> Deep
    VI --> Gate
    CS --> Spec[AnswerSpec final]
    Gate --> Spec
  end

  Q --> CK
  G --> Wide
  Y --> Deep
  Spec -->|answer_spec_envelope| CK
  AS -->|stats / verdict / chart / compose / recipe| UI[Canvas]
```

---

## 4. Evidence lanes (peer model)

**Default:** `ATLAS_V5_PARALLEL_EVIDENCE=1` + `ATLAS_V5_WEB_LANE=1` → **dual lane every substantive turn**. A **shopper** (light model, pre-deep-pass) shapes *what each lane fetches and how it's weighted* per query/outcome-mode. **Lanes always run** — the shopper cannot skip one.

```mermaid
flowchart LR
  subgraph Shop["Shopper (light model, pre-fetch)"]
    SHOP[per-lane shopping list\nweights + sub-queries\nNO skip field]
  end
  subgraph Parallel["Always fetched in parallel (ThreadPoolExecutor)"]
    CORPR[Corpus — project rows / SQL]
    CORPD[Corpus — documents / knowledge_chunks]
    GOV[Web — GovUK]
    FUND[Web — funders / partners / Exa]
  end

  SHOP --> CORPR & CORPD & GOV & FUND
  CORPR --> Bag[EvidenceBag]
  CORPD --> Bag
  GOV --> Bag
  FUND --> Bag
  Bag --> Recon[reconcile_spec — fit-weighted]

  Recon -->|owned| Stats[stats.* keys]
  Recon -->|borrowed| Web[web.* keys + web_evidence[]]
  Recon -->|declared| Decl[declared situation claims]
```

> **Corpus is two sub-sources, not one:** structured project rows (SQL) **and** ingested documents (`knowledge_chunks` / `knowledge_documents`, embeddings). The shopper weights structured-vs-document by query type — analyst landscape leans rows; practitioner messy situation leans document chunks.

| | Corpus | Web | Declared |
|--|--------|-----|----------|
| **Role** | Structured CPC project rows + ingested documents | Policy, programme scale, freshness, partners, funders | User's own stated situation (practitioner path) |
| **Authority** | **Peer** — not default | **Peer** — not fallback | **Peer** — never promoted to owned without ingestion |
| **Trust material** | `owned` (solid) | `borrowed` (dashed) | `declared` (◇ "stated by user", max Indicative) |
| **When thin** | Still run; note in reconciliation | Still run; note in reconciliation | Empty until user states situation |
| **Disable** | N/A | `ATLAS_V5_WEB_LANE=0` | N/A (only populates on declared input) |

**Three materials, not two.** `declared` (Increment 0) is a peer trust material rendered visibly distinct and capped at Indicative. Provenance (owned/borrowed/declared = *where it came from*) and epistemic stance (via `claim_subtype` on declared rows) are **orthogonal axes**.

**Tier honesty (Increment 1A):** reconcile fit-weights narrative *lead* by mode. Corroboration tier **+1** applies only when **both** lanes return substantive signal — never when one lane led and the other was thin. See `apply_peer_tier_rules()` in `reconcile_spec.py`.

**Not equal in trust marking** — equal in **always running**.

---

## 5. Prompts, skills, and art direction

One Sonnet call — layered inputs, not three competing systems.

| Layer | What | Always? | File(s) |
|-------|------|---------|---------|
| **System prompt** | Identity, evidence rules, disposition task | Deep pass | `deep_pass_prompt.py` |
| **Skills** | Extra markdown **appended to** system prompt | Visual skill if `FREE_COMPOSE`; chart skill if file exists | `skills/atlas-visual-composition.md`, `skills/atlas-chart-encoding.md` |
| **Runtime addenda** | Dual lane, recipe lock, corpus-only | Per turn meta | `deep_pass_prompt.py`, `composition_policy.py` |
| **Route prompt** | Classify only — no canvas content | Route node | `turn_classifier.py` (Haiku) |

**Skills are not tools.** They do not fetch data. They guide *how* to compose and *when* charts help — but **charts are built in Python** (`chart_spec.py`), not by the skill invoking ECharts.

**Art direction is split** (who picks the visual):

| Decision | Decided by | LLM? |
|----------|------------|------|
| SWOT / journey / bar / connect | `visual_intent.py` (regex) | No |
| Skeleton recipe (NetworkMap, etc.) | `*_assembler.py` by outcome | No |
| free_compose vs reference_recipe | deep_pass disposition | Yes (or heuristic) |
| HTML layout & materials | deep_pass + visual composition skill | Yes |
| SWOT/journey when no LLM | `visual_templates.py` | No |
| Funder bar chart | `chart_spec.py` + intent/router | No |

**Fallback ladder** (compose slot):

```
LLM compose → template (prep kit) → recipe (React) → prose
```

---

## 6. AnswerSpec render fork (mouth)

```mermaid
flowchart TD
  Spec[AnswerSpec envelope]
  Spec --> Spine[Spine always]
  Spine --> V[VerdictHero]
  Spine --> B[Blindspot]
  Spine --> ST[StatStrip]

  Spec --> Visual{Visual area}
  Visual --> CH[ChartCanvas if spec.chart]
  Visual --> Fork{Compose slot}
  Fork -->|merged_markup gate=pass| CO[CompositionCanvas HTML]
  Fork -->|else| REC[Recipe React instrument]

  REC --> IM[IncommensurableMagnitudes]
  REC --> NM[NetworkMap]
  REC --> EG[EvidenceGapMatrix]
  REC --> OL[OpportunityList]
```

| Slot | Field | Builder | Skill guides LLM? |
|------|-------|---------|-------------------|
| **Recipe** | `instrument` | `*_assembler.py` | No |
| **Template** | `canvas.merged_markup` | `visual_templates.py` | No |
| **Compose** | `canvas.merged_markup` | Model HTML → merge → gate | `atlas-visual-composition.md` |
| **Chart** | `chart` | `chart_spec.py` + `viz_guardrail` | `atlas-chart-encoding.md` (LLM); attach is **code** |

### ECharts vs Recharts (what is actually live)

| Renderer | Used where | Atlas v5 `/atlas`? |
|----------|------------|---------------------|
| **ECharts** (`echarts-for-react`) | `chart-canvas.tsx`, `network-map.tsx` | **Yes** — primary chart path |
| **Recharts** | `src/components/ui/chart.tsx`, lab/workbench | **No** — legacy/lab only |

**Why responses feel prose-heavy:** `chart_router` knows bar/line/pie/network, but **only funder bar is implemented** in `chart_spec.py`. Chart attach runs **after** deep pass and only when query + `stats.funders` match intent. Skills do not trigger charts.

---

## 7. Progressive streaming (CopilotKit)

```mermaid
sequenceDiagram
  participant G as gather
  participant SP as stream_spine
  participant SY as synthesise
  participant UI as Mouth

  G->>UI: partial_stage=stats (scope, tier, stats)
  SP->>UI: partial_stage=spine (+ verdict, blindspot)
  SY->>UI: partial_stage=complete (+ chart, canvas, instrument)
```

Dev overlay: `partial` · `stage` · `lane` · `gate` · `peer=yes` when dual.

---

## 8. Visual intent router

```
Query + outcome
    │
    ├─ swot ──────────────► Template T1 (SWOT prep kit)
    ├─ journey_orient ────► Template T2 (journey strip)
    ├─ funder_bar / bar ──► Chart C1 (funder bar) if stats.funders
    ├─ connect ───────────► Recipe R2 NetworkMap
    └─ default orient ────► Recipe R1 IncommensurableMagnitudes (+ T2 fallback)
```

---

## 9. Core vs additive

### Core (remove → Atlas breaks)

- `AnswerSpec` / `AnswerSpecEnvelope` contract
- `wide_pass` + assemblers + **parallel** `retrieval_fabric`
- `reconcile_spec` (dual-peer)
- `KeyedFigureIndex` + merge + gate
- Turn disposition + deep pass
- CopilotKit coagent state sync
- Mouth spine + render fork

### Additive (polish / coverage)

- Visual templates (SWOT, journey)
- ChartSpec builders beyond C1
- Progressive partials + CountAnimation
- GenUI eval (`npm run eval:genui`)
- Recipe lock / gate mode env flags
- Dev overlay · showcase journeys
- Orchestrator tool loop (separate path)

---

## 10. Element inventory

Living registry — add a row when you add a recipe, chart, or template.

### Brain pipeline (LangGraph)

| ID | Element | File(s) |
|----|---------|---------|
| B1 | prepare | `graph_nodes.py` |
| B2 | route (Haiku / heuristic) | `turn_classifier.py` |
| B3 | gather / wide_pass | `wide_pass.py` |
| B4 | stream_spine | `progressive_stream.py`, `graph_nodes.py` |
| B5 | synthesise / deep_pass | `deep_synthesis.py` |
| B6 | finalize (chat) | `graph_nodes.py`, `chat_router.py` |

### Evidence

| ID | Element | File(s) |
|----|---------|---------|
| E1 | Corpus semantic search (projects) | `retrieval_fabric.py` |
| E1b | Corpus document search | `retrieval_fabric.py` → `evidence_for_claim` |
| E2 | SQL aggregates + funder rows | `j1t1_corpus.py`, `corpus_scope.py` |
| E3 | Web GovUK + Exa (shaped) | `retrieval_fabric.py`, `web_lane.py` |
| E7 | Source shopper (pre-fetch list) | `source_shopper.py` |
| E4 | Fit-weighted reconcile + tier honesty | `reconcile_spec.py` |
| E5 | Keyed figures | `keyed_figures.py` |
| E6 | Merge + gate | `composition_pipeline.py`, `judgement_merge.py` |

### Recipes (`instrument` — React)

| ID | Recipe | Outcome | Assembler | Mouth component |
|----|--------|---------|-----------|-----------------|
| R1 | IncommensurableMagnitudes | orient | `j1t1_assembler.py` | `incommensurable-magnitudes.tsx` |
| R2 | NetworkMap | connect | `connect_assembler.py` | `network-map.tsx` |
| R3 | EvidenceGapMatrix | diagnose | `diagnose_assembler.py` | `evidence-gap-matrix.tsx` |
| R4 | OpportunityList | act | `act_assembler.py` | `opportunity-list.tsx` |
| R5 | (online-only skeleton) | web-led | `online_only_assembler.py` | varies |

### Templates (`canvas` — deterministic HTML)

| ID | Template | Trigger | Builder |
|----|----------|---------|---------|
| T1 | SWOT 2×2 grid | `visual_intent` swot | `build_swot_markup` |
| T2 | Journey orient strip | `visual_intent` journey_orient | `build_journey_orient_markup` |

### Charts (`chart` — ECharts)

| ID | Chart kind | Status | Trigger | Builder |
|----|------------|--------|---------|---------|
| C1 | Funder horizontal bar | **Live** | funder / breakdown queries + `stats.funders` | `build_funder_bar_chart` |
| C2 | Line (trend) | Router only | `_TIME_RE` in `chart_router.py` | not implemented |
| C3 | Pie (composition) | Router only | — | not implemented |
| C4 | Network as ChartSpec | N/A | use R2 NetworkMap | by design |

### Skills & prompts

| ID | Asset | Role | File |
|----|-------|------|------|
| S1 | Visual composition skill | Compose guardrails | `skills/atlas-visual-composition.md` |
| S2 | Chart encoding skill | Chart *guidance* for LLM | `skills/atlas-chart-encoding.md` |
| P1 | Deep pass system prompt | Identity + evidence + task | `deep_pass_prompt.py` |
| P2 | Route classifier prompt | Route only | `turn_classifier.py` |

### Change checklist

When adding a **recipe:** assembler → `AnswerSpec.instrument` schema → mouth `renderInstrument` → eval case.  
When adding a **template:** `visual_templates.py` + `visual_intent.py` → eval case.  
When adding a **chart:** `chart_spec.py` builder + `viz_guardrail` + `chart_router` + mouth unchanged if `ChartBlock` shape holds → eval case.

---

## 11. Analogy map (standardized)

Same blueprint row in every column. **Restaurant** = where to put changes. **Body** = trust constraints.

| # | Blueprint part | Restaurant | Body |
|---|----------------|------------|------|
| 1 | User query | Guest order | Stimulus |
| 2 | Mouth (UI) | Front of house | Face & speech |
| 3 | Event stream | Waiter runs | Nervous system |
| 4 | Brain graph | Kitchen line schedule | Cortex pipeline schedule |
| 5 | route | Maître d’ triage | Reflex vs deep thought |
| 6 | wide_pass | Prep station | Parallel intake |
| 7 | Corpus lane | House warehouse | Internal labs |
| 8 | Web lane | Market run (always) | Sensory input |
| 9 | EvidenceBag | Delivery crates | Combined samples |
| 10 | reconcile_spec | Head chef compares deliveries | Signal integration |
| 11 | KeyedFigureIndex | Ticket numbers | Biomarkers on chart |
| 12 | Gate + merge | Expeditor | Immune system |
| 13 | Skeleton AnswerSpec | Blank ticket | Vitals chart draft |
| 14 | Skills | Training manual | Medical school |
| 15 | deep_pass (Sonnet) | Head chef judgement | Executive function |
| 16 | stream_spine | First courses | Monitor beeps |
| 17 | Recipe | Set menu plate | Standard gesture |
| 18 | Template | Prep kit card | Reflex posture |
| 19 | Compose | Chef’s special | Improvised speech |
| 20 | Chart | Nutrition inset | X-ray panel |
| 21 | visual_intent | Menu category picker | Exam type picker |
| 22 | Progressive stream | Course pacing | Pulse → ECG → workup |
| 23 | Dev overlay | Pass window | Monitor overlay |
| 24 | Env flags | Supplier contracts | Medication switches |
| 25 | Core vs additive | Health code vs garnish | Organs vs makeup |

**Validation questions**

- *Restaurant:* “Supplier, ticket number, set menu, prep kit, inset chart, or chef’s special?”
- *Body:* “Does it pass the immune system? Owned vs borrowed?”
- *Architecture:* “Pipeline fix (atlas_v5) or tool-loop fix (orchestrator)? Which path is `/atlas` using?”

---

## 12. Environment flags

| Variable | Default | Effect |
|----------|---------|--------|
| `ATLAS_V5_WEB_LANE` | `1` | GovUK + Exa parallel with corpus |
| `ATLAS_V5_PARALLEL_EVIDENCE` | `1` | Force dual lane (peer model) |
| `ATLAS_V5_FREE_COMPOSE` | `1` | Free HTML compose vs recipe lock |
| `ATLAS_V5_RECIPE_LOCK` | `0` | Golden demo recipe hijack |
| `ATLAS_V5_GATE_MODE` | `warn` | Gate logs vs hard reject |
| `ANTHROPIC_API_KEY` | — | Deep pass; without it → templates/skeleton + floor shopper |
| `ATLAS_V5_SHOPPER_CACHE` | `0` | Pin shopper list per (query, mode) for eval replay |
| `ATLAS5_ORCHESTRATOR_V1` | off | Workbench tool-loop brain (not `/atlas` default) |

---

## 13. Not wired yet (gaps)

- **`visual_intent` is regex** — SWOT/journey/bar/connect chosen by keyword regex on the query (same brittle pattern as the old `is_substantive_canvas_query` bug). **Next increment after practitioner journey (Inc 2):** model *proposes* visual intent, Python still *builds* deterministically, gate still verifies figures (same guardrail shape as the shopper).
- Chart builders C2/C3 (line, pie) — router exists, builders don’t
- ECharts MCP → ChartBlock (workbench only today)
- Academic / paper-search lane — a **new market**, opened by config when built (not model-chosen)
- User-uploaded files → `claim_evidence_links` — a **new market**, parked
- Partial envelope for `visual` stage only (chart in final only)
- Consolidate legacy `src/lib/atlas5/ChartSpec` vs `AnswerSpec.chart`
- **System-wide epistemic stance axis** — verified/inferred/predicted on *all* deep_pass claims (narrow `declared`-only version lives via `claim_subtype`); parked target
- Migrate `passport_claims` + `brief_claims` onto unified `atlas.claims` spine; retire forks
- Packager agent (bid / transferability pack) and Underwriter agent (truth verification) — parked

**Shipped since last blueprint rev (no longer gaps):** `declared` third trust material + case-file spine (Increment 0); source shopper + corpus document surfacing + fit-weighted reconcile with honest tier rules (Increment 1A).

---

## 14. File map

| Want to change… | Edit |
|-----------------|------|
| Parallel web + corpus + shopper | `source_shopper.py`, `web_lane.py`, `wide_pass.py` |
| Reconciliation + tier honesty | `agents/atlas_v5/reconcile_spec.py` (`apply_peer_tier_rules`) |
| SQL scope (rail vs CPC) | `agents/atlas_v5/corpus_scope.py` |
| New recipe skeleton | `agents/atlas_v5/*_assembler.py` + mouth renderer |
| New chart type | `chart_spec.py`, `chart_router.py`, `viz_guardrail.py` |
| New HTML template | `visual_templates.py`, `visual_intent.py` |
| LLM voice / evidence | `deep_pass_prompt.py`, `skills/*.md` |
| Canvas UI | `src/components/atlas/atlas-answer-surface.tsx` |
| Streaming stages | `graph_nodes.py`, `progressive_stream.py` |
| Eval cases | `agents/atlas_v5/genui_eval.py` |
| Tool-loop experiment | `agents/orchestrator/graph.py` |

---

## 15. Quick validation

```bash
npm run eval:genui
python -m pytest agents/test_atlas_v5_abc_features.py -q
```

| Query | Expect |
|-------|--------|
| State of play rail decarbonisation | `lane=dual`, journey template or two-tier, web_evidence when fetch OK |
| SWOT on CPC | T1 four-quadrant grid |
| Funding by funder breakdown | C1 ChartSpec bar |
| Map hydrogen supply chain | R2 NetworkMap |

Dev overlay: `lane=dual skip=false peer=yes`, `partial=stats→spine→complete`.

---

## 16. Product north star

> **Scope:** Product intent and decision surfaces — does not change architecture in §1–§15.  
> **Canonical path unchanged:** `/atlas` → `atlas_v5` (not orchestrator).

### North-star mantra

```
Pipeline for evidence.
Hub for judgement.
Contract for rendering.
Gate for trust.
```

**One-line product:** Atlas is an evidence-controlled decision kitchen — the chef may be creative on story and layout, but only with ingredients that were fetched, labelled, and weighed before judgement runs.

### Today vs target

| | **Today** | **Target** |
|---|-----------|------------|
| **Canonical path** | `/atlas` uses `atlas_v5`, not orchestrator | Same — orchestrator remains workbench unless deliberately promoted |
| **Routing** | `chat` \| `clarify` \| `substantive` + outcome hints (`orient` / `connect` / `diagnose` / `act` / `defend`) | Richer intent routing (clarify / refine / analyse lanes) without making LLM own evidence fetch |
| **Evidence** | `wide_pass` runs deterministically; corpus, SQL, web are **code-planned**, parallel, not LLM-selected | Same factory model + academic / user-file lanes (planned, not live) |
| **Render contract** | `AnswerSpec` / envelope | Same contract — decision surfaces compile into AnswerSpec fields |
| **Charts** | Narrow: **C1 funder bar live**; C2/C3 router-only | Full visual grammar (line, composition, timelines, option boards) |
| **Product framing** | Render fork asks chart / compose / recipe / prose | **Decision surfaces first** — implementation second |
| **“Compiler”** | **Distributed** — assemblers → reconcile → deep_pass → chart attach → merge → gate | May be named as one concept; no requirement for a single module yet |

**Planned evidence bays (not live today):** academic / paper-search lane; user-uploaded files. Listed in [§13 Gaps](#13-not-wired-yet-gaps).

**Orchestrator:** ChatGPT-style tool loop exists at workbench when `ATLAS5_ORCHESTRATOR_V1=true`. It is **not** the `/atlas` brain. Experiments there do not change canonical architecture unless explicitly promoted.

### Evidence boundary (hub LLM)

The hub LLM may choose **story, emphasis, and layout**, but **cannot create new evidence classes** that `wide_pass` did not produce:

- No invented **owned** figures (must use keyed `stats.*` / verified corpus rows).
- No invented **corpus UUIDs** (citations must exist in skeleton / retrieval).
- No unverified numbers in visual markup (compose uses `{{key}}` holes; gate enforces merge).

Borrowed web context may be **interpreted and synthesised** in prose; trust marking stays `borrowed` / candidate until ingested.

### Governance boundary (trust is not one gate)

| Surface slot | Trust mechanism |
|--------------|-----------------|
| **Spine** (verdict, tier, blindspot) | Tier rules, citation guard, reconciliation notes |
| **Recipe** (`instrument`) | Python assemblers + structured `instrument.data` — React renders typed props |
| **Compose** (`canvas.merged_markup`) | Merge + gate — figures must match KeyedFigureIndex |
| **Chart** (`chart`) | ChartSpec builders + `viz_guardrail` — option built in code, not LLM |
| **Template** (compose fallback) | Deterministic HTML from `visual_templates.py` + same merge/gate path when merged |

LangGraph schedules the turn; **governance lives in these layers**, not in the graph topology alone.

### Layer map (world-class language → current code)

| Layer | Role | Current module(s) | Maturity |
|-------|------|-------------------|----------|
| Evidence factory | Always-on parallel fetch | `wide_pass`, `retrieval_fabric`, `j1t1_corpus` | Strong direction |
| Evidence ledger | Owned / borrowed / reconcile | `EvidenceBag`, `reconcile_spec`, `KeyedFigureIndex` | Core |
| Analyst judgement | Meaning, tension, voice, compose | `deep_pass` (Sonnet) | Good — role now explicit |
| Spec compiler *(concept)* | Assemble AnswerSpec | Assemblers, deep_pass, chart attach, merge | Fragmented but functional |
| Trusted surface | Mouth render fork | `atlas-answer-surface.tsx` | Promising — visually thin |
| Eval memory | Golden behaviour | `genui_eval.py`, demo queries in §15 | Needs expansion per surface |

### Decision surface catalogue

Product should ask **“what decision shape?”** before **“chart or recipe?”**

| Decision surface | User need | Dominant visual | Likely implementation path | Today / target |
|------------------|-----------|-----------------|----------------------------|----------------|
| **State of Play / Decision Brief** | Understand landscape, tiers, blindspots | Verdict spine + stat strip + two-tier field | R1 IncommensurableMagnitudes + T2 journey template + compose | **Today** — partial (journey/orient queries) |
| **Strategic Options** | Compare paths, trade-offs | Option board / trade-off columns | Compose (free HTML) or new recipe | **Target** — prose + compose fragments only |
| **Evidence Gap** | What is missing / thin | HAVE–GAP–MOVE matrix | R3 EvidenceGapMatrix + diagnose assembler | **Today** — diagnose outcome |
| **Funding / Funder Breakdown** | Who funds, how much (floor) | Horizontal bar / composition | C1 ChartSpec bar + SQL `stats.funders` | **Today** — C1 live when intent matches |
| **Partner / Actor Map** | Who connects to whom | Force / network graph | R2 NetworkMap + connect graph fetch | **Today** — connect outcome |
| **Defensible Recommendation** | Defend a move under scrutiny | Claim + evidence + counterclaim pack | Spine + reconciliation notes + compose | **Target** — tier + citations today; pack layout aspirational |
| **Action Plan / Next Moves** | What to do next | Ranked opportunities list | R4 OpportunityList + act assembler | **Today** — act outcome |
| **SWOT / strategic frame** | Strengths, weaknesses, options, threats | 2×2 grid | T1 SWOT template + compose | **Today** — SWOT queries |

**Implementation rule:** Pick surface from this table → map to inventory IDs in [§10](#10-element-inventory) (R/T/C) → add eval case in [§15](#15-quick-validation).

---

*Last updated: §16 product north star — decision surfaces, evidence/governance boundaries, today vs target.*
