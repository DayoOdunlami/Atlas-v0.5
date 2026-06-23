# Atlas v5 — AnswerSpec v0.2.1 (GATE 0a — CLOSED)

**Status:** Approved — build Phase 0b / Phase 1 against v0.2.1 only.  
**Authors:** Cursor (repo-aligned) + corpus stress-test (Supabase J1T1).  
**Files:** This doc · `REPO_ALIGNMENT.md` · **`BRAIN_EXECUTION_CONTRACT.md`** · `CORPUS_STRESS_TEST.md` · `src/lib/atlas/contracts/answer-spec.schema.ts` · `agents/contracts/answer_spec.py` · `fixtures/j1t1-rail-decarb.golden.json`

> **Read `BRAIN_EXECUTION_CONTRACT.md` before Phase 2.** AnswerSpec defines *what* renders; the execution contract defines *where cognition lives*. Default: functions + model calls. LangGraph = streaming/state shell only — not reasoning as graph logic.

---

## GATE 0a — closed

See **`CORPUS_STRESS_TEST.md`**. Summary: 55 projects · SUM £8,172,702.05 · 18 null (structural EPSRC concentration) · citation UUIDs verifiable · web £ ungrounded → candidate/`toScale:false` correct.

**v0.2.1 change:** optional `blindspot.structure { pattern, implication }` — earned by live data, not speculative.

---

## What changed from v0.1

| Gap in v0.1 | v0.2 fix |
|-------------|----------|
| Three tiers only | **Four tiers** incl. `Speculative` + ceiling `0.28` |
| Nomic embeddings (brief drift) | **OpenAI text-embedding-3-small** — see REPO_ALIGNMENT |
| No `carriedFrom` | **`carriedFrom`** — 12/16 turns in cross-journey evidence |
| Decorative provenance | **`corpus_citations[].id`** = verified `atlas.projects.id` UUID |
| No reconciliation | **`reconciliation`** — wraps live `retrieval_meta` + `reconciliation_notes` |
| Streaming ambiguous | **`AnswerSpecEnvelope`** — revision + partial/final/error |
| Hive path missing | **`hive_citations[]`** — `hive.articles.id` per CLAUDE.md |
| Flat blindspot only | **`blindspot.structure`** — shaped gap (EPSRC null concentration) v0.2.1 |

---

## Streaming lifecycle (load-bearing)

The brain does **not** only emit a final JSON blob. The assistant-ui seam expects **monotonic state updates** on the LangGraph thread.

### State keys (brain → mouth)

| Key | Type | When |
|-----|------|------|
| `answer_spec_envelope` | `AnswerSpecEnvelope` | Every graph update affecting the canvas |
| `chat_complement` | `string` | Streaming markdown — complement only, never artifact copy |

### Envelope semantics

```ts
type AnswerSpecEnvelope = {
  revision: number;           // increment on each spec mutation; mouth ignores stale
  status: 'partial' | 'final' | 'error';
  spec?: Partial<AnswerSpec>; // merged client-side until final
  error?: string;
};
```

**Partial (`status: 'partial'`):** mouth may render spine + verdict + scope as soon as present; instruments wait for `instrument.data`; trust primitives show tier cap immediately.

**Final (`status: 'final'`):** mouth runs `AnswerSpecSchema.safeParse` — hard fail → error surface, not silent degrade.

**Error (`status: 'error'`):** retrieval or validation failure; show `error` + any partial `reconciliation.retrieval.errors`.

### Mouth wiring (existing)

- `src/components/atlas5/langgraph-runtime-provider.tsx` — `onValues` callback pattern
- `src/lib/chatApi.ts` — LangGraph SDK via `/api/lg`
- Phase 1 bootstrap may skip streaming and publish `revision: 1, status: 'final'` in one shot

### Chat vs canvas split (unchanged principle)

- **Canvas** ← `answer_spec_envelope.spec` (durable artifact)
- **Right rail / chat** ← `chat_complement` (so-what complement, live-research disclosure)
- Disclosure line format already proven in workbench: `_Checked N corpus + M live sources · K tension(s) noted_` — may appear in chat only, sourced from `reconciliation.retrieval`

---

