#!/usr/bin/env python3
"""
Sprint 4 — Turn intent routing unit tests (offline).
"""
from __future__ import annotations

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from agents.atlas.graph import _classify_turn_heuristic  # noqa: E402

PASS = "[PASS]"
FAIL = "[FAIL]"


def check(label: str, ok: bool, note: str = "") -> bool:
    status = PASS if ok else FAIL
    print(f"  {status}  {label}" + (f"  [{note}]" if note else ""))
    return ok


def main() -> int:
    ok = True
    print("Turn intent heuristic:")

    ok &= check(
        "cold session -> analyze",
        _classify_turn_heuristic("Explore UK CAT landscape", False) == "analyze",
    )
    ok &= check(
        "explain NPV -> clarify",
        _classify_turn_heuristic("What is NPV and how is it calculated?", True) == "clarify",
    )
    ok &= check(
        "add key players -> refine",
        _classify_turn_heuristic("Add key players to the landscape section", True) == "refine",
    )
    ok &= check(
        "new topic -> analyze",
        _classify_turn_heuristic(
            "Build a Five Case investment brief for port inspection drones",
            True,
        )
        == "analyze",
    )
    ok &= check(
        "short follow-up -> clarify",
        _classify_turn_heuristic("Why is confidence only Indicative?", True) == "clarify",
    )

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
