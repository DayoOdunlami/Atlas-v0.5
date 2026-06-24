# Atlas v5 — Gate 1 Architecture Decision

> **Status:** Gate 1 complete — **awaiting approval before Gate 2 (Increment 0 only).**  
> **Inputs:** Gate 0 [`RECON_DELTA.md`](RECON_DELTA.md) (approved), sprint brief A→B, [`docs/ATLAS_V5_BLUEPRINT.md`](docs/ATLAS_V5_BLUEPRINT.md).  
> **Ratifies closed forks:** advisor model loop (not regex elicit); design-first unified claims spine; `kind` enum with single `declared` material.

---

## Executive summary

Gate 1 settles five decisions. **No Gate 2 code in this document.**

| Decision | Resolution |
|----------|------------|
| **1 — C1 precedence** | Declared-uncertainty cue **beats** domain-keyword cue → `find_path` surface; domain still scopes wide_pass retrieval |
| **2 — Elicit = advisor loop** | **Sonnet deep_pass** reads/writes the claims case file each turn; adaptive reconciliation is **disposition prose**, not control flow |
| **3 — Epistemic stance** | **Narrow:** `claim_subtype` = `kind` enum; stance via `confidence_tier` on declared rows only — **no system-wide axis this sprint** |
| **4 — Increment split** | **Inc 0:** declared ledger + trust rail + gate (routing unchanged). **Inc 1:** C1/C5 routing + find-my-path surface + disposition + 5 calibration evals |
| **5 — Claims spine** | **No fifth fork.** Practitioner consumes `atlas.claims` + session `entity_type='user_situation'`; ephemeral by default; `profile_claims` on save |

**Gate 0 supersession:** Deterministic `situation_elicit.py` parser is **withdrawn**. One exception: **thin route signals** (uncertainty cue for C1) in `turn_classifier.py` — routing only, not advisor reasoning.

---

## Contradictions surfaced (reported, not silently resolved)

| ID | Issue | Resolution in this doc |
|----|--------|-------------------------|
| **K1** | Gate 0 proposed regex `situation_elicit` | **Superseded** by Decision 2; Inc 0 uses model in deep_pass + case-file load/save in wide_pass/post-deep |
| **K2** | Brief Decision 4 step label “elicit” | Renamed **case-file advisor pass** (deep_pass); wide_pass only **loads/persists** spine |
| **K3** | `profile_claims.container_id` → `evidence_containers` | Ephemeral claims use **`claims.entity_type` + `entity_id=thread_id`** without join; **save** creates/links container (Inc 1+ or save flow) |
| **K4** | `atlas.claims.confidence_tier` CHECK ≠ AnswerSpec `ConfidenceTier` | **Dual mapping table** below — not one enum |
| **K5** | `passport_gaps` DDL in repo is simpler than full requirements/evidence pair | **Find-my-path A→B gap** rendered in AnswerSpec (`blindspot` / compose) this sprint; **passport_gaps pattern** for saved profiles — later |
| **K6** | `brief_claims` referenced in TS scripts, not in `20260522_corpus_schema.sql` | Fork exists in deployed DB / legacy brief-v2; **migration parked** — do not touch this sprint |

No blocker prevents Increment 0. **K3** means Increment 0 case file is **thread-scoped claim rows or in-memory mirror** with Supabase write optional behind flag.

---

## Decision 1 — C1 precedence (settled first)

### The rule (single sentence)

> **When a declared-uncertainty cue is present, it takes precedence over the domain-keyword cue** — the turn routes to **find-my-path**, not analyst orient, even if a domain keyword is present. The domain keyword still informs *which* corpus/web evidence is gathered; it does **not** force the surface.

### Precedence order in `classify_turn()` (after `prepare`, before wide_pass)

```
1. Empty / showcase / clear canvas     → existing handlers
2. Pure chat (hello, no domain)        → chat
3. Off-topic (Haribo, etc.)            → chat  (+ deep_pass chat disposition)
4. ★ Declared-uncertainty cue present  → substantive + outcome_hint=find_path  (WINS over domain)
5. Substantive domain canvas query     → substantive + orient|connect|diagnose|act|defend
6. Default conversational              → chat
```

