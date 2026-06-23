#!/usr/bin/env python3
"""Sprint 4 — Turn intent routing unit tests (orchestrator turn_lanes)."""
from __future__ import annotations

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from agents.orchestrator.turn_lanes import classify_turn_lane  # noqa: E402

PASS = "[PASS]"
FAIL = "[FAIL]"


def check(label: str, ok: bool, note: str = "") -> bool:
    status = PASS if ok else FAIL
    print(f"  {status}  {label}" + (f"  [{note}]" if note else ""))
    return ok


def main() -> int:
    ok = True
    print("Turn intent heuristic (orchestrator):")

    ok &= check(
        "cold session -> analyze",
        classify_turn_lane("Explore UK CAT landscape", has_prior=False) == "analyze",
    )
    ok &= check(
        "explain NPV -> clarify",
        classify_turn_lane("What is NPV and how is it calculated?", has_prior=True) == "clarify",
    )
    ok &= check(
        "add key players -> refine",
        classify_turn_lane("Add key players to the landscape section", has_prior=True) == "refine",
    )
    ok &= check(
        "new topic -> analyze",
        classify_turn_lane(
            "Build a Five Case investment brief for port inspection drones",
            has_prior=True,
        )
        == "analyze",
    )
    ok &= check(
        "short follow-up -> clarify",
        classify_turn_lane("Why is confidence only Indicative?", has_prior=True) == "clarify",
    )

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
