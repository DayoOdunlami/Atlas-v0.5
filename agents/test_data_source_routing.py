"""Data source routing tests — Decision 3 Rule A/B without live DB."""
from __future__ import annotations

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from agents.visual_recipe_director import is_comparison_query  # noqa: E402


def test_comparison_query_detected():
    assert is_comparison_query("Compare CPC internal evidence vs GtR projects for rail")
    assert not is_comparison_query("What evidence does CPC have for rail innovation?")


def test_cpc_internal_only_inward_not_comparison():
    inward = True
    comparison = is_comparison_query("What evidence does CPC have for autonomous freight?")
    cpc_internal_only = inward and not comparison
    assert cpc_internal_only is True


def test_comparison_blends_external():
    inward = True
    comparison = is_comparison_query("Compare CPC portfolio against UKRI rail calls")
    cpc_internal_only = inward and not comparison
    assert cpc_internal_only is False


def run():
    tests = [
        test_comparison_query_detected,
        test_cpc_internal_only_inward_not_comparison,
        test_comparison_blends_external,
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
