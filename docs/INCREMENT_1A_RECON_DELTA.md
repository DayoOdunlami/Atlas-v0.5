# Increment 1A — Recon delta (evidence shaping)

> **Status:** Gate 4 — **1A built; awaiting re-approve for 1B.**  
> **Scope:** Phase 1A only. Phase 1B (routing, T3, disposition, calibration) is **blocked** until 1A merges and re-approves.  
> **Governing line:** Markets fixed; menu sets the shopping list; chef only cooks.

---

## 1. What the fixed lanes do today

### Turn schedule (unchanged by 1A design)

```
route (Haiku/heuristic) → wide_pass → assemble → deep_pass → gate → mouth
```

LangGraph does not fetch. Fetch happens entirely inside `wide_pass` → `run_retrieval_fabric`.

### Market 1 — Corpus lane (`retrieval_fabric._fetch_corpus`)

| Sub-source | Live in atlas_v5? | Implementation |
|------------|-------------------|----------------|
| **Structured project rows** | **Yes** | `mcps.cpc_corpus.queries.search_projects` — semantic pgvector over `atlas.projects` |
| **Ingested documents** | **No** | `queries.evidence_for_claim()` over `atlas.knowledge_chunks` + `knowledge_documents` exists in MCP but **never called** from `wide_pass` / `retrieval_fabric` |

SQL aggregates (`j1t1_corpus.fetch_corpus_stats`) run in parallel with fabric — separate path, outcome-independent scope from `corpus_scope_for_query`.

**Today:** one corpus “aisle” (projects only). Document chunks are a dead capability in the `/atlas` path (used in legacy `agents/atlas/graph.py` tool loop, not atlas_v5).

### Market 2 — Web lane (`retrieval_fabric._fetch_external_bundle`)

| Aisle | When it runs | How weighted today |
|-------|--------------|-------------------|
| **GovUK** | `lane_mode ∈ {dual, external_primary, corpus_primary}` | Always queried (same `query` / `govuk_query`) |
| **Exa** | `dual` **or** `external_primary` **or** `outcome ∈ {connect, act}` | Up to 4 queries; each scoped `site:gov.uk OR innovate uk funding` |

Planning stack:

1. `plan_retrieval()` — regex on query (`_OPPORTUNITY_RE`, `_POLICY_RE`) expands Exa sub-queries; `select_lane_mode()` may return `corpus_only` on plain orient.
2. `atlas_retrieval_plan()` — **overrides** to `dual` + fixed Exa dedupe when `ATLAS_V5_PARALLEL_EVIDENCE=1` and web lane on.

**Net effect:** every substantive atlas_v5 turn with web enabled runs **both** corpus search and GovUK+Exa. Content is analyst-shaped: policy/programme weight regardless of practitioner vs landscape intent. Outcome hint changes Exa eligibility only on `connect`/`act` at fabric layer; atlas_v5 plan still forces dual.

### Reconcile (`reconcile_spec.py`)

- Treats corpus + web as **symmetric peers** in copy and tier logic.
- `dual_peer=True` note always when `lane_mode=dual`.
- Both present → tier `+1` boost; web-only → capped `Supported`; corpus-only with dual ran → “web returned nothing” note.
- **`query` and `outcome` parameters unused** (`del query`).
- Declared claims merged post-reconcile in `deep_synthesis` (Increment 0) — untouched by 1A except optional fit-weight note text.

### Keyed figures + gate (must stay stable)

- `stats.*` from SQL — **owned**, gate-critical.
- `web.*` from EvidenceBag — **borrowed**.
- Gate / merge unchanged in 1A scope; shopper must not introduce new owned keys without SQL backing.

---

## 2. What each per-mode profile would change (1A target)

Proposed **floor profiles** (deterministic, no API key) + **shopper refinement** (light model, pre-chef):

| Outcome / mode | Corpus: projects vs documents | Web: GovUK vs funders/partners/competitors | Reconcile lead |
|----------------|------------------------------|--------------------------------------------|----------------|
| **orient** (analyst landscape) | Projects-heavy; documents light | GovUK-weighted; Exa policy/programme | Corpus-led narrative; web frames |
| **connect / act** | Projects + graph; documents medium | Funder + partner Exa emphasis; GovUK minimal | Mixed; opportunities surface |
| **diagnose / defend** | Documents medium (gap evidence) | Policy + programme | Tension notes |
| **find_path** (floor only in 1A — routing in 1B) | Documents-heavy; projects light | Funder/partner/programme Exa; **GovUK minimal** | Declared + web-led matches; corpus context |

Shopper output shape (gate-safe by construction):

```python
# Illustrative — no "lanes_to_run" field
ShoppingList(
  corpus=CorpusShop(weights={"projects": 0.7, "documents": 0.3}, sub_queries=[...]),
  web=WebShop(weights={"govuk": 0.2, "funders": 0.5, "partners": 0.3}, sub_queries=[...]),
)
```

Both markets **always** populated; weights ∈ [0,1] per aisle; Python normalises and executes **all** aisles (zero weight still runs with floor limit, or minimum fetch count — pick one in build, document in code).

---

## 3. Blast radius

