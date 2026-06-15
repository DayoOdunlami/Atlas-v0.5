# ATLAS5_IMPLEMENTATION_PLAN.md — Sequenced Build (Stage 1.5)

> **Status:** Proposed (awaiting Dayo approval).
> **Date:** 2026-06-15.
> **Authority:** Sequenced engineering work that realises `ATLAS5_BRAIN_ADR.md` while serving the outcomes in `ATLAS5_NORTH_STAR.md`. Stack and rules in `CLAUDE.md` remain binding.
> **Supersedes:** the parts of the previous "D0.6 plan" that assumed the workbench hard-router. Substrate deliverables (eval scaffold, Supabase wiring, MCP tools, env/deploy) carry over unchanged.

---

## 0. North-star for this plan

> **Build the one brain, prove it on Diagnose / Value Translation end-to-end, then expand.**

Tactical principles (carried from the ADR):

1. **Substrate kept; control flow rebuilt.** Supabase, MCP tools, skills, the 13 React blocks, eval harness, trust spine (`citation_guard` / `falsification` / `artifact_qa`), and the viz registry stay. The hard router and block-input cage go.
2. **New paradigm ships behind a feature flag.** Old workbench graph stays live during transition. No big-bang breakage.
3. **Instrument from day one.** The capability-gap report is built alongside the skeleton, not after.
4. **One vertical proven > breadth of half-built features.** Value Translation (Diagnose) is the canonical first slice (per North Star Phase 1).
5. **Each deliverable owns its tests** (`CLAUDE.md` rule 8). Eval is outcome-based, not path-based.

---

## 1. Module layout (target)

```
agents/
├── orchestrator/                  ← NEW: the brain
│   ├── graph.py                   ← triage → gate → orchestrator → verify → format → END
│   ├── triage.py                  ← cheap effort/ambiguity/external classifier
│   ├── gate.py                    ← HITL confirm for deep/external
│   ├── tools.py                   ← @tool wrappers (corpus_search, matcher, exa, econ, graph)
│   ├── format_pass.py             ← AtlasRenderModel → block layout selection
│   └── subagents/
│       └── cicerone.py            ← parallel cross-sector breadth subagent
├── spine/                         ← NEW: shared trust spine (promoted)
│   ├── verify.py                  ← orchestrates citation_guard + falsification + artifact_qa
│   ├── citation_guard.py          ← MOVED from agents/atlas/
│   ├── falsification.py           ← MOVED from agents/atlas/
│   ├── artifact_qa.py             ← MOVED from agents/atlas/
│   └── confidence.py              ← computed-tier function (lift _cap_tier, expose to all)
├── registry/                      ← NEW: render + viz registry (promoted)
│   ├── blocks.py                  ← 13-block declarative specs (purpose/data-shape/when-to-use)
│   ├── viz.py                     ← curated chart selectors (from visual_recipe_director)
│   ├── viz_guardrail.py           ← encoding guardrail for generative ECharts/MCP
│   └── render_model.py            ← buildAtlasRenderModel(match_id, canonical_question_id)
├── instrumentation/               ← NEW: self-revealing gaps
│   ├── signals.py                 ← gap-signal emitters (tier, dropped citations, fallbacks, …)
│   └── gap_report.py              ← aggregates signals into a capability-gap report
├── matcher/                       ← NEW (Phase 3): Fit/Gap/Risk/Move
│   ├── requirement_spec.py        ← Spec extraction from corpus/calls
│   ├── matcher.py                 ← Passport × Spec → fit/gap/risk/move
│   └── value_translation.py       ← travels-as-is | needs-reframing | not-credible-here | evidence-needed
├── workbench/                     ← ARCHIVED (kept live behind feature flag until cutover)
│   └── graph.py                   ← old hard-router brain — DO NOT EXTEND
├── atlas/                         ← lens-only after promotion (legacy thin)
├── jarvis/                        ← lens-only after promotion (legacy thin)
├── hyve/                          ← lens-only after promotion (legacy thin)
└── cicerone/                      ← subagent, called from orchestrator.subagents
```

