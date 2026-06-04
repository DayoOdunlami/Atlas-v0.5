"""
Connect the Moat — Phase 1 plumbing tests.

Verifies that claim_state survives from the engine helpers to the final artefact,
and that object-routed passport/organisation requests never fall through to the
Five Case path. Hermetic: cpc_internal rows + mocks avoid live DB/LLM.
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from agents.citation_helpers import (  # noqa: E402
    filter_llm_citations,
    inject_citation_fallback,
    normalise_claim_state,
)
from agents.atlas.graph import (  # noqa: E402
    _project_citation_with_state,
    _build_object_route_response,
    passport_tier_to_claim_state,
    verify_citations,
)


# ── Fix 2: helpers carry / normalise claim_state ────────────────────────────

def test_normalise_claim_state():
    assert normalise_claim_state("stated") == "stated"
    assert normalise_claim_state("INFERRED") == "inferred"
    assert normalise_claim_state("bogus") == "inferred"          # default
    assert normalise_claim_state(None) == "inferred"
    assert normalise_claim_state("contested") == "inferred"      # not assignable here
    assert normalise_claim_state(None, default="stated") == "stated"


def test_filter_carries_claim_state_for_project():
    raw = [{"id": "proj-1", "title": "Freight trial", "source_type": "project", "similarity": 0.7}]
    with patch("agents.citation_helpers._verify_project", return_value={"id": "proj-1"}):
        # model tagged it stated
        out = filter_llm_citations([{"id": "proj-1", "claim_state": "stated"}], raw)
        assert out[0]["claim_state"] == "stated"
        # model omitted → conservative inferred (not stated)
        out2 = filter_llm_citations([{"id": "proj-1"}], raw)
        assert out2[0]["claim_state"] == "inferred"


def test_filter_carries_claim_state_for_cpc_internal():
    raw = [{"id": "c1", "title": "CPC cap", "source_type": "cpc_internal", "similarity": 0.6}]
    out = filter_llm_citations([{"id": "c1"}], raw)
    assert out[0]["claim_state"] == "stated"   # cpc default


def test_inject_fallback_sets_state_and_rationale():
    raw = [{"id": "p1", "title": "T", "source_type": "project", "similarity": 0.7}]
    with patch("agents.citation_helpers._verify_project", return_value={"id": "p1"}):
        out = inject_citation_fallback([], raw, min_score=0.45, limit=1)
    assert out[0]["claim_state"] == "inferred"
    assert out[0].get("claim_rationale")


# ── Fix 1: final assembly ALWAYS carries a claim_state ──────────────────────

def test_project_citation_always_has_state():
    # explicit state preserved
    a = _project_citation_with_state({"id": "x", "claim_state": "stated"})
    assert a["claim_state"] == "stated"
    # missing state → never silently dropped
    b = _project_citation_with_state({"id": "y"})
    assert b["claim_state"] == "inferred"
    # rationale falls back to relevance_note
    c = _project_citation_with_state({"id": "z", "relevance_note": "adjacent"})
    assert c["claim_rationale"] == "adjacent"


def test_verify_citations_artifact_carries_claim_state():
    """End-to-end: cpc_internal citation → final artifact_block carries claim_state."""
    state = {
        "query": "CPC rail capability",
        "raw_search_results": [
            {"id": "c1", "title": "CPC rail cap", "source_type": "cpc_internal", "similarity": 0.7},
        ],
        "corpus_citations": [
            {"id": "c1", "title": "CPC rail cap", "source_type": "cpc_internal",
             "claim_state": "stated", "score": 0.7},
        ],
        "confidence_tier": "Supported",
        "sections": {"Overview": "x"},
        "target_recipe": "orient",
    }
    out = verify_citations(state)  # type: ignore[arg-type]
    cites = out["artifact_block"]["corpus_citations"]
    assert cites and all("claim_state" in c for c in cites), "every citation must carry claim_state"
    assert cites[0]["claim_state"] == "stated"


# ── Fix 3: object routes never produce a Five Case ──────────────────────────

_FIVE_CASE_KEYS = {"Strategic Case", "Economic Case", "Commercial Case", "Financial Case", "Management Case"}


def test_passport_route_returns_passport_data():
    passport = {
        "passport_id": "pp-1",
        "title": "GoShuttle X1",
        "owner_org": "GoShuttle Ltd",
        "trl_level": 6,
        "summary": "Autonomous shuttle.",
        "claims": [
            {"domain": "capability", "text": "Operates GPS-denied", "confidence_tier": "self_reported"},
            {"domain": "certification", "text": "ISO 26262 ASIL-B", "confidence_tier": "verified"},
        ],
    }
    with patch("agents.passport_loader.load_passport_for_query", return_value=passport):
        out = _build_object_route_response(
            {"query": "passport for GoShuttle X1", "object_route": {"object_kind": "passport"}},
            {"object_kind": "passport"},
        )
    assert out["target_recipe"] == "evidence_panel"
    assert "Entity Passport" in out["sections"]
    assert not (_FIVE_CASE_KEYS & set(out["sections"].keys())), "must NOT be a Five Case brief"
    # self_reported → inferred, verified → stated (honesty mapping)
    claims_md = out["sections"]["Claims"]
    assert "[inferred]" in claims_md and "[stated]" in claims_md


def test_passport_route_honest_not_found():
    with patch("agents.passport_loader.load_passport_for_query", return_value=None):
        out = _build_object_route_response(
            {"query": "passport for Nonexistent X", "object_route": {"object_kind": "passport"}},
            {"object_kind": "passport"},
        )
    assert out["target_recipe"] == "evidence_panel"
    assert out.get("_object_not_found") is True
    assert "No passport found" in out["sections"]["Passport"]
    assert not (_FIVE_CASE_KEYS & set(out["sections"].keys()))


def test_passport_tier_mapping():
    assert passport_tier_to_claim_state("verified") == "stated"
    assert passport_tier_to_claim_state("self_reported") == "inferred"
    assert passport_tier_to_claim_state("ai_inferred") == "inferred"
    assert passport_tier_to_claim_state(None) == "unknown"


def run():
    tests = [
        test_normalise_claim_state,
        test_filter_carries_claim_state_for_project,
        test_filter_carries_claim_state_for_cpc_internal,
        test_inject_fallback_sets_state_and_rationale,
        test_project_citation_always_has_state,
        test_verify_citations_artifact_carries_claim_state,
        test_passport_route_returns_passport_data,
        test_passport_route_honest_not_found,
        test_passport_tier_mapping,
    ]
    passed = 0
    for t in tests:
        try:
            t()
            print(f"  [PASS] {t.__name__}")
            passed += 1
        except Exception as exc:
            import traceback
            print(f"  [FAIL] {t.__name__}: {exc}")
            traceback.print_exc()
    print(f"\n{'=' * 44}\n  Results: {passed}/{len(tests)} passed\n{'=' * 44}")
    return passed == len(tests)


if __name__ == "__main__":
    raise SystemExit(0 if run() else 1)