**Remove or invert** the current bug: `is_substantive_canvas_query()` must **not** override Haiku `chat` → `substantive` when step 4 fires. When step 4 fires, **always** `find_path`, never orient.

### Uncertainty cue (route signal only — not advisor elicit)

Thin patterns in `turn_classifier.py` / shared `intent.py` helper `has_declared_uncertainty_cue(query)`:

- `not sure what I'm asking`, `don't know what I'm asking`, `don't know where to start`
- `got an idea but`, `half.?formed`, `working through`, `help me figure out`
- `what should I (even )?be asking`

**Not** used to parse facts/constraints/hypotheses — only **boolean** for step 4.

Domain scope for wide_pass still uses existing `_DOMAIN_ORIENT_RE` / `corpus_scope_for_query()` on the **full utterance** (e.g. “rail” scopes retrieval).

### C5 resolution (same move)

`find_path` is **`substantive` with canvas update** — never the dead-end `chat` path.

| Field | find_path turn |
|-------|----------------|
| `route` | `substantive` |
| `outcome_hint` | `find_path` (new) |
| `update_canvas` | `true` |
| `primary_surface` | `canvas_primary` or `hybrid` (disposition) |
| AnswerSpec | Updated every turn — **declared claims in trust rail** |

Chat-only remains for calibration **#1 hello** and **#2 off-topic** (no uncertainty cue).

### Precedence proof table (calibration exam)

| Turn | Uncertainty cue? | Domain keyword? | Route | Surface |
|------|------------------|-----------------|-------|---------|
| #3 `"I've got some rail idea, not sure what I'm asking"` | **Yes** | rail | substantive | **find_path** (NOT orient) |
| #4 `"state of rail decarbonisation"` | No | rail | substantive | **orient** (journey/R1 — answered directly) |
| #4 variant `"state of play on rail decarbonisation"` | No | rail | substantive | orient / journey |
| `"hello"` | No | No | chat | none |
| `"latest Haribo innovations?"` | No | No | chat | none |

### Implementation locus (no new LangGraph node)

| File | Change (Increment 1) |
|------|----------------------|
| `agents/atlas_v5/intent.py` | `has_declared_uncertainty_cue()`, `infer_outcome_hint()` adds `find_path` |
| `agents/atlas_v5/turn_classifier.py` | Precedence step 4; **delete** domain override that beats uncertainty |
| `agents/atlas_v5/wide_pass.py` | Branch `outcome == "find_path"` → `assemble_find_path_spec()` skeleton |
| `agents/atlas_v5/run_turn.py` | Pass `find_path` through (no new node) |

---

## Decision 2 — Elicit is the advisor reasoning loop (closed: model)

### What “elicit” means after Gate 1

**Not** a one-time parse step. **Not** a LangGraph node.

The **advisor/detective loop** runs inside **one Sonnet deep_pass call per turn**:

1. Read **case file** (prior `atlas.claims` rows for `entity_type='user_situation'`, `entity_id=thread_id`)
2. Read **user utterance** + **parallel evidence** (corpus ‖ web ‖ SQL — unchanged)
3. **Reason** — notice tensions (earnings + bonus), shaky hypotheses, uncertainty
4. **Decide disposition** — answer / flag-premise / surface-question + **adaptive reconciliation depth**
5. **Write back** refined claims to case file + **AnswerSpec mirror**
6. **Compose** find-my-path or analyst surface as disposition dictates

This respects §16: the model **structures what the user declared** and **interprets** borrowed/owned evidence — it does **not** invent corpus UUIDs or owned SQL figures.

### wide_pass role (pipeline — not cognition)

| wide_pass duty | LLM? |
|----------------|------|
| Load session case file claims for `thread_id` | No |
| Run dual lane + SQL (domain keyword scopes queries) | No |
| Assemble skeleton by `outcome_hint` | No |
| Attach loaded claims to `EvidenceBag` / wide result for deep_pass input | No |
| Persist model-written claims **after** deep_pass returns | No (write in `run_turn` post-deep) |

### Adaptive reconciliation (disposition axis — prompt only)