Frontend changes are surgical — the 13 blocks stay where they are; the new pieces are:

```
src/
├── app/workbench/
│   └── page.tsx                   ← unchanged URL; render mode selected by feature flag + format pass
├── app/lab/orchestrator/          ← NEW: dev split-view (blocks ‖ document)
├── components/workbench/
│   ├── blocks/**                  ← unchanged pixels; new declarative wrappers
│   ├── research-document.tsx      ← NEW: prose+sidecar renderer (Research mode)
│   └── workbench-runtime-provider.tsx  ← rewire to orchestrator graph when flag on
└── lib/atlas/
    └── orchestrator-client.ts     ← NEW: CopilotKit useCoAgent binding for AtlasRenderModel
```

---

## 2. Build phases

```
Phase 0 — Foundation (parallel-safe; no behaviour change)
  ↓
Phase 1 — Skeleton (the brain works end-to-end on a stub vertical, behind flag)
  ↓
Phase 2 — Instrument (gap-signals + capability-gap report + split-view)
  ↓
Phase 3 — Prove the vertical (Diagnose / Value Translation, end-to-end)
  ⚑ GATE — Dayo product review: does it reveal a non-obvious gap/route/risk?
  ↓
Phase 4 — Expand (Orient, Connect, Act, Defend lit up; cutover from old graph)
  ↓
Phase 5 — Harden (latency budget, encoding guardrail in CI, render-parity gate)
  ⚑ GATE — Tier 3 product review (30-min walk-through with Dayo)
```

Phases 1–3 are the critical path. Phase 4 is breadth. Phase 5 is hardening.

---

## 3. Deliverables (with acceptance + tests)

Each deliverable has: **What** · **Where** · **Acceptance** · **Tests** · **Owner-note**.

### Phase 0 — Foundation

**D0.1 — Module skeleton + feature flag**
- **What:** create empty `agents/orchestrator/`, `agents/spine/`, `agents/registry/`, `agents/instrumentation/` with `__init__.py` and module docstrings. Add `ATLAS5_ORCHESTRATOR_V1` env flag (default OFF).
- **Where:** new dirs as above; flag read in `agents/server.py` and `src/components/workbench/workbench-runtime-provider.tsx`.
- **Acceptance:** repo compiles; `langgraph dev` still serves old workbench; flag off = no behaviour change.
- **Tests:** smoke `test_orchestrator_flag_off_uses_legacy.py` (1 case).
- **Note:** zero risk; pure scaffolding.

**D0.2 — Archive old graph reference**
- **What:** branch tag `legacy/workbench-router-2026-06-15` from current HEAD; add header comment to `agents/workbench/graph.py` warning "DO NOT EXTEND — superseded by `agents/orchestrator/` per ADR-0001."
- **Where:** git tag + 6-line header in `agents/workbench/graph.py`.
- **Acceptance:** tag exists and is reachable; header present.
- **Tests:** none.

**D0.3 — Promote `citation_guard` / `falsification` / `artifact_qa` to `agents/spine/`**
- **What:** *move* (not copy) the three files; update all imports in `agents/atlas/*.py` and any `eval/test_*.py` to the new paths; lift `_cap_tier` from `citation_guard` into `agents/spine/confidence.py` so all callers share one tier-computation function.
- **Where:** `agents/spine/` per §1.
- **Acceptance:** all existing tests (`test_citation_guard.py`, `test_falsification.py`, `test_artifact_qa.py`) pass at new paths. `agents/atlas/*` still works (now via `from agents.spine import …`).
- **Tests:** existing suite, no new tests.
- **Note:** pure refactor; lands in its own commit for clean revert.

