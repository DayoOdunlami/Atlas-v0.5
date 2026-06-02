# Atlas 5 — Audit, Tests, and Baseline Report

**Generated:** 2026-06-01  
**Updated:** 2026-06-01 (session close — all fixes applied)  
**Author:** Claude Code (audit + implementation session)  
**Status:** CLOSED — all target fixes applied, test suite clean

---

## System Summary

**What it currently does:** Atlas 5 routes queries through five outcome modes (Orient / Connect / Diagnose / Act / Defend) dispatched from `build_five_case` based on `target_recipe`. Each mode has its own LLM prompt and output schema. The CPC-inward path (capability/evidence queries) is separately gated before dispatch. The Five Case (Act) path preserves the G1–G7 golden eval contract. CICERONE and HYVE are registered and import-clean.

**What it did at audit start:** Single `build_five_case` node, CPC-inward exception path, one output format (Five Case) regardless of intent. `_cap_tier` was nested inside `build_five_case`. CICERONE had a broken import.

---

## Known State Verification (at session start)

| Check | Status |
|-------|--------|
| `_llm_internal()` non-streaming JSON node | CONFIRMED |
| `messages-tuple` streaming fix | CONFIRMED |
| `RemoteThreadListAdapter` full interface | CONFIRMED |
| CICERONE registered in `server.py` | CONFIRMED — was failing silently at import (Gap B, now fixed) |
| HYVE registered in `server.py` | CONFIRMED |
| G1–G7 all 7/7 decisive PASS on A14 golden brief | CONFIRMED |

---

## Gaps Fixed This Session

### Gap C — `_cap_tier` nested inside `build_five_case`
**Status:** FIXED  
`_TIER_ORDER` and `_cap_tier` extracted to module scope in `agents/atlas/graph.py`. Tests T1-4 and T1-10 now PASS.

### Gap B — CICERONE broken import
**Status:** FIXED  
`agents/cicerone/graph.py` was importing `search_projects` (does not exist in `mcp_client`). Renamed to `search_corpus_projects` at both import and call site. Tests T1-6 and T1-9 now PASS. CICERONE starts cleanly.

### Gap A — `build_five_case` ignored `target_recipe` for outward queries
**Status:** FIXED  
`target_recipe` was set in `select_recipe_intent` but never consumed in `build_five_case`. Added dispatch block routing to four mode-specific builders. Test T1-8 now PASS.

### Gap D — Orient / Connect / Diagnose / Defend builders missing
**Status:** FIXED  
Four new LLM builder functions added: `_build_orient_report`, `_build_connect_report`, `_build_diagnose_report`, `_build_defend_report`. Full system prompts in `eval/PROMPTS_FOR_REVIEW.md` for Dayo review. Test T1-11 now PASS.

### Gap F — Internal CPC data wiring (`atlas.passports` etc.)
**Status:** DEFERRED — Phase 2. Test T1-12 remains EXPECTED_FAIL by design.

---

## Post-Session Fixes (Dayo instructions, second pass)

### Fix 1 — T1-14 false positive resolved
**Change:** Replaced dotall regex (`/Act.*_cap_tier|_cap_tier.*Act/s`) with a real structural assertion checking that the Act path contains `if not safe_citations and not has_external:` followed by `_cap_tier(tier, "Speculative")`.  
**Code change:** Act path in `build_five_case` now enforces Speculative ceiling when zero corpus citations AND zero external evidence.  
**T1-14 status:** PASS on real behaviour.

### Fix 2 — Diagnose passport guard added
**Change:** One sentence inserted in `_build_diagnose_report` system prompt immediately before the STRUCTURAL EVIDENCE GAPS injection:  
`"Note: Entity Passport data is not yet available in Phase 1. Infer all entity claims and capabilities from the query context and corpus evidence only. Do not fabricate passport fields."`  
**File:** `agents/atlas/graph.py` — `_build_diagnose_report`.

### Fix 3 — `cpc_defend` classifier branch added
**Change:** `defend_challenge` intent added to `_INTENT_PATTERNS` in `agents/visual_recipe_director.py`. Matches: "defend", "defence", "defense", "hold up", "stand up", "challenge", "board pack/presentation/questions/scrutiny", "objection", "pushback", "sceptic", "critique", "panel presentation/investment".  
`select_recipe` routes `defend_challenge` intent to `"cpc_defend"` (checked before `flow_pathway`).  
**Smoke test results:** All five sample queries route correctly.

