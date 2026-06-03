#!/usr/bin/env python3
"""
Horsemen eval — determinism, honesty, attribution, CPC-inward routing.

Run: python eval/test_four_horsemen.py
"""
from __future__ import annotations

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from agents.visual_recipe_director import (  # noqa: E402
    is_cpc_inward,
    select_recipe,
)


def test_google_determinism():
    """Same query ×3 → same target_recipe."""
    q = "Explore the innovation landscape for connected autonomous transport in the UK"
    recipes = [select_recipe(q) for _ in range(3)]
    assert len(set(recipes)) == 1, f"Non-deterministic recipes: {recipes}"


def test_anthropic_honesty_speculative():
    """Off-domain query → not CPC-inward."""
    assert is_cpc_inward("hello there") is False


def test_palantir_act_routing():
    """Investment language → act recipe."""
    recipe = select_recipe("Build a Five Case for port inspection drones")
    assert recipe == "act"


def test_mckinsey_cpc_inward():
    """CPC capability query → inward."""
    assert is_cpc_inward("What evidence does CPC have for autonomous freight corridors?") is True


def run() -> bool:
    tests = [
        ("Google (determinism)", test_google_determinism),
        ("Anthropic (honesty)", test_anthropic_honesty_speculative),
        ("Palantir (attribution/act)", test_palantir_act_routing),
        ("McKinsey (CPC-inward)", test_mckinsey_cpc_inward),
    ]
    passed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"  [PASS] {name}")
            passed += 1
        except Exception as exc:
            print(f"  [FAIL] {name}: {exc}")
    print(f"\nHorsemen: {passed}/{len(tests)}")
    return passed == len(tests)


if __name__ == "__main__":
    raise SystemExit(0 if run() else 1)