**D0.4 — Promote viz registry + dormant art director**
- **What:** move `agents/visual_recipe_director.py` to `agents/registry/viz.py`; expose `build_visual_blocks` and `build_chart_specs` as the canonical viz API. Lift the dormant `select_visual_recipe` to live behind a flag (`ATLAS5_VIZ_ART_DIRECTOR_V1`, default OFF).
- **Where:** `agents/registry/viz.py`.
- **Acceptance:** existing recipe paths still produce the same visuals; flag off = behaviour identical to today; flag on = art director chooses.
- **Tests:** existing `test_recipe_routing.py` + a small `test_art_director_selection.py` (3 fixture queries) for the new path.

**D0.5 — Declarative block registry (specs, not pixels)**
- **What:** create `agents/registry/blocks.py` enumerating the 13 blocks as declarative specs:
  ```python
  Block(id="ClaimLedger", purpose="audit-style claims with evidence state",
        data_shape={"claims": [...]}, when_to_use="any artifact making >=3 cited claims",
        skill_refs=["evidence-triage"])
  ```
  No code is moved; no React touched. This is the "described capability" the format pass selects from.
- **Where:** `agents/registry/blocks.py` + `agents/registry/__init__.py`.
- **Acceptance:** registry enumerates all 13 blocks + the 6-block spine flagged; `pytest tests/registry/test_blocks_complete.py` confirms 13 entries with non-empty `purpose`, `data_shape`, `when_to_use`.
- **Tests:** `test_blocks_complete.py` + `test_six_block_spine_present.py`.

**D0.6 — `buildAtlasRenderModel(match_id, canonical_question_id)` keystone**
- **What:** the canonical render-model builder (State of Play §3 / §9). Reads Supabase → returns normalised `AtlasRenderModel` JSON: `{blocks, claims, evidence_states, provenance, computed_confidence_tier, canonical_question_id, layout_hierarchy: ["L1","L2","L3","L4","L5"]}`. Pure function; no LLM call.
- **Where:** `agents/registry/render_model.py` (Python). TS mirror later (Phase 4 if needed).
- **Acceptance:** given a real `match_id` + `cq.translate.transfer`, returns a populated `AtlasRenderModel` whose claims/citations all resolve to live Supabase rows.
- **Tests:** `test_render_model_builder.py` against 2 known fixture matches; verifies (a) no fabricated IDs, (b) computed tier matches `confidence.compute(evidence_states)`, (c) `canonical_question_ids` field populated.
- **Note:** this is the keystone; the new brain reads/writes through this object.

### Phase 1 — Skeleton (the brain end-to-end, behind flag, on stub vertical)

**D1.1 — Triage + gate**
- **What:** cheap classifier deciding `{lane: clarify | refine | analyze | deep, needs_external: bool, ambiguous: bool}`. Replaces `classify_route`. Adds a `gate` node that returns an AG-UI interrupt when `lane=deep OR needs_external=true`. Maps to canonical clarify/refine/analyze lanes.
- **Where:** `agents/orchestrator/triage.py` + `agents/orchestrator/gate.py`.
- **Acceptance:** 12 fixture queries route correctly (3 per lane). Deep queries emit interrupt; non-deep flow through.
- **Tests:** `test_triage_routing.py` (12 cases), `test_gate_interrupt.py` (3 deep, 3 non-deep).