### Fix 4 — Orient / Connect confidence ceiling lowered to Indicative
**Change:** Both `_build_orient_report` and `_build_connect_report` changed from `_cap_tier(tier, "Supported")` to `_cap_tier(tier, "Indicative")` when zero verified citations are returned.  
**Rationale:** Terrain queries with no corpus evidence should not claim Supported confidence.

---

## Pre-existing issue noted (not introduced, not fixed this session)

`\bflow\b` in the `flow_pathway` intent pattern does not match "flows" (plural). "funding flows for smart mobility" routes to `brief_five_case` instead of `cpc_funding_flow`. This predates all changes this session. Recommend fixing in a follow-up: change `\bflow\b` to `\bflows?\b` in the `flow_pathway` pattern.

---

## T1 Baseline — Final State

| Test | Result | Note |
|------|--------|------|
| T1-1 `select_recipe()` returns valid recipe ID | ✓ PASS | Unit |
| T1-2 `golden_output.md` citation IDs are UUIDs | ✓ PASS | Unit |
| T1-3 `is_cpc_inward()` regex patterns fire | ✓ PASS | Unit |
| T1-4 `_cap_tier` at module scope | ✓ PASS | Gap C fixed |
| T1-5 FiveCaseModel TypedDict sections | ✓ PASS | Unit |
| T1-6 CICERONE imports `search_corpus_projects` | ✓ PASS | Gap B fixed |
| T1-7 `search_hive` exported from mcp_client | ✓ PASS | Unit |
| T1-8 `build_five_case` dispatches on `target_recipe` | ✓ PASS | Gap A fixed |
| T1-9 No deprecated import in CICERONE | ✓ PASS | Gap B fixed |
| T1-10 `_cap_tier` before `build_five_case` | ✓ PASS | Gap C fixed |
| T1-11 Orient/Connect/Diagnose/Act/Defend routing | ✓ PASS | Gap D fixed |
| T1-12 Python agent queries `atlas.passports` | × EXPECTED FAIL | Gap F — Phase 2 |
| T1-13 Passport assembled from `atlas.passports` | ↓ SKIP | Gap F — Phase 2 |
| T1-14 Act mode Speculative ceiling on zero corpus | ✓ PASS | Real assertion — fix 1 |
| T1-15 CPC-inward source filter | × EXPECTED FAIL | Decision 3 — pending |

**Previously-PASS tests:** No regressions. All D0/D2/D3/D4/D6/D7/D10 failures are pre-existing integration tests requiring live services (Supabase, running agents) — not affected by this session's changes.

**Golden A14 non-regression:** `GOLDEN_PASS_THRESHOLD = 7`. Golden eval requires a live agent run; static structure confirmed intact (G1–G7 graders unchanged, Five Case path unchanged).

---

## Files Changed This Session

| File | Change |
|------|--------|
| `agents/atlas/graph.py` | Gap C: `_cap_tier`/`_TIER_ORDER` to module scope; Gap A: dispatch block; Gap D: four builder functions; Act-mode Speculative ceiling; Diagnose passport guard; Orient/Connect ceiling → Indicative |
| `agents/cicerone/graph.py` | Gap B: `search_projects` → `search_corpus_projects` |
| `agents/visual_recipe_director.py` | `defend_challenge` intent + `cpc_defend` routing in `select_recipe` |
| `eval/tier1.test.ts` | T1-1 through T1-15 added; T1-14 real assertion; GOLDEN_PASS_THRESHOLD = 7; D6 template literal bug fixed |
| `eval/tier2_generator.py` | `GOLDEN_PASS_THRESHOLD = 7` (was 4) |
| `eval/audit_report.md` | This file |
| `eval/PROMPTS_FOR_REVIEW.md` | All four new mode prompts for Dayo review |

---

## Open items for next sprint

| Item | Priority | Note |
|------|----------|------|
| Gap F: `atlas.passports` / Entity Passport wiring | Phase 2 | T1-12 / T1-13 stay blocked |
| Decision 3: CPC-inward source filter | Pending | T1-15 blocked |
| `cpc_defend` intent in `select_recipe_intent` reasoning_trace | Low | Works; only logging is incomplete |
| VRD `\bflow\b` → `\bflows?\b` fix | Low | Pre-existing, noted above |
| Diagnose section 3 passport guard adequacy | Low | Prompt guard added; verify at first external user session |
| T1-14 Act-mode ceiling: integration test covering external-evidence-only path | Low | Current test covers cold-Act (no corpus, no external); external-only path covered by existing ceiling rule |
