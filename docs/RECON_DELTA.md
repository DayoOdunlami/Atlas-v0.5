# Atlas v5 — Gate 0 Recon Delta (A → B)

> **Status:** Gate 0 complete — **awaiting approval before Gate 1.**  
> **Scope:** Honest diagnosis of A, delta to B, `declared` evidence proposal (not a decision), risks, minimum unlock recommendation.  
> **Canonical references:** `docs/ATLAS_V5_BLUEPRINT.md` (§1, §2, §10, §13, §15, §16); sprint brief A→B practitioner path.

---

## Executive summary

**A is a working trust-first pipeline** with strong analyst journeys (orient, connect, diagnose, act-as-ranked-list) and a **prompt-level** practitioner voice that **does not have a buildable evidence or surface path**.

The sprint’s main gap is real: practitioner “find my path” is **not** the same as R4 OpportunityList, and today there is **no `declared` evidence class**, **no trust-rail slot for user situation**, and **routing that can force analyst canvas** when the user is thinking aloud with domain keywords (e.g. “rail”).

**Recommended minimum unlock (Gate 0 proposal):** deterministic **situation elicit** inside `wide_pass` → **`declared` in EvidenceBag / AnswerSpec** → **routing fix** so declared-uncertainty turns reach a **find-my-path surface** (compose-first, not R4) → **disposition prompt refinement** + **four calibration evals**. No new LangGraph reasoning nodes.

---

## 1. Honest diagnosis of A

### What is good — keep

| Area | Evidence in code | Why keep |
|------|------------------|----------|
| **Pipeline evidence + hub judgement** | `wide_pass` → assemblers → `deep_pass` → merge/gate | Matches north star; reproducible skeleton |
| **Parallel corpus ‖ web** | `web_lane.py`, `retrieval_fabric.py`, `reconcile_spec.py` | Peer lanes live; aligns with product |
| **AnswerSpec contract + render fork** | `answer_spec.py`, `atlas-answer-surface.tsx` | Stable mouth/brain seam |
| **Recipes R1–R4 + templates T1–T2** | `*_assembler.py`, `visual_templates.py` | Analyst surfaces partially world-class |
| **Keyed figures + compose gate** | `keyed_figures.py`, `composition_gate.py` | Core moat — do not weaken |
| **Disposition in one Sonnet act** | `DeepPassOutput`, `deep_pass_prompt.py` | Already aligned with brief (no branched reasoning nodes) |
| **Practitioner voice in prompt** | `DEEP_PASS_SYSTEM_PROMPT` §Two kinds of person | Intent exists — **implementation lags** |
| **Progressive streaming + dev overlay** | `progressive_stream.py`, `dev-overlay.tsx` | Good plumbing for decision cockpit |

### Accidental complexity — simplify over time, not in Gate 0

| Issue | Where | Note |
|-------|-------|------|
| **Two routing systems** | `turn_classifier.py` (Haiku) vs `chat_router.classify_follow_up` (heuristics) | Overlap; different rules; easy to contradict |
| **Haiku ↔ heuristic override** | `classify_turn()` forces `substantive` when `is_substantive_canvas_query()` even if Haiku said `chat` | **Directly fights practitioner calibration turn #3** |
| **Outcome hint vs surface** | `outcome_hint` picks assembler; `visual_intent` picks template/chart — orthogonal | Practitioner job needs a **surface** dimension, not just `act` |
| **Distributed “compiler”** | Assemblers + deep_pass + chart attach + merge | Fine architecturally; hard to reason about without §16 catalogue |
| **Orchestrator in repo** | `agents/orchestrator/graph.py` | Mental-model noise; not `/atlas` — keep labeled experimental |

### Missing for B

| Gap | Impact |
|-----|--------|
| **`declared` evidence class** | User situation cannot appear in ledger or trust rail |
| **Find-my-path decision surface** | No catalogue row, inventory ID, template/recipe, or eval |
| **Situation elicit step** | User text never structured as evidence before deep_pass |
| **Declared uncertainty → disposition hinge** | No wire from parse → surface selection |
| **Trust rail third material** | Mouth shows only owned (corpus) + borrowed (web) |
| **Practitioner eval suite** | Four calibration turns not in `genui_eval.py` / pytest |
| **Decision cockpit (B.2 six things)** | Fields exist piecemeal; not composed as one surface for practitioner |

### Wrong layer today