**D1.2 — Orchestrator tool-calling loop**
- **What:** LangGraph `create_react_agent`-style tool-calling loop with bounded tool set (`corpus_search`, `exa_search`, `econ_analyse`, `graph_query`, `passport_load`). Plans, calls tools (possibly several in one pass — solves compound queries), returns a synthesis draft. No verification yet (that's D1.3).
- **Where:** `agents/orchestrator/graph.py` + `agents/orchestrator/tools.py`.
- **Acceptance:** compound query "explain X and find adjacent projects" results in ≥2 tool calls (`corpus_search` + e.g. `exa_search`) in a single run.
- **Tests:** `test_orchestrator_compound_query.py` (asserts ≥2 tool calls); `test_orchestrator_simple_query.py` (asserts single tool call when sufficient).

**D1.3 — Shared verify spine wiring**
- **What:** `agents/spine/verify.py` runs `citation_guard` (compute tier), `falsification` (red-team — always on for `lane=deep`, off otherwise), `artifact_qa`. Inputs the synthesis draft; outputs a verified payload with computed tier + dropped/flagged claims.
- **Where:** `agents/spine/verify.py`; wired as a node after the orchestrator loop in `agents/orchestrator/graph.py`.
- **Acceptance:** unsupported claims dropped or flagged; computed tier matches evidence states; falsification findings attached when run.
- **Tests:** `test_verify_drops_unsupported.py`, `test_verify_computes_tier.py`, `test_verify_runs_falsification_only_on_deep.py`.

**D1.4 — Format pass + render registry selection**
- **What:** `agents/orchestrator/format_pass.py` takes the verified payload + the `AtlasRenderModel` and chooses the block layout (which of the 13 blocks, in what order, per the L1..L5 hierarchy). Selection uses the declarative block registry (D0.5). Includes a `presentation_mode` toggle (`blocks | document`).
- **Where:** `agents/orchestrator/format_pass.py`.
- **Acceptance:** the same verified payload renders to a different but consistent layout in each mode; the 6-block universal spine is present in both for a Diagnose-class query.
- **Tests:** `test_format_pass_layout_hierarchy.py`, `test_presentation_modes_consistent_evidence.py`.

**D1.5 — CopilotKit + AG-UI rewire (frontend)**
- **What:** when `ATLAS5_ORCHESTRATOR_V1` is on, `src/components/workbench/workbench-runtime-provider.tsx` binds `useCoAgent` to the orchestrator graph and the synced state is the `AtlasRenderModel`. Existing 13 React blocks unchanged. Add `src/components/workbench/research-document.tsx` (prose + sidecar) for `presentation_mode=document`.
- **Where:** `src/components/workbench/workbench-runtime-provider.tsx` + `src/lib/atlas/orchestrator-client.ts` (new) + `src/components/workbench/research-document.tsx` (new).
- **Acceptance:** Workbench page renders the same blocks against the new render model; toggling mode swaps to the document renderer with identical evidence.
- **Tests:** Playwright `workbench-orchestrator.spec.ts` (3 scenarios: blocks render, mode toggle, citations clickable in both).

**D1.6 — Stub vertical end-to-end behind flag**
- **What:** wire a single fixture query (e.g. "summarise this match") through triage → orchestrator → verify → format. No matcher yet; proves the pipeline.
- **Where:** `eval/orchestrator_e2e.spec.ts` (Playwright) and `agents/orchestrator/test_e2e_stub.py`.
- **Acceptance:** flag on → fixture query returns a verified `AtlasRenderModel` rendered in Workbench mode; same query in document mode shows the same facts.
- **Tests:** the e2e spec above; passes in CI.
- **⚑ Phase-1 gate:** skeleton e2e green before Phase 2.

### Phase 2 — Instrument (gap-signals + capability-gap report + split-view)

**D2.1 — Gap-signal emitters**
- **What:** every node emits structured signals to `agents/instrumentation/signals.py`:
  - `tier_low` (computed tier ≤ Indicative)
  - `citations_dropped` (count, reasons)
  - `falsification_finding`
  - `qa_issue`
  - `prose_fallback` (format pass found no block fit → **render gap**)
  - `encoding_guardrail_hit` (Phase 5 hook, stubbed now)
  - `intent_miss` (user corrected the triage playback)
  - `tool_timeout` / `tool_error`
- **Where:** `agents/instrumentation/signals.py`; emit calls added at each node.
- **Acceptance:** running the Phase-1 stub vertical produces ≥1 signal entry per run; signals persist (JSONL log).
- **Tests:** `test_signals_emitted_on_stub_run.py`.

**D2.2 — Capability-gap report**
- **What:** aggregator that reads the signals log and produces a daily/per-run report keyed by `canonical_question_id`: which CQs get low tier, which fall to prose, which intents get corrected, which tools fail. Renderable as a Workbench block (`CapabilityGapReport` — uses existing block primitives, no new component).
- **Where:** `agents/instrumentation/gap_report.py` + `src/app/lab/capability-gaps/page.tsx`.
- **Acceptance:** report renders; clicking a row shows the underlying signal entries.
- **Tests:** `test_gap_report_aggregation.py`.

**D2.3 — Dev split-view (blocks ‖ document, one brain run)**
- **What:** `src/app/lab/orchestrator/page.tsx` — runs the brain once, renders the same `AtlasRenderModel` both as Workbench blocks and as Research document, side by side. This is the architectural proof artifact (per ADR §8).
- **Where:** `src/app/lab/orchestrator/page.tsx` (new).
- **Acceptance:** split-view loads; both panes show the same headline, citations, computed tier; toggling a citation highlights it in both.
- **Tests:** Playwright `split-view-parity.spec.ts`.
- **⚑ Phase-2 gate:** instrumentation emits signals and the split-view proves render-parity before Phase 3.

### Phase 3 — Prove the Value-Translation vertical (Diagnose, end-to-end)

This is **the** product proof per North Star Phase 1. Each deliverable here is critical-path.

**D3.1 — Passport schema + extraction (verify/extend existing)**
- **What:** confirm the Passport schema in Supabase covers the canonical fields (identity, owner, claims, evidence, maturity, constraints, provenance, claim states). Verify `agents/passport_loader.py` exposes them to the orchestrator as `passport_load(passport_id)`. Add missing fields as a Supabase migration if any.
- **Where:** `agents/passport_loader.py`, possibly `migrations/0XX_passport_claim_states.sql`.
- **Acceptance:** loading Sameer's pilot Passport returns all required fields with claim states populated.
- **Tests:** `test_passport_loader_claim_states.py`.

**D3.2 — Requirement Spec extraction (NEW — Phase 1 critical path)**
- **What:** `agents/matcher/requirement_spec.py` extracts a Requirement Spec from a funding call / sector challenge (need, eligibility, desired outcomes, evidence demands, constraints, deadlines, value criteria, entry-friction tags, provenance, claim states). **First run the canonical proof gate:** compare model-only matching vs structured-Spec matching on 3–5 real fixtures (per North Star Open Decision #2). Only proceed with full schema if structured wins on auditability/repeatability/gap-quality.
- **Where:** `agents/matcher/requirement_spec.py`; proof-gate fixtures in `eval/fixtures/requirement_spec/`.
- **Acceptance:** proof gate documented in `eval/requirement_spec_proof_gate.md` with a clear win/lose call; if win, Spec extraction extracts all required fields with claim states + provenance.
- **Tests:** `test_requirement_spec_extraction.py` (3 fixtures); proof-gate report committed.
- **⚑ Mid-Phase-3 gate:** if proof gate fails, escalate to Dayo before continuing D3.3.

**D3.3 — Matcher: Fit / Gap / Risk / Move**
- **What:** `agents/matcher/matcher.py` — `Passport × Requirement Spec → {fit, gap, risk, move}`. Three risk types kept separate (evidence / fit / entry — never collapsed). Dimensions are the spine of truth; embedding distance is used only as a falsification cross-check (canonical discipline). Exposed as the `matcher` tool to the orchestrator.
- **Where:** `agents/matcher/matcher.py`.
- **Acceptance:** running matcher on (Sameer Passport × top-5 corpus calls) produces structured outputs with the three risk types separate; embedding-distance is logged but does not rank.
- **Tests:** `test_matcher_three_risks_separate.py`, `test_matcher_dimensions_rank_not_embeddings.py`.

**D3.4 — Value translation layer**
- **What:** `agents/matcher/value_translation.py` — for each Passport claim under a target Spec, label `travels-as-is | needs-reframing | not-credible-here | evidence-needed` with rationale. Surfaces *"what would make the value believable here"* (per North Star Diagnose definition — not gap-detection, value translation).
- **Where:** `agents/matcher/value_translation.py`.
- **Acceptance:** at least one claim in the Sameer pilot is labelled `needs-reframing` with a non-trivial rationale that a human reviewer agrees with.
- **Tests:** `test_value_translation_labels.py` + a manual review fixture in `eval/fixtures/value_translation/sameer_review.md`.

**D3.5 — Evidence Gap & Value Translation Report (the artifact)**
- **What:** format pass selects the canonical block composition for `cq.translate.transfer`: ContextCard + ClaimLedger + TransferLanes + DimensionGap + RecommendationConfidence + ActionPlan (with ObjectionResponse where defended). Includes the seven Defend operationalised elements (evidence trail / assumptions / confidence tiers / alternative interpretations / likely objections / what would change conclusion / next action).
- **Where:** `agents/orchestrator/format_pass.py` (recipe for the CQ), no new React.
- **Acceptance:** report renders for the Sameer pilot Passport × top corpus matches; passes all eight Defend-required fields.
- **Tests:** `test_evtl_report_completeness.py` (asserts all Defend fields present); Playwright `evtl-report-renders.spec.ts`.

**D3.6 — Sameer-style validation harness**
- **What:** convert the North Star validation questions into an eval fixture (`eval/sameer_validation.md`): "would the user pay?", "what would they stop doing?", "next move based on this report?". Used for the Phase-3 gate review.
- **Where:** `eval/sameer_validation.md` + `eval/test_evtl_outcome.py` (a checklist test, not pass/fail without human input).
- **Acceptance:** harness exists, review prompts ready.
- **Tests:** the checklist file.
- **⚑ Phase-3 gate (Dayo product review):** does the report reveal a non-obvious gap, route, or risk on the Sameer pilot? **Stop and reassess if no.**

### Phase 4 — Expand (Orient, Connect, Act, Defend; cutover)

Phases 4 deliverables are smaller because the skeleton + vertical already proved the pattern. Each one is mostly *a new CQ recipe in `format_pass` + a small set of tool / block additions where the registry has a gap (revealed by D2.2)*.

**D4.1 — Orient mode (landscape)**
- **What:** add `cq.explore.landscape` and `cq.orient.terrain` recipes; ensure NetworkMap and domain_heatmap render from verified edges (no LLM-imagined links).
- **Acceptance:** "show me the X landscape" renders a NetworkMap whose nodes/edges all trace to corpus rows.
- **Tests:** `test_orient_edges_verified.py`.

**D4.2 — Connect mode (opportunity routes)**
- **What:** `cq.match.workbench` and `cq.translate.connect` recipes; opportunity routes from matcher + entry-friction tags.
- **Acceptance:** explicit "why this, why now, why this user" rationale present on each surfaced route.
- **Tests:** `test_connect_rationale_present.py`.

**D4.3 — Act mode (decision-ready)**
- **What:** `cq.decide.pursue` recipe; if economic content present, the existing EconomicCase block renders behind the Five Case skill.
- **Acceptance:** recommendation, evidence trail, confidence level, key assumptions, main objections, next-evidence — all six present.
- **Tests:** `test_act_six_required_fields.py`.

**D4.4 — Defend quality bar across all**
- **What:** Defend isn't a mode — it's a quality gate. `agents/spine/verify.py` enforces the seven Defend-operationalised fields on every Phase-4 artifact. Reuse `artifact_qa` rules.
- **Acceptance:** all Phase-4 artifacts pass the Defend QA before render.
- **Tests:** `test_defend_quality_gate.py`.

**D4.5 — Cutover from old workbench graph**
- **What:** flip `ATLAS5_ORCHESTRATOR_V1` to default ON; remove the legacy provider path from `workbench-runtime-provider.tsx`; old `agents/workbench/graph.py` removed from the active graph set in `agents/langgraph.json` (still present in repo + tagged branch for reference).
- **Acceptance:** Workbench production traffic uses the orchestrator; `/lab/legacy-workbench` route added for one-week diff comparison.
- **Tests:** existing eval suite (now run against orchestrator); the legacy route is read-only.

### Phase 5 — Harden

**D5.1 — Latency budget + early-exit**
- **What:** orchestrator enforces per-tool and per-run timeouts; `analyze` lane < 8s (CLAUDE.md), `headline` < 3s (North Star UX). Early-exit if budget tight; stream the trace.
- **Acceptance:** P95 latencies meet budget on the 12 fixture queries.
- **Tests:** `eval/latency_budget.py` (perf test in CI).

**D5.2 — Encoding guardrail for generative viz**
- **What:** `agents/registry/viz_guardrail.py` validates generated ECharts/MCP specs (honest axes, capped types, accessible palette). Generative path enabled behind `ATLAS5_GENERATIVE_VIZ_V1`.
- **Acceptance:** synthetic "misleading-axis" spec is caught and rejected; legitimate specs pass.
- **Tests:** `test_encoding_guardrail.py` (10 cases — 5 good, 5 bad).

**D5.3 — Render-parity gate in CI**
- **What:** the split-view becomes a CI test: same `AtlasRenderModel` rendered in blocks vs document must yield identical citation set and computed tier.
- **Acceptance:** CI fails if either mode drops a citation the other keeps.
- **Tests:** Playwright `render-parity.spec.ts` in CI.

**D5.4 — Tier-3 product review with Dayo (30 min)**
- **What:** walk through the Sameer pilot end-to-end on the live system. Sign-off or backlog.
- **⚑ Stage-1.5 close-out gate.**

---

## 4. Feature flags

| Flag | Default | Controls |
|---|---|---|
| `ATLAS5_ORCHESTRATOR_V1` | OFF (Phases 0–3) → ON (D4.5) | Routes traffic to the new brain. |
| `ATLAS5_FALSIFICATION_LANE_V1` | (existing) | Already gates falsification today; rewired in D1.3 to "always on for deep". |
| `ATLAS5_VIZ_ART_DIRECTOR_V1` | OFF → ON in D4.1 | Live viz selection (was audit-only). |
| `ATLAS5_GENERATIVE_VIZ_V1` | OFF | Enables generative ECharts/MCP behind the guardrail (Phase 5). |

---

## 5. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Latency blow-out on tool-calling loop | Medium | Latency budget + early-exit + parallel tool calls (D5.1); stream trace so deep *feels* fast. |
| Requirement Spec proof gate fails (D3.2) | Medium | Documented escalation point; fall back to model-only matching for Diagnose vertical and proceed with the rest of the architecture. (Plan does not collapse on this.) |
| Render-mode parity drift | Low–medium | Split-view from D2.3, then CI gate in D5.3. |
| Determinism regression vs old router | Medium | Low temp + full trace logging; legacy route preserved (D4.5) for one-week side-by-side diff. |
| Block registry gaps revealed late | Medium | D2.2 capability-gap report exposes them continuously; new blocks added in Phase 4 / 5 as needed. |
| CopilotKit + AG-UI vs assistant-ui transport conflict | Low | ADR §12 decision: CopilotKit + AG-UI is the control layer for the orchestrator; assistant-ui only on `/lab/langgraph`. Do not run both on the same surface. |
| Encoding guardrail blocks legitimate charts | Low | 10-case test suite (D5.2); guardrail tunable per chart type. |

---

## 6. Reconciliation with the old D0.6 plan

| D0.6 deliverable | Status in this plan |
|---|---|
| Eval harness scaffold | **Carried** (D0.4 reorients to outcome-based eval; existing scaffold reused). |
| Supabase wiring | **Unchanged** (substrate). |
| MCP tools (cpc_corpus, exa, scenario, govuk) | **Unchanged** (substrate); become orchestrator tools (D1.2). |
| Context assembler | **Replaced** by orchestrator planning + `passport_load`/`requirement_spec` tools. |
| JARVIS / ATLAS / CICERONE / HYVE as separate graphs | **Replaced**: JARVIS/ATLAS/HYVE collapse into lenses (skill packs); CICERONE survives as a real subagent (D1.2 / orchestrator/subagents/). |
| AG-UI wiring | **Carried** (D1.5 — bound to orchestrator + AtlasRenderModel). |
| Brief artifact panel | **Carried** (via Snapshot/Brief workflow — Phase 4 follow-up). |
| Canvas mode | **Deferred** until after Phase 4 cutover (no change to tldraw integration in this stage). |

---

## 3.5 Phase 3.5 — UI Integration Seam (MVP wiring)

Backend Phases 0–5 are implemented in Python/tests. This phase makes the workbench **live** on `/workbench`.

| ID | Deliverable | Status |
|----|-------------|--------|
| U1 | Diagnose path → `build_value_translation_report()` in orchestrator loop | Done — `agents/orchestrator/diagnose.py` |
| U2 | Matcher tools (`extract_requirement_spec`, `run_matcher`, `run_value_translation`) | Done — `agents/orchestrator/tools.py` |
| U3 | Render block payloads + TS adapter (`orchestratorToAtlasRenderModel`) | Done — `block_payloads.py`, `orchestrator-adapter.ts` |
| U4 | Flag-gated runtime swap (`NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1`) | Done — `workbench-agent-bridge.tsx` |
| U5 | Context sync (`setLiveModelFromOrchestrator`) | Done — `workbench-context.tsx` |
| U6 | Gate card in chat (`useLangGraphInterrupt`) | Done — client-side deep-query confirm fallback in `orchestrator-chat-panel.tsx` |
| U7 | Reasoning trace from orchestrator steps | Done — `reasoning_trace.py` + bridge sync |
| U8 | Document mode (`research-document.tsx`) | Done — `research-document.tsx` + canvas toggle |
| U9 | Lab split-view `/lab/orchestrator` | Done |
| U10 | Env + deploy (local flag, Railway, Vercel) | Done — `.env.example` defaults ON; deploy envs manual |
| U11 | Playwright e2e (canonical question → canvas blocks) | Done — `eval/orchestrator_workbench.spec.ts` |
| U12 | Sameer validation harness | Done — `eval/sameer_validation.md` + pytest |

**Canonical gate question:**
> What evidence does CPC have in smart mobility that would transfer to the Innovate UK Smart City Challenge?

**Acceptance:** `/workbench` with both flags on → chat → canvas shows `TransferLanes` + `MatchBench` + confidence tier.

**Build order:** U1 → U2 → U3 → U4 → U5 → U11 → U6 → U8 → D4.5 → D5.4

---

## 7. What's out of scope for Stage 1.5

- Canvas mode (tldraw) re-wiring — runs unchanged.
- Brief v2 / Run 3 anything — superseded; do not touch.
- Buyer lenses beyond SME (Phase 2 per North Star).
- Entity resolution / cross-Passport relationship modelling (Phase 2 per North Star).
- Synthesised hypothetical Requirement Specs from user briefs (Phase 2).
- Open-web research mode beyond Exa falsification lane.

---

## 8. Definition of done for Stage 1.5

1. `ATLAS5_ORCHESTRATOR_V1=on` in production; old workbench graph archived (tagged).
2. Diagnose / Value Translation vertical fully working on the Sameer pilot.
3. Capability-gap report live and populated.
4. Render-parity, latency, encoding-guardrail tests green in CI.
5. Four Horsemen + outcome eval suite passing.
6. Notion harmonised to match the four canonical repo docs (deferred work item — runs once MCP is back).

---

*Sequenced from `ATLAS5_BRAIN_ADR.md` (paradigm) for the outcomes in `ATLAS5_NORTH_STAR.md`, within the stack in `CLAUDE.md`. Owner: Dayo. Plan version: 1.0 — 2026-06-15.*
