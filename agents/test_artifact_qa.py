#!/usr/bin/env python3
"""Offline tests for artifact_qa."""
from __future__ import annotations

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from agents.atlas.artifact_qa import run_artifact_qa  # noqa: E402


def test_pass_rich_artifact():
    ab = {
        "recipe": "orient",
        "headline": "UK CAT landscape shows strong rail-autonomy cluster.",
        "insight_card": "Multiple corpus projects align on deployment trials in rail.",
        "confidence_tier": "Indicative",
        "corpus_citations": [{"id": "1"}, {"id": "2"}],
        "sections": {"Landscape Overview": "Overview text here."},
        "visual_blocks": [{"type": "domain_heatmap", "data": {}}],
        "citation_guard": {"status": "pass"},
    }
    qa = run_artifact_qa(ab)
    assert qa["status"] in ("pass", "warn")
    assert qa["metrics"]["content_score"] >= 50


def test_fail_tier_mismatch():
    ab = {
        "headline": "Strong definitive claim about the market.",
        "insight_card": "Because reasons stated clearly here.",
        "confidence_tier": "Supported",
        "corpus_citations": [],
        "citation_guard": {"status": "warn", "reason": "tier capped"},
    }
    qa = run_artifact_qa(ab)
    assert qa["status"] == "fail"
    assert any(i["type"] == "confidence_mismatch" for i in qa["issues"])


if __name__ == "__main__":
    tests = [test_pass_rich_artifact, test_fail_tier_mismatch]
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
