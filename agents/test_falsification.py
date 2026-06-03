#!/usr/bin/env python3
"""Offline tests for falsification lane."""
from __future__ import annotations

import os
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from agents.atlas.falsification import build_disconfirm_query, run_falsification_lane  # noqa: E402


def test_disconfirm_query():
    q = build_disconfirm_query("GPS denied drones", "Urban autonomy is ready.")
    assert "contradict" in q.lower() or "limitations" in q.lower() or "against" in q.lower()
    assert "Urban autonomy" in q


def test_skipped_when_disabled():
    os.environ.pop("ATLAS_FALSIFICATION_LANE_V1", None)
    r = run_falsification_lane(query="test", headline="claim")
    assert r["status"] == "skipped"
    assert r["enabled"] is False


if __name__ == "__main__":
    tests = [test_disconfirm_query, test_skipped_when_disabled]
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