| Thing | Current layer | Should be (B) |
|-------|---------------|---------------|
| Practitioner “primary input” | Prose in `act_assembler` verdict + `practitionerQuery` string in R4 data | **`declared` evidence** in bag + AnswerSpec + trust rail |
| Thinking-partner behaviour | `chat` route → `synthesize_chat_reply` (chat-only, **no canvas**, no declared) | **Substantive or hybrid** with find-my-path surface when uncertainty cue present |
| “Help me find my move” | Collapsed into **Act** outcome → **R4 ranked list** | **Distinct surface:** elicit → reflect question → match → next move |
| Domain keyword “rail” | `is_substantive_canvas_query()` → **forces analyst orient** | Must **not** override declared-uncertainty practitioner turns |

### What specifically prevents the practitioner job being buildable today

1. **No typed evidence for user situation** — `EvidenceBag` only holds `corpus_raw`, `external`, `candidates` (`retrieval_fabric.py`). `Material` is `owned | borrowed | inferred | absent` only (`keyed_figures.py`). `TrustScope` is `corpus | web | synthesized` (`answer_spec.py`). **`declared` / `user_situation` does not exist.**

2. **Practitioner path = R4, which is analyst-shaped** — `assemble_act_spec()` runs only when `wide.outcome == "act"`. It builds **OpportunityList** from web candidates + corpus hits ranked for “fit,” not from elicited situation. The user query is echoed as a string, not evidence class.

3. **Thinking-aloud often never reaches deep_pass** — `run_turn.py` sends `chat`/`clarify` to `synthesize_chat_reply` with **`update_canvas: false`**. No AnswerSpec update → **no trust rail**, no declared block, no find-my-path compose.

4. **When thinking-aloud reaches substantive, it gets analyst orient** — `is_substantive_canvas_query()` matches `_DOMAIN_ORIENT_RE` (includes `rail`, `sme`, `innovation`, …). **`classify_turn()` overrides Haiku `chat` → `substantive`** for those queries. Result: wide_pass + R1 orient/journey, **opposite of calibration #3**.

5. **Gate cannot represent declared figures today** — Gate validates `data-key` against KeyedFigureIndex and numeric orphans. Declared situation is **prose**, not SQL keys. Without explicit `data-material="declared"` rules, compose either skips situation or risks orphan-figure errors.

6. **No eval for disposition calibration** — Existing evals cover SWOT, journey, chart, NetworkMap; **not** hello / Haribo / lost / clean wide question quartet.

---

## 2. A → B delta table

| B outcome | Status | Already present | Partially present | Absent | Files likely to change (Gate 2+) |
|-----------|--------|-----------------|-------------------|--------|----------------------------------|
| **B.1 Analyst job (landscape)** | Mostly **today** | wide_pass dual lane, R1–R3, T1–T2, C1, spine | Visual grammar thin; Strategic Options / Defensible Recommendation surfaces target-only | — | `chart_spec.py`, `visual_templates.py`, `genui_eval.py`, mouth polish |
| **B.1 Practitioner job (find path)** | **Absent as first-class surface** | Prompt prose; R4 when `outcome=act` | `act_assembler.py` ranks signals; not elicit/reflect/match | `declared` evidence; find-my-path surface; uncertainty hinge | `situation_elicit.py` (new), `EvidenceBag`, `reconcile_spec.py`, `answer_spec.py`, `turn_classifier.py`, `intent.py`, `deep_pass_prompt.py`, `visual_templates.py` or compose skill, `atlas-answer-surface.tsx`, eval module |
| **B.2 Six things clear (cockpit)** | **Partial** | `verdict`, `tier`, `blindspot`, `soWhat`, `stats`, `reconciliation`, `web_evidence` | Not unified on practitioner surface; chat-only path shows none | Practitioner-specific layout + declared block | `AnswerSpec` fields, mouth components, find-my-path template |
| **B.3.1 Situation-as-evidence (`declared`)** | **Absent** | `inferred` material in templates; `practitionerQuery` string | Prompt says “situation is primary input” | Evidence class, reconcile, gate rules, trust rail | See §3 below |
| **B.3.2 Find-my-path surface (9th catalogue row)** | **Absent** | R4 ranked list (wrong shape) | — | Surface ID, intent router row, template/recipe, eval | §10 new row S9 / T3 / optional R6; `visual_intent.py` |
| **B.3.3 Disposition upgrade (one act)** | **Partial** | `DeepPassOutput` disposition-first; prompt §Reading what's really being asked | Not wired to `declared` uncertainty; routing bypasses deep_pass for many practitioner turns | Calibration evals; hinge to surface | `deep_pass_prompt.py`, `turn_classifier.py`, tests only (no new graph nodes) |

---

## 3. Situation-as-evidence — proposal (Gate 0, not a decision)

### Canonical vocabulary (per brief — do not drift)

| Layer | Name |
|-------|------|
| Evidence class | `declared` |
| Source type | `user_situation` |
| Trust material | `declared` (peer to owned / borrowed) |
| UI | “Stated by user” / “Declared situation” |