## AnswerSpec v0.2 — field reference

### Top level

| Field | Required @ final | Notes |
|-------|------------------|-------|
| `specVersion` | ✓ | `"0.2"` |
| `object` | ✓ | e.g. `"Rail decarbonisation"` |
| `scope` | ✓ | e.g. `"CORPUS + WEB · 55 OBJECTS · ORIENT"` |
| `mode` | ✓ | `Orient` \| `Connect` \| `Diagnose` \| `Act` \| `Defend` |
| `tier` | ✓ | Four-tier enum; drives `ConfidenceCeiling` |
| `tierCapReason` | | From `apply_citation_guard` / reconcile caps |
| `verdict` | ✓ | `{ sentence, tail? }` — full sentence, not a label |
| `stats` | | 3–4 glanceable numbers; each may carry `provId` |
| `blindspot` | | Signed `undercount` \| `absence` |
| `instrument` | | `{ recipe, data, honesty? }` |
| `claims` | ✓ (may be `[]`) | Each links to provenance / citation IDs |
| `corpus_citations` | ✓ (may be `[]`) | UUID-verified project IDs |
| `hive_citations` | | HYVE path — article-level |
| `web_evidence` | | Always `candidate`; never in `corpus_citations` |
| `provenance` | ✓ | Map keyed by `provId` used in stats/claims |
| `reconciliation` | | Phase F retrieval + notes |
| `carriedFrom` | | Turn 2+ accretion |
| `soWhat` | ✓ | Right-rail contract |
| `query` | | Original user query |
| `thread_id` | | LangGraph thread |

### `reconciliation` (maps from Phase F)

```ts
reconciliation: {
  notes: ReconciliationNote[];  // corroborate | conflict | discover | external_primary
  retrieval: RetrievalMeta;       // agents/orchestrator/retrieval_fabric.EvidenceBag.as_meta()
}
```

Live `conflict_count` is derived: `notes.filter(n => n.type === 'conflict').length` — also denormalized on `retrieval.conflict_count`.

### `blindspot`

```ts
blindspot: {
  sign: 'undercount' | 'absence';
  gap: string;
  closable?: string;
  secondary?: string;
  structure?: {              // v0.2.1 — when missingness has a known shape
    pattern: string;         // e.g. "nulls concentrate in EPSRC (15/18)"
    implication: string;   // e.g. "£8.17m ≈ complete IUK spend in slice"
  };
}
```

### `carriedFrom`

```ts
carriedFrom: {
  turn: 2,
  of: 4,
  summary: "Verdict tightened after web pass corrected network density.",
  fromTurns: [1],
  evolvedFields: ["verdict", "tier"]
}
```

### `instrument.honesty` (J1T1 rule)

```ts
instrument: {
  recipe: "IncommensurableMagnitudes",
  data: { /* recipe-specific */ },
  honesty: { toScale: false, label: "axis compressed at the gap" }
}
```

`toScale: true` only when geometry is computed from values (see `Atlas_FundingDensity_Surface.html`).

---

## Trust primitives (Phase 0.2 — unchanged intent, repo-aligned tiers)

| Primitive | Consumes |
|-----------|----------|
| `ConfidenceCeiling` | `tier` → `TIER_CEILING_FRACTION[tier]` |
| `ProvenanceTrace` | `provenance[provId]` |
| `TrustBadge` / `SourceBadge` | `trust: corpus \| web` material treatment |
| `AnswerabilityCard` | `blindspot` |

Reference lift: `experiments/Cursor todate/AtlasSurface.jsx` — logic only, not `DATA`.

---

## Reuse map (do not rebuild from scratch)

### Mouth — `/atlas` route

