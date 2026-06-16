# Requirement Spec proof gate — D3.2

**Date:** 2026-06-16  
**Decision:** **PROCEED with structured Requirement Spec** (structured wins on auditability)

## Question

Should Diagnose / Value Translation use model-only matching vs structured Requirement Spec extraction before matcher runs?

## Method

Compared on three fixture queries (Sameer pilot corpus):

1. Innovate UK Smart City Challenge (canonical gate question)
2. Rail innovation funding call (sector-scoped)
3. CCAV connected autonomy challenge (policy-heavy)

| Criterion | Model-only | Structured Spec (`requirement_spec.py`) |
|-----------|------------|----------------------------------------|
| Repeatable criterion labels | Low — labels drift per run | High — fixed schema fields |
| Fit/Gap audit trail | Opaque | MatchBench rows trace to Spec dimensions |
| Gap quality (actionable) | Generic "weak match" | `essential` vs `desirable` + evidence_type |
| Provenance | None | Spec fields carry source excerpt refs |
| Latency | Lower | Acceptable (deterministic extract, no LLM in hot path) |

## Result

Structured Spec **wins** on auditability, repeatability, and gap-quality — the three North Star requirements for Diagnose. Model-only matching is retained only as fallback when Spec extraction returns empty (logged as `intent_miss` / gap signal).

## Fixtures

- `agents/matcher/requirement_spec.py` — `extract_requirement_spec()`
- `agents/test_requirement_spec_extraction.py` (if present) or matcher battery tests
- Sameer pilot: `eval/fixtures/value_translation/sameer_review.md`

## Follow-up

- None blocking Phase 4. D4.6 harmonized evidence uses Spec gaps to trigger external lane.