### Where it would live

```
User query
    ↓
wide_pass (existing)
    ↓
situation_elicit (NEW — wide_pass-adjacent, deterministic, NO LLM)
    ↓ parses utterance → DeclaredSituationRecord[]
EvidenceBag.declared  (NEW)
    ↓
reconcile_spec (extend — notes + AnswerSpec.declared_evidence[])
KeyedFigureIndex (optional text keys only, e.g. declared.has_uncertainty)
    ↓
deep_pass (hub — reads declared block in evidence section)
merge + gate (extend material rules for declared)
    ↓
Mouth trust rail (third swatch)
```

### Proposed minimal schema (sketch)

```python
# EvidenceBag extension
declared: list[DeclaredEvidenceItem]

class DeclaredEvidenceItem:
    id: str                    # declared-1, declared-2
    source_type: Literal["user_situation"]
    material: Literal["declared"]
    text: str                  # normalized clause from user utterance
    kind: Literal["fact", "domain", "constraint", "hypothesis", "uncertainty"]  # sub-type — see below
    span: str | None           # optional substring reference
```

```python
# AnswerSpec extension (mirror TS schema)
declared_evidence: list[DeclaredEvidenceItem]
```

**Reconcile:** append `ReconciliationNote` when `declared` non-empty (“User stated situation — declared material, not corpus-owned”). Set `meta["declared_count"]`. Do **not** promote to owned.

**Keyed figures:** Do **not** treat declared prose as numeric keyed figures. Optional boolean/text keys:

- `declared.uncertainty_present` (bool) — fires find-my-path hinge
- `declared.situation_summary` (text, material=`declared`) — for compose reflection block

**Gate behaviour (smallest safe change):**

- Allow `data-material="declared"` **without** `data-key` for user-sourced prose blocks (whitelist in `composition_gate.py`).
- If `data-key="declared.*"` present, key must exist in index with `material=declared`.
- **Do not** allow `data-material="owned"` on declared keys.
- Continue blocking orphan **currency/integers** in markup; declared situation lives in labelled prose regions, not fake stats.

**Evidence boundary alignment:** Brief §16 says hub cannot create evidence classes `wide_pass` did not produce. **`situation_elicit` inside wide_pass** makes `declared` a **pipeline product**, not hub invention. Blueprint §16 will need a **one-paragraph amendment** after Gate 1 (not a contradiction if elicit is deterministic pre-LLM).

### Sub-types: propose for Gate 1 ratification

| Option | Pros | Cons |
|--------|------|------|
| **A. Flat `declared` only (Gate 2 minimum)** | Smallest change; one trust material | Disposition hinge needs regex on `text` or separate `uncertainty_present` flag |
| **B. `kind` enum on each item (recommended in Gate 1)** | Matches brief example; uncertainty → disposition; hypothesis → web check narrative | Slightly more parse logic in `situation_elicit` |
| **C. Full separate evidence classes per kind** | Maximum precision | Violates “one concept” vocabulary — **reject** |

**Gate 0 recommendation:** **B with max 5 kinds** in parser; store as `kind` field, **single** trust material `declared`.

### Smallest change that makes this safe

1. Deterministic `situation_elicit(query) → list[DeclaredEvidenceItem]` (regex + clause split, no LLM).
2. Attach to `EvidenceBag` before reconcile; pass through to AnswerSpec.
3. Extend `Material` + gate + mouth trust rail for `declared` only.
4. **Do not** add declared items to corpus citations or tier boost logic.

---

## 4. Contradictions surfaced (stop-the-line items)

| # | Conflict | Detail |
|---|----------|--------|
| **C1** | **Brief calibration #3 vs `classify_turn()`** | User: *“I've got some rail idea, not sure what I'm asking”* — brief: thinking-partner, **no journey**. Code: `is_substantive_canvas_query()` matches `rail` → **overrides Haiku `chat` → substantive** → wide_pass orient (`turn_classifier.py` L174–184, `intent.py` L20–26). |
| **C2** | **Brief vs Haiku training example** | Haiku prompt lists same utterance as **`chat`** (`turn_classifier.py` L60) while heuristic override contradicts that example when domain tokens present. |
| **C3** | **Brief vs §16 evidence boundary (resolved by design)** | §16 lists only owned/borrowed; brief adds `declared`. **Not a blocker** if Gate 1 amends §16: declared comes from **wide_pass elicit**, not hub invention. |
| **C4** | **Practitioner job vs R4** | §16 catalogue row “Action Plan / Next Moves” → R4. Brief forbids compressing find-my-path into R4. **Catalogue will need row 9** and explicit “R4 ≠ find-my-path” note. |
| **C5** | **Chat-only path vs declared in trust rail** | Calibration #3 wants declared visible on canvas/trust rail; **`chat` route never updates AnswerSpec** (`run_turn.py` L265–280). Practitioner turn must use **hybrid or canvas_primary** with find-my-path surface, not pure chat-only. |