Add **paragraphs** to `deep_pass_prompt.py` (Increment 1), not branches:

**Reconciliation depth sits beside answer / flag-premise / surface-question:**

- **Tangled declared picture** (multiple claims, load-bearing tension): surface **1–2** tensions that matter; ask user to refine; write split claims back to spine.
- **Clean wide question** (no uncertainty, no internal tension): **do not** manufacture tension; answer directly (#4).
- **Uncertainty without structure yet**: thinking-partner mode — reflect situation, surface real question (#3).

**Advisor, not underwriter:** reconcile **internal consistency and evidence tier**; do **not** certify external truth (ISO genuine, bank proof). Say so when relevant.

### Boundary vs Gate 0 `EvidenceBag.declared`

Gate 0 proposed `EvidenceBag.declared: list[DeclaredEvidenceItem]`. Gate 1 **maps this to case-file claims**:

- **Transport:** `EvidenceBag.session_claims: list[CaseClaim]` loaded in wide_pass from store
- **After deep_pass:** same list replaced/merged from model output → persisted → copied to `AnswerSpec.claims[]` with `source=declared`

No separate parallel “declared bag” long term — **one spine, one mirror**.

---

## Decision 3 — Epistemic stance on declared evidence (narrow)

### Two orthogonal axes (conceptual)

| Axis | Question | This sprint |
|------|----------|-------------|
| **Provenance / material** | Where did it come from? | `owned` \| `borrowed` \| **`declared`** |
| **Epistemic stance** | How was it derived? | **`kind` + `confidence_tier`** on declared rows only |

**Not a third lane.** Stance is metadata on claims, not a retrieval lane.

### `kind` enum (approved — single `declared` material)

| `claim_subtype` (`kind`) | Stance (`confidence_tier` on row) | Treatment |
|--------------------------|-----------------------------------|-----------|
| `fact` | `self_reported` | Reflect as stated; no verification |
| `domain` | `self_reported` | Scopes retrieval; reflected in situation panel |
| `constraint` | `self_reported` | Reflected; may drive gap language |
| `hypothesis` | `ai_inferred` or `pending_review` | Check against web/corpus in narrative; render **borrowed/candidate** when leaning on external check — never as owned |
| `uncertainty` | `self_reported` | **Routing cue** (Inc 1); drives surface-question disposition |

**No new schema axis** beyond `claim_subtype` + existing `confidence_tier` CHECK on `atlas.claims`.

### Mapping to AnswerSpec mirror

Extend `Claim` (or parallel declared entries) for mouth render:

```python
# AnswerSpec.claims[] mirror (Increment 0+)
Claim(
  id=claim_uuid,
  text=claim_text,
  source="declared",          # new TrustScope value
  trust="declared",           # UI material
  tier=...,                   # AnswerSpec ConfidenceTier (mapped)
  caveat=confidence_reason,
)
```

Add `TrustScope = Literal["corpus", "web", "synthesized", "declared"]` in Python + TS.

### System-wide epistemic axis — **parked**

Recorded as §16 target: all deep-pass claims across analyst + practitioner jobs. **Not built this sprint.** Narrow version is sufficient for calibration #5 (tangled vs clean).

---

## Decision 4 — Increment split

### Increment 0 — Declared ledger (routing **unchanged**)

**Goal:** Third trust material visible, gate-safe, on turns that **already** reach canvas.

| Step | Work | Files (indicative) |
|------|------|-------------------|
| 0.1 | **Case file module** — load/save claims by `thread_id`; `entity_type='user_situation'`, `source='declared'` | `agents/atlas_v5/case_file.py` (new) |
| 0.2 | **Schema mapping** — `CaseClaim` ↔ `atlas.claims` columns | same + migration if `source='declared'` needs comment only |
| 0.3 | **EvidenceBag / wide_pass** — attach `session_claims` on load | `retrieval_fabric.py` or `wide_pass.py` |
| 0.4 | **deep_pass output** — model extracts/updates declared claims on **existing substantive routes**; persist after turn | `deep_pass_models.py`, `deep_synthesis.py`, `deep_pass_prompt.py` (minimal extract paragraph) |
| 0.5 | **AnswerSpec** — populate `claims[]` with `source=declared`; reconcile note | `answer_spec.py`, `answer-spec.schema.ts`, `reconcile_spec.py` |
| 0.6 | **Material + gate** — `declared` in `Material`; gate allows `data-material="declared"` prose blocks | `keyed_figures.py`, `composition_gate.py`, `skills/atlas-visual-composition.md` |
| 0.7 | **Trust rail** — third swatch “Stated by user” | `atlas-answer-surface.tsx`, `trust-badge.tsx` |
| 0.8 | **Tests** — case file round-trip; gate accepts declared markup; no orphan figure errors | `agents/test_case_file.py`, extend composition tests |

**Exit proof:** Substantive orient turn where user embeds situation text → declared claims appear in AnswerSpec + trust rail. **§15 demos still green.** Calibration #3 **still fails** (expected — routing in Inc 1).

**Deliberately out:** `find_path` routing, T3 template, calibration suite, C1 fix.

### Increment 1 — Routing + disposition + find-my-path surface + evals

| Step | Work |
|------|------|
| 1.1 | C1 precedence + `find_path` outcome (`Decision 1`) |
| 1.2 | `assemble_find_path_spec()` — skeleton, **not R4** |
| 1.3 | Template **T3** find-my-path compose + `visual_intent` |
| 1.4 | Disposition prompt upgrade (answer / flag / surface + adaptive reconciliation) |
| 1.5 | Wire uncertainty → find-my-path surface in disposition output |
| 1.6 | `claim_evidence_links` — link declared hypotheses to web/corpus hits (optional within Inc 1) |
| 1.7 | Five calibration evals (brief #1–5) |
| 1.8 | Blueprint §10/§13/§16 updates |

**Exit proof:** All five calibration turns pass; §15 demos pass; practitioner one-line test met.

---

## Decision 5 — Unified claims spine (design world-class; build narrow)

### What exists in Supabase (verified in repo)

**Canonical spine** — `supabase/migrations/20260522_cpc_corpus_schema.sql`:

- `atlas.claims` — `entity_type`, `entity_id`, `claim_subtype`, `confidence_tier`, `confidence_reason`, `source`, `review_status`, `metadata`, `embedding`, …
- `atlas.profile_claims` — `(container_id, claim_id)` → `evidence_containers`
- `atlas.claim_evidence_links` — `evidence_type`, `evidence_quality`, `source_confidence`

**Forks** (do not extend):

- `atlas.passport_claims` — `scripts/setup-atlas-storage.ts` (passport-scoped lifecycle)
- `atlas.brief_claims` — legacy brief-v2 (scripts reference; not in corpus migration)
- `atlas.passport_gaps` — gap rows tied to `evidence_passport_id`

### Practitioner mapping (no fifth fork)

| Concept | Storage |
|---------|---------|
| Declared situation claim | `atlas.claims` row: `entity_type='user_situation'`, `entity_id=<thread_id>`, `source='declared'`, `claim_subtype=<kind>`, `claim_text=...`, `confidence_tier=...` |
| Session case file | All rows for `(user_situation, thread_id)` |
| Ephemeral default | Rows written each turn; **no** `profile_claims` until user saves |
| Save (later) | Create `evidence_containers` row (type `user_session` or reuse passport container) + `profile_claims` join — **same claims rows**, promoted not copied |
| Parallel search reinforces/contradicts hypothesis | `claim_evidence_links` with `evidence_type='corpus_project'|'web_excerpt'`, `source_confidence='supports'|'contradicts'|'neutral'` |
| Claim–claim tension | `metadata.conflicts_with=[uuid]` or existing passport conflict columns when migrated — **Inc 1 dialogue only**, no verify UI |

### `confidence_tier` dual mapping

| `atlas.claims.confidence_tier` | Used when | AnswerSpec `tier` cap for claim |
|--------------------------------|-----------|----------------------------------|
| `self_reported` | fact, domain, constraint, uncertainty | Indicative max in UI copy |
| `ai_inferred` | hypothesis being checked | Speculative / Indicative |
| `pending_review` | hypothesis awaiting user confirm | Indicative |
| `verified` | **not used** for declared this sprint | N/A — underwriter future |

Atlas product tiers (`Speculative`…`Robust`) remain on **spine verdict**, not per declared row, except where `Claim.tier` mirrors stance.

### Agent trilogy (design on paper — build advisor only)

| Agent | Role | Sprint |
|-------|------|--------|
| **Advisor / detective** | Reason over case file; reconcile in conversation; refine claims | **This sprint** |
| **Packager** | Arrange refined claims into bid/transferability pack (CV-writer pattern) | Parked |
| **Underwriter** | Independently verify truth | Walled out |

**Reconciliation in conversation = core.** Verify/reject/edit **buttons** parked; schema machinery (`review_status`, conflict fields) exercised through **dialogue** only.

### Sequenced §16 targets (parked)

1. Migrate `passport_claims` + `brief_claims` onto `atlas.claims`
2. Document-upload evidence path → `claim_evidence_links`
3. Packager agent
4. Underwriter agent
5. System-wide epistemic axis on all AnswerSpec claims

---

## Find-my-path — AnswerSpec shape (Increment 1)

### Catalogue row 9

| Field | Value |
|-------|--------|
| **Decision surface** | Find my path |
| **User need** | Surface real question; match funding/partner/capability; next move |
| **Dominant visual** | Declared situation panel + reflected question + 1–3 matches |
| **Implementation** | **T3** template + compose; spine fields; **not R4** |
| **Inventory** | **S9** surface, **T3** template, outcome **`find_path`** |

**Explicit:** **R4 OpportunityList ≠ find-my-path.** R4 remains “Action Plan / ranked list” for explicit act intent without uncertainty cue.

### AnswerSpec fields used

| Field | find_path usage |
|-------|-----------------|
| `mode` | `FindPath` (new `OutcomeMode` value) |
| `scope` | `PRACTITIONER · FIND PATH · <thread slice>` |
| `verdict` | Reflects **real question** or surfaced tension — not landscape summary |
| `soWhat` | Six cockpit fields — **primaryAction** = one next move |
| `claims[]` | Declared case-file mirror (`source=declared`, per-kind) |
| `web_evidence` / `corpus_citations` | Matches for hypotheses (borrowed/owned) |
| `reconciliation` | Notes on declared + web/corpus check |
| `canvas.merged_markup` | **T3** — `data-testid="find-my-path"`, declared panel + question reflection |
| `instrument` | **`null`** primary; R4 only on compose gate failure if query explicitly asked for ranked opportunities |
| `chart` | null |
| `blindspot` | Optional A→B gap language (passport_gaps **pattern**, not required DDL this sprint) |
| `stats` | Optional slim strip if SQL ran — **not** dominant |

### Assembler

`agents/atlas_v5/find_path_assembler.py` — minimal skeleton:

- Loads stats optional; sets mode/scope; empty instrument; seeds `claims` from case file; tier Indicative default
- Does **not** rank opportunity list

---

## `deep_pass_prompt.py` — disposition diff plan (Increment 1)

**No new branches.** Add/refine **prose blocks** only.

### Block A — Disposition weighing (replace/ sharpen §Reading what's really being asked)

> Default: **answer well and carry momentum forward.** Surface the real question only when the declared picture contains **uncertainty about the question itself** or a **load-bearing premise** that would make a direct answer misleading. Flag a shaky premise inline when you answer — do not interrogate by default. Never brick-wall; never constant “what are you really asking?”

### Block B — Adaptive reconciliation depth (new, beside disposition)

> When the case file is **tangled** (multiple declared claims with load-bearing tension — e.g. earnings figure vs bonus), **notice the 1–2 tensions that matter**, reflect them, ask the user to refine, and **write refined claims back** to the case file. When the question is **clean and wide** with no uncertainty cue and no internal tension, **do not** manufacture reconciliation — answer directly. Same judgement, opposite behaviour.

### Block C — Advisor / underwriter wall (new)

> You advise on the **stated picture** and evidence tier. You do **not** certify that self-reported facts are true (certifications, financials). Say when something would need independent verification.

### Block D — Find-my-path surface (new)

> When disposition surfaces the real question (`find_path` / uncertainty cue), compose **T3 find-my-path**: declared situation visible with `data-material="declared"`; reflect the question beneath the question; add at most 1–3 corpus/web matches as borrowed/owned — **not** a ranked opportunity list.

### Block E — Evidence input (amend §Where evidence comes from)

> Third input: **declared case file** (`user_situation` claims) — material **declared**, never owned. Update claims from the user’s words; do not invent owned figures.

### Structured output

Extend `DeepPassOutput` / `JudgementFieldsOutput` (Increment 0/1):

```python
case_claims: list[CaseClaimOut]  # model write-back
disposition_reconciliation: str    # optional one-line note for dev overlay
```

**Eval proof:** calibration #1–5 — tune Blocks A–B if fail; **do not** add `if/else` nodes.

---

## Gate + trust rail (Increment 0)

### Gate rules for `declared`

- Allow HTML sections with `data-material="declared"` **without** numeric `{{key}}` holes
- Optional `data-claim-id="<uuid>"` linking to case file row
- Forbid `data-material="owned"` on declared content
- Existing orphan currency / scale rules unchanged for stats.*

### Trust rail copy

| Material | UI |
|----------|-----|
| owned | ● corpus — solid, owned |
| borrowed | ┄ web — dashed, borrowed |
| **declared** | ◇ stated by user — declared situation |

---

## §16 Blueprint amendment draft (apply after Gate 2 Inc 1)

Add to `docs/ATLAS_V5_BLUEPRINT.md`:

1. **Evidence boundary amendment:** wide_pass loads case file; deep_pass **structures declared input**; hub still cannot invent owned figures or corpus UUIDs.
2. **Third trust material:** `declared` / UI “Stated by user”.
3. **Decision surface row 9:** Find my path — **T3 / find_path — R4 ≠ this surface**.
4. **Unified claims spine** as canonical; fork migration sequenced.
5. **Agent trilogy:** Advisor (now) · Packager · Underwriter (parked).
6. **§13 gap:** session save promotion via `profile_claims`; system-wide epistemic axis.
7. **§10 inventory:** S9, T3, outcome `find_path`, `case_file.py`.

---

## Increment 0 implementation draft (for Gate 2 approval)

**Scope:** Steps 0.1–0.8 above. **No routing changes.**

**Suggested PR order:**

1. `CaseClaim` types + `case_file.py` (in-memory store first; Supabase adapter behind `ATLAS_V5_CASEFILE_PERSIST=1`)
2. Contract: `TrustScope.declared`, `Claim` extensions
3. wide_pass load → EvidenceBag
4. deep_pass: extract/update `case_claims` in structured output + persist
5. reconcile + AnswerSpec mirror
6. gate + trust rail
7. Tests + run §15 validation

**Stop after Increment 0 merges** — re-run approval before Increment 1.

---

## Gate 1 exit checklist

- [x] Decision 1 — C1 precedence + C5 + proof table
- [x] Decision 2 — Model advisor loop; wide_pass load/save only; adaptive reconciliation in prompt
- [x] Decision 3 — Narrow epistemic via `kind`; no system-wide axis
- [x] Decision 4 — Increment 0/1 split reframed post–Decision 2
- [x] Decision 5 — Unified spine; no fifth fork; ephemeral + save path
- [x] Find-my-path AnswerSpec shape
- [x] deep_pass disposition diff plan
- [x] §16 amendment draft
- [x] Contradictions K1–K6 reported
- [ ] **Gate 2 Increment 0** — blocked until approval

---

## Plain verdict

The closed decisions in your brief **survive scrutiny** with one intentional reframing: **Increment 0 “elicit” becomes deep_pass model write-back + case-file persistence**, not a parser module. **Thin uncertainty regex stays route-only** for C1 in Increment 1 — it does not contradict Decision 2.

No material refinement needed to the precedence rule, spine strategy, or increment split. **Proceed to Gate 2 Increment 0** on approval.

---

*Gate 1 architecture decision — practitioner sprint.*
