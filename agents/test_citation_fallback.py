"""Unit tests for citation fallback and filter helpers."""
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
    suggested_citations_block,
)


def test_filter_accepts_cpc_internal_in_raw_results():
    raw = [
        {
            "id": "abc-123",
            "title": "CPC rail capability",
            "source_type": "cpc_internal",
            "similarity": 0.72,
            "source_label": "CPC internal — evidence_containers",
        }
    ]
    cites = [{"id": "abc-123", "title": "CPC rail capability", "score": 0.72}]
    out = filter_llm_citations(cites, raw)
    assert len(out) == 1
    assert out[0]["source_type"] == "cpc_internal"


def test_inject_fallback_when_llm_empty():
    raw = [
        {
            "id": "proj-1",
            "title": "Autonomous freight trial",
            "organisation": "Test Org",
            "source_type": "project",
            "similarity": 0.68,
        },
        {
            "id": "proj-2",
            "title": "Low score project",
            "source_type": "project",
            "similarity": 0.2,
        },
    ]
    with patch("agents.citation_helpers._verify_project", return_value={"id": "proj-1"}):
        out = inject_citation_fallback([], raw, min_score=0.45, limit=2)
    assert len(out) == 1
    assert out[0]["id"] == "proj-1"
    assert "Auto-suggested" in out[0]["relevance_note"]


def test_suggested_block_lists_top_hits():
    raw = [
        {"id": "a", "title": "A", "source_type": "project", "similarity": 0.9},
        {"id": "b", "title": "B", "source_type": "live_call", "similarity": 0.5},
    ]
    block = suggested_citations_block(raw, limit=2, min_score=0.4)
    assert "id=\"a\"" in block
    assert "id=\"b\"" in block


def run():
    tests = [
        test_filter_accepts_cpc_internal_in_raw_results,
        test_inject_fallback_when_llm_empty,
        test_suggested_block_lists_top_hits,
    ]
    passed = 0
    for t in tests:
        try:
            t()
            print(f"  [PASS] {t.__name__}")
            passed += 1
        except Exception as exc:
            print(f"  [FAIL] {t.__name__}: {exc}")
    print(f"\n{'=' * 40}\n  Results: {passed}/{len(tests)} passed\n{'=' * 40}")
    return passed == len(tests)


if __name__ == "__main__":
    raise SystemExit(0 if run() else 1)
