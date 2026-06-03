"""Offline tests for agents/atlas/citation_guard.py"""
from __future__ import annotations

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from agents.atlas.citation_guard import apply_citation_guard, max_tier_for_citation_count


def test_max_tier_for_count():
    assert max_tier_for_citation_count(0) == "Speculative"
    assert max_tier_for_citation_count(1) == "Indicative"
    assert max_tier_for_citation_count(2) == "Indicative"
    assert max_tier_for_citation_count(3) == "Supported"
    assert max_tier_for_citation_count(5) == "Robust"


def test_caps_supported_with_two_citations():
    r = apply_citation_guard(
        confidence_tier="Supported",
        citation_count=2,
        headline="UK CAT landscape shows strong deployment momentum.",
    )
    assert r["confidence_tier"] == "Indicative"
    assert r["citation_guard"]["status"] == "warn"
    assert r["citation_guard"]["original_tier"] == "Supported"


def test_zero_citations_speculative():
    r = apply_citation_guard(confidence_tier="Robust", citation_count=0)
    assert r["confidence_tier"] == "Speculative"
    assert r["citation_guard"]["status"] in ("warn", "fail")


def test_pass_when_aligned():
    r = apply_citation_guard(confidence_tier="Indicative", citation_count=2)
    assert r["confidence_tier"] == "Indicative"
    assert r["citation_guard"]["status"] == "pass"


def test_headline_softening():
    r = apply_citation_guard(
        confidence_tier="Speculative",
        citation_count=0,
        headline="This is clearly the leading approach.",
    )
    assert r["headline_adjusted"] is True
    assert "clearly" not in r["headline"].lower() or "may" in r["headline"].lower()


if __name__ == "__main__":
    tests = [
        test_max_tier_for_count,
        test_caps_supported_with_two_citations,
        test_zero_citations_speculative,
        test_pass_when_aligned,
        test_headline_softening,
    ]
    passed = 0
    for t in tests:
        try:
            t()
            print(f"  [PASS] {t.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"  [FAIL] {t.__name__}: {e}")
    print(f"\n{passed}/{len(tests)} passed")
    raise SystemExit(0 if passed == len(tests) else 1)