**Do not resolve silently.** Gate 1 must pick: practitioner uncertainty → **new route outcome** (e.g. `find_path`) vs **substantive + disposition-only** with lightweight canvas. Recommendation: **`outcome_hint=find_path` or `surface=find_path`** without new LangGraph node — set in `turn_classifier` + `wide_pass` assembler branch.

---

## 5. Risky migrations vs safe now

### Risky — defer or Gate 1 explicit plan

| Change | Risk |
|--------|------|
| Merge orchestrator into `/atlas` | Collapses two mental models; breaks eval baseline |
| Pure hub tool-loop for evidence | Violates product invariants |
| Promote `declared` → `owned` automatically | Breaks trust moat |
| New LangGraph nodes for disposition / premise / question-surfacing | Brief forbids; adds control-flow duplication |
| Sub-type as separate trust materials | Vocabulary drift |
| Large AnswerSpec rewrite | TS/Python schema drift |

### Safe now (doc + Gate 1 design only)

- This recon + Gate 1 architecture note
- Blueprint §16 amendment draft (declared + row 9)
- Eval case **specs** (four calibration turns) without implementation
- Routing table design fixing C1/C5

### Safe in Gate 2 increment 1 (after Gate 1)

- `situation_elicit.py` + `EvidenceBag.declared` + AnswerSpec field + reconcile notes
- Mouth trust rail third line
- Routing fix for uncertainty cue
- Prompt paragraph linking declared uncertainty → find-my-path compose
- Pytest for elicit parser + routing (no Sonnet required)

---

## 6. Minimum architecture improvement that unlocks practitioner surface

### Recommendation (Gate 0)

**Increment 0 — “Declared ledger + route fix” (smallest unlock)**

| Step | What | Deliberately leaves out |
|------|------|-------------------------|
| 1 | **`situation_elicit`** in `wide_pass` (deterministic) | Academic/user-file lanes |
| 2 | **`EvidenceBag.declared` + AnswerSpec.declared_evidence`** | Full sub-type grammar (can start with `uncertainty` + `fact` only) |
| 3 | **Reconcile note + meta** | Tier boost from declared |
| 4 | **Extend Material + gate + trust rail** | New recipe R6 |
| 5 | **Routing:** declared uncertainty → **find_path outcome** (or flag) → **compose-first surface** (T3 template or free_compose with required declared block) — **not R4**, not full orient | Line/pie charts (C2/C3) |
| 6 | **`deep_pass_prompt` disposition sentences** + optional declared block in evidence user message | New LangGraph nodes |
| 7 | **Four calibration tests** (pytest markers; optional live Sonnet job) | Full decision cockpit redesign |

**Why this order:** Without (1–4), trust rail cannot show declared. Without (5), calibration #3 still hits orient or chat-only dead end. Without (6–7), disposition cannot be proven.

**Analyst journeys:** Preserve existing demo queries via **unchanged orient/connect paths** when **no declared uncertainty cue** (calibration #4).

### What “find-my-path surface” likely reuses (Gate 1 preview — not decided)

| Slot | Likely reuse |
|------|----------------|
| Spine | `verdict` (reflect real question) + `soWhat.primaryAction` |
| Compose / template | **New T3** — declared situation panel + “question beneath your question” + 1–3 web/corpus **borrowed/owned** matches |
| Recipe | **None primary** — R4 only as fallback if compose fails **and** user explicitly asked for ranked opportunities |
| Chart | None |
| Chat rail | Short thinking-partner complement |

---

## 7. Validation baseline (unchanged for Gate 0)

Existing checks must still pass after Gate 2 work:

```bash
npm run eval:genui
python -m pytest agents/test_atlas_v5_abc_features.py -q
```

Demo journeys (§15) must remain covered. **New:** four calibration turns in brief — **spec only at Gate 0**.

---

## 8. Gate 0 exit checklist

- [x] Honest diagnosis of A
- [x] A→B delta table
- [x] `declared` proposal (not decision)
- [x] Risks + safe-now list
- [x] Minimum unlock recommendation
- [x] Contradictions reported (C1–C5)
- [ ] **Gate 1 architecture decision** — **blocked until approval**

---

**Next step:** Review this document. On approval, proceed to **Gate 1** (`ARCHITECTURE_DECISION.md` or §17 in blueprint) covering schema, find-my-path AnswerSpec shape, disposition prompt diff plan, sub-type ratification, and C1/C5 routing resolution.

*Generated: Gate 0 recon — practitioner path / declared evidence sprint.*
