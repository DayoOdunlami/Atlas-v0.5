# Atlas v5 — Trust Model v2 (peer lanes, validated ledger)

> **Status:** Target architecture — **partially implemented today** (see [Current vs target](#current-vs-target)).  
> **Companion:** [ATLAS_V5_BLUEPRINT.md](./ATLAS_V5_BLUEPRINT.md) §4, §16, §17.  
> **Principle:** Lanes are peers at fetch time. **No lane is incumbent by default.** Trust is earned per figure through lane-specific validation and reconciliation — not pre-assigned by warehouse vs web.

---

## 1. Problem with v1 (what we’re fixing)

v1 mixed two axes into one label:

| Axis | What it should mean | What v1 often implied |
|------|---------------------|------------------------|
| **Provenance** | Which market did this come from? | Corpus = “real”, web = “approximate” |
| **Confidence** | How much can we assert this claim? | `owned` = high, `borrowed` = low |

That produced:

- UI: solid corpus vs dashed web (quality hierarchy, not lane identity)
- Tier caps from **corpus citation count only** (`citation_guard.py`)
- Charts bound to **corpus SQL only** (`stats.*`, `corpus_hits`)
- Reconcile notes that **anchor** on corpus when web is richer
- External programme data treated as garnish, not peer evidence

**Product intent (locked):** Atlas value-add is **reasoning across validated inputs**, not defending one warehouse.

---

## 2. Core model (v2)

Every assertable figure or claim passes through the same lifecycle:

```
Lane fetch (always-on market)
  → Lane validate (deterministic, lane-specific rules)
  → Ledger entry (id, lane, validation, confidence, provenance chain)
  → Reconcile (compare · corroborate · conflict · lead-by-question)
  → Render (styling = lane identity; confidence = tier + validation badge)
```

### 2.1 Lanes (extensible)

| Lane ID | Markets today | Planned |
|---------|---------------|---------|
| `corpus` | SQL aggregates, project rows, document chunks | Same |
| `web` | GovUK, Exa, live-call candidates | Same |
| `declared` | User case-file claims | Same |
| `research` | — | Paper-search / academic API (new bay, same pattern) |
| `user_file` | — | Uploads (new bay) |

Adding a lane = new fetcher in `retrieval_fabric` + validator module + ledger key prefix — **not** a bolt-on to corpus.

### 2.2 Two orthogonal axes (replace material-as-quality)

**Axis A — `lane`** (provenance, visual identity)

```typescript
type EvidenceLane = "corpus" | "web" | "declared" | "research" | "user_file";
```

**Axis B — `validation_status`** (what validation did)

```typescript
type ValidationStatus =
  | "verified"    // passed lane rules; safe to cite in spine/chart
  | "candidate"   // retrieved but not fully verified (usable with caveat)
  | "contested"   // conflicts another lane on same dimension
  | "absent"      // lane ran; nothing usable returned
  | "declined";   // lane disabled or timed out
```

**Axis C — `confidence_tier`** (epistemic stance on the **claim**, not the lane)

`Speculative | Indicative | Supported | Robust` — computed from validation + reconciliation + citation depth **per claim**, not “corpus = Robust, web = Indicative” by default.

### 2.3 Ledger entry (KeyedFigure v2)

Extend (don’t break) today’s `KeyedFigure`:

```typescript
interface LedgerFigure {
  key: string;                    // e.g. stats.funding_floor_gbp | web.programme_total_gbp
  value: number | string;
  unit: "count" | "gbp" | "ratio" | "id" | "text";
  lane: EvidenceLane;
  validation_status: ValidationStatus;
  confidence_tier: ConfidenceTier;  // ceiling for this figure
  provenance: string;               // human-readable chain
  source_refs: string[];            // corpus UUID | web id | DOI | declared claim id
  floor?: boolean;                  // corpus funding floor semantics preserved
  reconciles_with?: string[];       // keys this figure was compared against
  lead_for_question?: boolean;      // reconcile picked this lane for this turn
}
```

**Backward compat:** map legacy `material: owned` → `{ lane: corpus, validation_status: verified }`; `borrowed` → `{ lane: web, validation_status: candidate }`; `declared` → `{ lane: declared, validation_status: verified }` with tier cap.

### 2.4 Lane validators (deterministic, no LLM)

| Lane | Validates | Pass → | Fail → |
|------|-----------|--------|--------|
| **corpus** | UUID in Supabase; SQL reproducible; null-funding flags | `verified` | omit or `candidate` with gap note |
| **web** | URL resolvable; publisher/snippet; fetch metadata; optional allowlist | `verified` or `candidate` | `absent` |
| **declared** | user attestation; never auto-promote | `verified` capped Indicative | — |
| **research** | DOI resolve; journal metadata; retraction check | `verified` / `candidate` | `absent` |

Validators live in `agents/atlas_v5/trust/` (new). **Gate and charts consume ledger output only** — not raw bag rows.

### 2.5 Reconciliation v2 (no default incumbent)

Today: fit-weighted narrative with corpus anchor language.  
Target:

1. **Compare** — same dimension across lanes (e.g. programme scale, project count in slice)
2. **Corroborate** — independent agreement → tier boost (existing `apply_peer_tier_rules`, extended)
3. **Conflict** — explicit `reconciliation.notes` with both signals; tier capped honestly
4. **Lead by question** — shopper + question class picks which lane **leads the visual** for this turn (not always corpus)

Example: rail decarbonisation “programme scale” → web GovUK may **lead** chart; corpus floor bar **supports** slice honesty.

### 2.6 Render rules (UI)

| Element | Rule |
|---------|------|
| **Lane styling** | Colour/icon by `lane` (corpus green, web blue, research purple, declared gold) — **not** solid vs dashed = trust |
| **Confidence** | Tier badge + validation chip (`verified` / `candidate` / `contested`) |
| **Charts** | Series tagged with `lane` + `validation_status`; tooltip shows provenance chain |
| **Footer legend** | Replace “corpus solid / web dashed” with lane legend + validation glossary |

---

## 3. Visual Opportunity Engine under v2

Charts today (`agents/atlas_v5/visual/`) use **corpus-only** inputs. Under v2:

### 3.1 Data profile (extended)

`DataProfile` gains per-lane validated figure sets:

```python
@dataclass
class LaneFigureSet:
    lane: str
    figures: list[LedgerFigure]
    validation_summary: str

@dataclass
class DataProfile:
    ...
    lane_sets: list[LaneFigureSet]
    lead_lane: str | None          # from reconcile
    conflict_keys: list[str]
```

### 3.2 Opportunity selection

Decision tree inputs:

1. **Question intent** (ranking, coverage, flow, evolution, composition)
2. **Validated data shape** per lane (not raw bag)
3. **Lead lane** from reconcile when one lane is stronger for this question
4. **Weak-data suppression** — any lane with `absent` / thin validation does not drive a chart alone

**Multi-chart policy (unchanged):** up to 3 charts, distinct `role`, each must bind to ledger keys.

**New policy:** when lanes **conflict** on the same dimension, prefer **dual-series or side-by-side** (corpus floor vs web programme) over hiding the weaker lane.

### 3.3 Chart builders (extended)

| Builder | Corpus source | Web / research source (new) |
|---------|---------------|----------------------------|
| Ranking bar | `stats.funders` | Live-call ranking from validated `web.*` candidates |
| Composition pie | funder floor shares | programme share from GovUK extract (if validated) |
| Line / area | corpus time series (when SQL exposes) | web policy timeline |
| Heatmap | citation matrix | cross-lane source × validation matrix |
| Sankey | org → evidence type flows | funder → programme → project flows |

Each `ChartBlock` gains:

```typescript
series_lane: EvidenceLane[];      // per series
validation_status: ValidationStatus[];
lead_lane?: EvidenceLane;
reconciliation_note?: string;     // why this lane leads the chart
```

---

## 4. Governance (unchanged mechanism, expanded scope)

| Surface | v1 gate | v2 gate |
|---------|---------|---------|
| Compose HTML | merge vs KeyedFigureIndex | merge vs **ledger** (any lane key allowed if validated) |
| Chart ECharts | `viz_guardrail` + corpus keys | same + **lane-tagged series** must map to ledger keys |
| Spine tier | citation_guard (corpus count) | **per-claim tier** from reconcile + validators |
| Hub LLM | no invented figures | no invented figures — **any lane key must exist in ledger** |

LangGraph still schedules; trust lives in validators + ledger + reconcile + gate + chart attach.

---

## 5. Migration phases

| Phase | Deliverable | Breaks mouth? |
|-------|-------------|---------------|
| **T0 — Spec** | This doc + blueprint §17 | No |
| **T1 — Ledger schema** | `LedgerFigure`, extend `KeyedFigureIndex.build` with lane + validation; compat map for `material` | No (additive JSON) |
| **T2 — Validators** | `trust/validate_corpus.py`, `trust/validate_web.py`; populate ledger from `EvidenceBag` | No |
| **T3 — Reconcile v2** | Lead-lane + conflict notes; tier from multi-lane evidence | Minor copy changes |
| **T4 — Visual v2** | External builders + lead-lane selection; `ChartBlock` lane fields | Additive schema |
| **T5 — UI** | Legend, chart tooltips, validation chips | CSS/tokens |
| **T6 — Research lane** | New fetch + validator + ledger prefix | Config-gated |

---

## 6. Current vs target

| Area | Today (v1) | Target (v2) |
|------|------------|-------------|
| Lane fetch | Peer (always run) | Same |
| Trust labels | `owned` / `borrowed` / `declared` | `lane` + `validation_status` + per-claim tier |
| Tier cap | Corpus citation count | Validated evidence across lanes |
| Reconcile | Fit-weight; corpus anchor language | Compare · lead-by-question · conflict |
| Charts | Corpus SQL + corpus hits only | Best **validated** dataset per question; multi-lane OK |
| UI footer | Corpus solid / web dashed | Lane identity + validation glossary |
| New lanes | Planned in blueprint | Same interface as web |

**Implemented today (between v1 and v2):** Visual Opportunity Engine (`agents/atlas_v5/visual/`) — multi-chart, data-shape selection, suppression — still **corpus-only inputs**.

---

## 7. Files to touch (implementation index)

| Concern | Current | v2 work |
|---------|---------|---------|
| Ledger | `keyed_figures.py` | `trust/ledger.py`, extend build |
| Validate | implicit in corpus SQL / bag | `trust/validate_*.py` |
| Reconcile | `reconcile_spec.py` | lead lane, conflict, tier v2 |
| Tier cap | `citation_guard.py` | `trust/tier_from_evidence.py` |
| Charts | `visual/*` | lane-aware builders + attach |
| Schema | `answer_spec.py`, `answer-spec.schema.ts` | `LedgerFigure`, `ChartBlock` lane fields |
| Mouth | `atlas-answer-surface.tsx`, `chart-canvas.tsx` | legend, lane styling |
| Prompt | `deep_pass_prompt.py` | peer validation language, not owned/borrowed hierarchy |
| Eval | `calibration_eval.py`, `test_visual_opportunity.py` | dual-lane chart cases, conflict cases |

---

## 8. Non-goals (v2)

- LLM-chosen chart types in production path (MCP generative viz stays workbench)
- Promoting web figures to corpus UUIDs without ingestion pipeline
- Hiding conflicts — contested state is a feature
- Equal **chart count** per lane — equal **validation opportunity** per lane