### §15 analyst demos (must stay green)

| Case | Depends on | 1A risk |
|------|------------|---------|
| `rail_orient` / `journey_orient` | SQL stats, dual lane, compose/template | **Low** if `stats.*` path untouched; web *content* may shift (acceptable) |
| `swot_cpc` / `swot_canvas` | Deep compose + keyed stats | **Low–med** — more document chunks could change prose, not figures |
| `funder_bar` | `stats.funders` SQL + chart attach | **Low** — bar data from SQL not fabric |
| `network_connect` | Connect graph + NetworkMap recipe | **Low** — graph fetch separate |
| `maritime_orient` | Compose fallback | **Low** |

**Tier badge changes:** reconcile tier boosts are the main regression surface. 1A should change **note prominence / lead source**, not blindly re-use symmetric `+1` when mode says web-secondary.

### Increment 0 (declared)

- Case file, trust rail, gate declared rules — **no change** in 1A except reconcile may add mode-weight note alongside declared note.
- Heuristic bootstrap negative tests must remain green.

### Orchestrator / workbench

- `agents/orchestrator/*` tool-loop path unchanged — out of scope. Do not conflate with atlas_v5 shopper.

---

## 4. Model-chosen fetch — report, do not absorb

| Pattern | Status | 1A stance |
|---------|--------|-----------|
| deep_pass triggers retrieval | **Absent** today | **Forbidden** — stay absent |
| Shopper skips a market | **Not expressible** in target schema | **Required** — schema review in PR |
| Shopper runs pre-chef, logged | **New** | **Required** — `WidePassResult.retrieval_meta.shopping_list` + eval cache |
| `select_lane_mode()` → `corpus_only` then atlas override to dual | **Present** | Replace override with “always dual markets, profile-driven aisles” — same guarantee, clearer semantics |
| Orchestrator LLM picks tools | **Present** on workbench | **Out of scope** — document boundary in blueprint |
| Exa inside `_fetch_external_bundle` hard-coded gov.uk bias | **Present** | **1A fix** — profile-driven Exa templates, not chef-chosen |
| Future markets (academic, uploads, MCP) | **Not built** | Seam: register market in config + floor profile; never add “model decides to call MCP” |

**Nothing in 1A should add fetch inside `deep_synthesis.py` or make lane execution conditional on shopper JSON booleans.**

---

## 5. Proposed file touch list (1A build)

| File | Change |
|------|--------|
| `source_shopper.py` **(new)** | Floor profiles; light-model list; eval cache hook; Pydantic schema with no skip field |
| `wide_pass.py` | Run shopper before fabric; attach list to meta |
| `web_lane.py` | Consume web weights + sub-queries (replace fixed Exa templates) |
| `retrieval_fabric.py` | Parallel corpus projects **+** knowledge_chunks; weight/limit per sub-source |
| `reconcile_spec.py` | Mode-aware lead weighting in notes; optional tier policy per mode |
| `agents/test_source_shopper.py` **(new)** | Schema cannot omit lane; find_path floor de-emphasises GovUK; no-key → floor |
| `agents/test_*` extend | Corpus documents fire on practitioner-weight profile; trust marking unchanged |

**Not in 1A:** `turn_classifier.py`, `find_path` routing, T3 template, disposition blocks, calibration suite.

---

## 6. Blueprint truth patches (same PR as 1A — doc only)

Current `docs/ATLAS_V5_BLUEPRINT.md` still says “deterministic wide pass” without shopper, omits `declared` in §4, single corpus lane, §13 gaps stale.

**Ship with 1A** (content provided in re-scope brief — apply to `ATLAS_V5_BLUEPRINT.md` at merge):

- **§0 / §1** — deterministic *in structure, not content*; shopper pre-fetch; two-minds boundary
- **§4** — corpus two sub-sources; third material `declared`; stance vs provenance orthogonal
- **§13** — shopper + declared → shipped; visual_intent regex → next increment; new markets config-opened

**Lockstep rule:** if implementation diverges from patched blueprint at merge, fix code or doc — not both silently wrong.

---

## 7. Eval / replay

- Pin shopper output: `ATLAS_V5_SHOPPER_CACHE=1` or in-test dict keyed by `(query, outcome)` for `genui_eval` / pytest.
- Baseline already established: `funder_bar` **3/7** without `ANTHROPIC_API_KEY` on pre-Inc0 HEAD — not a regression bar for 1A.

---

## 8. Gate checklist (approve to build)

- [ ] Shopper schema has **no lane skip** — weights/sub-queries only
- [ ] Floor profile always available (no-key + shopper failure)
- [ ] `knowledge_chunks` wired as corpus sub-source
- [ ] Web profiles mode-conditioned (find_path floor ready for 1B)
- [ ] Reconcile fit-weighting without breaking owned/borrowed/declared marking
- [ ] §15 analyst demos green after 1A
- [ ] Blueprint patched in same PR
- [ ] **Stop — re-approve before 1B**

---

## 9. Named next (do not build)

**Increment 2 — `visual_intent` model-proposed / Python-built** (same guardrail shape as shopper). Recorded in blueprint §13; after 1B ships.