| Asset | Path | Use |
|-------|------|-----|
| assistant-ui runtime | `src/components/atlas5/langgraph-runtime-provider.tsx` | Wire `onValues` → `answer_spec_envelope` |
| LangGraph client | `src/lib/chatApi.ts` | Thread create / state / stream |
| Lab shell preview | `src/components/lab/langgraph/atlas-shell.tsx` | Layout reference (mock → replace) |
| Confidence styles | `src/lib/atlas5/confidence-styles.ts` | Tier visual weight (4 tiers) |
| Claim / trust badges | `src/components/atlas5/claim-state-badge.tsx` | Spine badge primitive |
| Recipe surfaces | `src/components/atlas5/recipes/*-surface.tsx` | Pattern reference for orient/connect/diagnose |
| Surface primitives | `src/components/atlas5/recipes/surface-primitives.tsx` | Partial spine overlap |
| Zod citation guards | `src/lib/atlas5/artifact-schema.ts` | **Import** into AnswerSpec schema |
| AnswerSpec v0.2 | `src/lib/atlas/contracts/answer-spec.schema.ts` | GATE validator |

### Brain — Phase 2

| Asset | Path | Use |
|-------|------|-----|
| **Execution contract** | `contracts/atlas-v5/BRAIN_EXECUTION_CONTRACT.md` | **Read first** — functions default, graph by exception |
| Parallel retrieval | `agents/orchestrator/retrieval_fabric.py` | Wide-pass plumbing only |
| Evidence pipeline | `agents/orchestrator/evidence_pipeline.py` | fetch → reconcile → meta |
| Reconciliation | `agents/orchestrator/reconcile.py` | `reconciliation.notes` shape |
| Citation guard | `agents/spine/citation_guard.py` | `_cap_tier` @ module scope |
| External evidence schema | `agents/orchestrator/evidence_schema.py` | `web_evidence` items |
| Answer quality skill | `experiments/Cursor todate/atlas-answer-quality-SKILL.md` | Heavy-model reasoning contract |
| Brain architecture | `experiments/Cursor todate/Atlas_Brain_Build_Spec.md` | Hub-in-graph pattern (align with execution contract) |
| Pydantic mirror | `agents/contracts/answer_spec.py` | Emit validation |

**Do not wire Phase 2 brain through `agents/orchestrator/graph.py` or `outcome_builders.py`.**

### Explicitly frozen (compare only)

| Asset | Path |
|-------|------|
| Workbench orchestrator | `src/components/workbench/*`, `agents/orchestrator/graph.py` |
| CopilotKit route | `src/app/api/copilotkit/route.ts` |
| Render model | `src/lib/workbench/atlas-render-model.ts` |

### Future adapter (post–GATE 2 — not Phase 0)

`render_model` → `AnswerSpec` adapter for A/B comparison — **do not build until /atlas passes GATE 2**.

---

## GATE 0a checklist

- [x] **REPO_ALIGNMENT.md** approved (3 conflict fixes)
- [x] **AnswerSpec v0.2.1** schema approved (incl. `blindspot.structure`)
- [x] **Streaming envelope** approved (`AnswerSpecEnvelope`)
- [x] **Corpus stress-test** — see `CORPUS_STRESS_TEST.md`
- [x] **Brain execution contract** — `BRAIN_EXECUTION_CONTRACT.md`

## GATE 0b checklist

- [x] Four trust primitives (`src/components/atlas/spine/`)
- [x] Golden fixture validates (`eval/atlas-spine-golden.test.ts`)
- [x] Smoke page at **`/atlas/dev`** — primitives against J1T1 golden
- [ ] Product review (Tier 3) — open `/atlas/dev` in browser

---

## J1T1 proving query (unchanged)

**Query:** State of play on rail decarbonisation in our corpus  
**Filter:** `atlas.projects` where `'rail' = ANY(cpc_modes)` AND `'decarbonisation' = ANY(cpc_themes)`  
**Schema notes:** `funding_amount` numeric nullable; `live_calls.funding_amount` is TEXT; apply `relevance_tag` / `transport_relevance_score` at query time.

Golden structure: `contracts/atlas-v5/fixtures/j1t1-rail-decarb.structure.json` — numbers are **placeholders** until live query binds them.

---

## Open questions for corpus stress-test

1. Do all J1T1 `corpus_citations[].id` resolve in `atlas.projects` with the rail+decarb filter?
2. Does `£8.17m` aggregate match `SUM(funding_amount)` with null-floor semantics documented in blindspot?
3. Does web tier for `~£11.7bn` national programme stay `verification_state: candidate` with `honesty.toScale: false`?
4. Any journey turn require a field not in v0.2? (Report back → v0.2.1)
