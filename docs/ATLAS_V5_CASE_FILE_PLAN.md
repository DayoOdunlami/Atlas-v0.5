# Atlas v5 — Case File programme (implementation, test, eval)

> **Status:** Approved direction — June 2026  
> **Canonical surface:** `/atlas` only (`atlas_v5` graph)  
> **Supersedes for product sequencing:** matcher-first North Star as *primary UX*; matcher becomes a **Diagnose mode** on top of Case File (Phase 3).  
> **Companion:** [ATLAS_V5_BLUEPRINT.md §18](./ATLAS_V5_BLUEPRINT.md#18-product-direction--case-file-centre-june-2026)

---

## 1. What we are building

**One sentence:** Atlas is an evidence-controlled analyst workstation where the user maintains a **Case File** (structured declared claims) and runs **Sessions** (chat + canvas turns) against corpus/web evidence.

```
Case File (durable)     Session (conversation)        Evidence (system)
─────────────────       ──────────────────────        ─────────────────
User-owned claims   →   threads / turns           →   corpus + web lanes
Upload / chat extract   AnswerSpec per turn           keyed figures + gate
Optional entity         Resume + history rail         tiers + citations
```

**Not building in this programme:** workbench as primary surface, passport marketplace UI, Requirement Spec corpus library, voice, canvas motion toys.

---

## 2. What already exists (do not rebuild)

| Asset | Location | Reuse |
|-------|----------|-------|
| Case file brain | `agents/atlas_v5/case_file.py` | Load/save/merge declared claims |
| Deep pass write-back | `deep_synthesis.py`, `deep_pass_models.py` | `case_claims` extraction |
| Wide pass load | `wide_pass.py` | Injects session claims into skeleton |
| Trust rail mirror | `reconcile_spec.py`, `to_answer_spec_claims` | AnswerSpec `claims[]` |
| Find-path surface | `find_path_assembler.py`, `turn_classifier.py` | Uncertainty → structured canvas |
| DB spine | `atlas.claims` (`entity_type=user_situation`) | Persist when `ATLAS_V5_CASEFILE_PERSIST=1` |
| Unit tests | `agents/test_case_file.py` | Merge, bootstrap, gate on declared |
| Calibration eval | `agents/atlas_v5/calibration_eval.py` | Multi-turn case file scenarios |
| Session persist | `atlas.threads` / `atlas.turns` | Separate from case file |
| Doc upload extract | `src/lib/passport/claim-extractor.ts` | **Port patterns**, not `/passport` route |
| Matcher (legacy) | `agents/matcher/*` | Phase 3 only — call from `atlas_v5`, not workbench UI |
| Architecture decisions | `docs/ARCHITECTURE_DECISION.md` | Increment 0/1 rules locked |

---

## 3. Phased delivery

### Phase 0 — Foundation (1 week) — **ship gate** ✅ *mouth shipped Jun 2026*

**Goal:** Case File visible and trustworthy on `/atlas`; brain ↔ mouth connected.

| # | Deliverable | Files / notes | Status |
|---|-------------|---------------|--------|
| 0.1 | **Case File panel** in session rail or canvas sidebar | `case-file-panel.tsx`, wire to co-agent / API | ✅ |
| 0.2 | **Read path** — show claims from `AnswerSpec.claims` + `load_case_file(thread_id)` | `atlas-client-shell.tsx`, `GET /api/atlas/case-file/[threadId]` | ✅ |
| 0.3 | **User edit** — confirm / reject / edit text / kind | PATCH claim row; re-save via case_file merge | ✅ (needs `ATLAS_V5_CASEFILE_PERSIST=1`) |
| 0.4 | **Declared block on canvas** | Surface `declared-situation` markup or React equivalent above spine | ✅ |
| 0.5 | Enable persist in dev | `ATLAS_V5_CASEFILE_PERSIST=1`, migration for `atlas.claims` verified | ⚙️ opt-in |
| 0.6 | Trust copy | Every declared claim: “Stated by user · max Indicative” | ✅ |
| 0.7 | **SWOT on stated claims** | Panel button + `is_case_file_swot_query()` | ✅ |

**Exit criteria:**
- [ ] Turn 1 user constraint → appears in panel + canvas within same session  
- [ ] Turn 2 follow-up references prior declared claim (calibration eval green)  
- [ ] Analyst query (“state of rail decarb”) does **not** manufacture declared claims (`test_case_file`)  
- [ ] Playwright: panel visible, at least one claim after scripted multi-turn  

---

### Phase 1 — Entity promotion (1–1.5 weeks) — **foundations shipped Jun 2026**

**Goal:** Case File survives beyond one thread — “client record” not “chat log”.

| # | Deliverable | Notes | Status |
|---|-------------|-------|--------|
| 1.1 | **`atlas.case_entities`** (or extend `passports` with `kind=case_file`) | `id`, `owner_id`, `title`, `created_at`, `updated_at` | ✅ migration |
| 1.2 | **`entity_id` on threads** | `atlas.threads.case_entity_id` nullable FK | ✅ |
| 1.3 | **Promote flow** | “Save as Case Entity” from session → copy claims to `entity_id` | ✅ |
| 1.4 | **Attach flow** | New session → pick existing entity → load claims into wide pass | ✅ |
| 1.5 | **Rail list** | Entities section below Sessions (collapsed by default) | ✅ |

**Claim addressing rule:** Session-scoped claims use `entity_id=thread_id` until promoted; entity uses `entity_type=case_entity`, `entity_id=<uuid>`.

**Exit criteria:**
- [ ] Create entity from session → new session attached → same claims visible  
- [ ] Entity claims update on turn write-back without duplicating session rows  
- [ ] Delete entity soft-archives; sessions remain but show “detached”  

---

### Phase 2 — Ingest (1.5–2 weeks)

**Goal:** Upload / paste → structured claims (passport extract patterns, atlas surface).

| # | Deliverable | Reuse from `/passport` |
|---|-------------|------------------------|
| 2.1 | Upload PDF/DOCX to entity or session | Storage path pattern from `passport/upload` |
| 2.2 | Extract claims API | Adapt `claim-extractor.ts` → map to `CaseClaim` kinds |
| 2.3 | **Confidence ceiling** | AI never `verified`; user confirm promotes to `self_reported` |
| 2.4 | Provenance row per claim | `source_document_id`, excerpt |
| 2.5 | Review queue UI | Accept / reject / edit before merge to case file |

**Do not:** route through JARVIS chat or `/passport` pages.

**Exit criteria:**
- [ ] Upload 2-page PDF → ≥3 claims extracted → user confirms 2 → appear in case file  
- [ ] Extracted claim never `verified` tier without HITL  
- [ ] Corpus search can cite entity context in dev overlay (optional stretch)  

---

### Phase 3 — Diagnose hook (2 weeks, optional for first CPC demo)

**Goal:** “Compare my case file to this opportunity” without workbench UI.

| # | Deliverable | Notes |
|---|-------------|-------|
| 3.1 | `diagnose_turn` node or outcome in `atlas_v5` | Calls `matcher.run_matcher` internally |
| 3.2 | Requirement Spec extract on demand | `requirement_spec.extract_requirement_spec(text)` |
| 3.3 | AnswerSpec recipe | `EvidenceGapMatrix` + match summary in compose |
| 3.4 | Trigger phrases | “compare to Innovate UK call”, “fit for this funding” |

**Exit criteria:**
- [ ] One golden Diagnose query returns fit/gap rows traceable to Spec fields  
- [ ] Declared claims appear in gap narrative as `declared` lane  
- [ ] No workbench URL required  

---

### Phase 4 — Retire legacy surfaces (ongoing, parallel)

| Surface | Action |
|---------|--------|
| `/workbench` | Read-only archive; banner “legacy — use /atlas” |
| `/passport` | Redirect or banner; keep APIs for extract until Phase 2 absorbed |
| Orchestrator default | Keep env off; no new features |
| Brief v2 | No touch |

Extract **code modules** before retiring routes: `claim-extractor`, `matcher`, `cpc_passport/loader` (read-only CPC reference passport).

---

## 4. Test strategy

### 4.1 Python unit (existing + extend)

| Suite | File | Covers |
|-------|------|--------|
| Case file CRUD | `test_case_file.py` | merge, bootstrap, gate, analyst-no-declared |
| Calibration | `test_calibration_eval.py` | multi-turn declared reference |
| Find path | `test_find_path.py` | uncertainty routing |
| **New:** entity promotion | `test_case_entity.py` | copy claims thread→entity, attach |
| **New:** extract map | `test_claim_extract_map.py` | passport schema → CaseClaim kinds |

Run: `pytest agents/test_case_file.py agents/test_calibration_eval.py -q`

### 4.2 TypeScript / Vitest

| Suite | Covers |
|-------|--------|
| `eval/atlas-v5-threads.test.ts` | Session persist (existing) |
| **New:** `eval/atlas-case-file-panel.test.ts` | Panel render from mock AnswerSpec claims |
| **New:** `eval/case-file-api.test.ts` | API route auth + merge |

### 4.3 Playwright (E2E)

| Spec | Scenario |
|------|----------|
| `eval/atlas-v5-case-file.spec.ts` | Multi-turn: declare constraint → panel shows → reload persists |
| `eval/atlas-v5-session-threads.spec.ts` | Session rail (existing) |
| **Stretch:** upload confirm flow | Phase 2 |

Config: `eval/playwright.atlas-v5.config.ts`

### 4.4 Trajectory / brain eval

Extend `eval/atlas_v5_trajectories.yaml`:

```yaml
- id: CF01_declared_persists
  turns:
    - "We're an SME with no trial partner — what's the rail decarb landscape?"
    - "Given that constraint, where is funding thinnest?"
  assert:
    - case_file_count >= 1 after turn 1
    - followup_references_declared: true
    - no_manufactured_declared_on: "state of rail decarbonisation"
```

Run: existing `eval/run_atlas_v5_trajectories.py` (requires agent + corpus).

---

## 5. Stress tests & go/no-go (is this the right approach?)

Run **before Phase 1 entity work** and **after Phase 0 UI**. These validate the strategy, not just the code.

### Test A — Declared vs analyst separation (must pass)

**Question:** Does Case File avoid polluting analyst landscape queries?

- **Method:** `test_case_file.test_analyst_landscape_query_no_manufactured_declared` + 10-query battery in calibration eval  
- **Pass:** Zero declared claims on pure analyst queries; declared only when user states situation  
- **Fail action:** Do not build entity promotion — fix extraction prompts first  

### Test B — User value vs Claude Projects (qualitative, n=3)

**Question:** Is structured Case File better than “paste context in project instructions”?

| Criterion | Case File wins if… |
|-----------|-------------------|
| Persistence | Claims survive reload; editable without re-prompting |
| Trust | Declared vs corpus visually distinct; tier capped |
| Reuse | Attach same entity to new session in <30s |
| Defensibility | Export shows claim kind + source |

**Method:** 30-min sessions with one CPC analyst + one external SME; think-aloud.  
**Pass:** ≥2/3 prefer Case File over chat-only for multi-session strategic work.

### Test C — Matcher-on-demand (Phase 3 gate)

**Question:** Is embedded matcher worth it vs AnswerSpec-only Diagnose?

- **Method:** Same 3 funding-call queries — workbench matcher output vs atlas_v5 canvas-only  
- **Pass:** Structured matcher improves gap **actionability** (essential vs desirable labels) without adding >15s latency  
- **Fail action:** Keep Diagnose as compose-only; defer matcher import  

### Test D — CPC Innovation Passport alignment (stakeholder, not automated)

**Question:** Does Data & Digital see this as operational passport tooling?

- **Method:** 15-min narrative: Case File = portable claim record; corpus = validation layer  
- **Pass:** Stakeholder maps it to “trust infrastructure enabler”, not “duplicate programme”  

### Go / no-go summary

| Result | Decision |
|--------|----------|
| A fail | Fix brain before UI |
| B fail | Narrow to CPC-internal analyst only; drop SME passport story |
| C fail | Skip Phase 3; ship Phases 0–2 only |
| A+B pass | **Proceed** with entity + ingest |
| All pass | Full programme including Diagnose hook |

---

## 6. Patterns to copy (build the right thing)

| Pattern | Source | Apply to Case File |
|---------|--------|-------------------|
| **Structured client record** | Financial adviser CRM, legal matter file | Entity title, claims list, session history separate |
| **Confidence ceiling** | `claim-extractor.ts` | AI extract → `ai_inferred`; user confirm → `self_reported`; HITL → `verified` |
| **Projects not memory blob** | Claude Projects | Entity attachment, not 100k token paste |
| **Declared third lane** | `TRUST_MODEL_V2.md` | Gold styling, max Indicative tier |
| **Increment 0 advisor loop** | `ARCHITECTURE_DECISION.md` | Model refines claims; user confirms in UI |
| **Calibration personas** | `calibration_eval.py` | SME uncertainty, analyst landscape, constraint follow-up |
| **Save dialog UX** | `save-to-passport-dialog.tsx` | Promote-to-entity modal |
| **Session ≠ object** | `ATLAS_V5_SESSION_PERSISTENCE_PLAN.md` | threads/turns for chat; claims for durable record |

**Anti-patterns (do not copy):**

- Workbench block grammar as primary canvas (too heavy for `/atlas`)  
- Passport type enum proliferation before Case File works  
- Regex situation elicit (withdrawn in Gate 1)  
- Treating chat transcript as the case file  

---

## 7. Blueprint & North Star updates

| Doc | Change |
|-----|--------|
| `ATLAS_V5_BLUEPRINT.md` | **§18** added — Case File centre, `/atlas` only |
| `ATLAS5_NORTH_STAR.md` | Add pointer: operational sequencing in blueprint §18; spine still valid |
| `ATLAS_V5_SESSION_PERSISTENCE_PLAN.md` | Cross-link case entity FK |
| `ARCHITECTURE_DECISION.md` | Mark Inc 0 UI as in progress |

**North Star elements retained:** claim states, fit/gap/risk vocabulary, defensibility, structure-in-objects.  
**North Star elements reframed:** Passport → Case Entity; Matcher → Diagnose mode; 3s SLA → progressive spine.

---

## 8. Environment & flags

```bash
# Session persist (existing)
POSTGRES_URL=...
# ATLAS_V5_THREADS_DEV_OPEN=0  # optional disable

# Case file DB persist
ATLAS_V5_CASEFILE_PERSIST=1

# Phase 3 only
# ATLAS_V5_DIAGNOSE_MATCHER=1
```

---

## 9. Suggested build order (4–6 weeks)

```
Week 1   Phase 0 — panel + canvas declared block + eval A
Week 2   Phase 0 polish + Phase 1 entity schema + promote
Week 3   Phase 1 attach + Playwright + eval B (user sessions)
Week 4   Phase 2 upload extract (MVP)
Week 5   Phase 2 review UI + Phase 3 spike (matcher import)
Week 6   Stress test C/D + blueprint review + legacy banners
```

---

## 10. Open decisions (resolve in Week 1)

| # | Question | Recommendation |
|---|----------|----------------|
| D1 | New table `case_entities` vs reuse `atlas.passports`? | **New `case_entities`** — simpler; migrate to passport type later if CPC requires |
| D2 | Panel in rail vs canvas column? | **Rail subsection** when expanded; canvas declared block for read-only prominence |
| D3 | Max claims per entity? | **12 active** (matches `merge_case_claims` cap) |
| D4 | Who can verify claims? | Phase 2: owner only; Phase 4: admin HITL |

---

*Owner: Dayo. Review after Phase 0 exit criteria met.*
