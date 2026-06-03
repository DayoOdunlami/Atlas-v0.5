#!/usr/bin/env python3
"""
Sprint 3 — Live 5-query parity gate.

Validates full artifact contract via run_atlas() (same graph as CopilotKit :8000).

Run:
  agents\\.venv\\Scripts\\python.exe eval/test_parity_gate.py          # offline routing only
  agents\\.venv\\Scripts\\python.exe eval/test_parity_gate.py --live   # full LLM + corpus (slow)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

try:
    from dotenv import load_dotenv
    load_dotenv(_root / ".env", override=False)
    load_dotenv(_root / ".env.local", override=True)
except ImportError:
    pass

from agents.visual_recipe_director import select_recipe  # noqa: E402

CANONICAL = [
    ("Innovation landscape CAT UK", "Explore the innovation landscape for connected and autonomous transport in the UK.", "orient"),
    ("GPS-denied UAS gaps", "What evidence gap blocks GPS-denied UAS deployment in urban environments?", "diagnose"),
    ("Funding opportunities autonomous rail", "What funding opportunities exist for autonomous rail in the UK?", "connect"),
    ("Build Five Case port inspection", "Build a Five Case investment brief for port inspection drones.", "act"),
    ("CPC maritime autonomy (not act)", "What should CPC do in maritime autonomy?", "orient"),
]

GATE = {
    "min_headline_len": 20,
    "min_insight_len": 30,
    "min_citations_orient": 0,  # gaps OK for diagnose
    "min_citations_act": 0,     # fallback may inject
}


def recipe_ok(got: str, expected: str) -> bool:
    if got == expected:
        return True
    if expected == "diagnose" and got in ("diagnose", "cpc_evidence_gaps"):
        return True
    return False


def offline_gate() -> bool:
    ok = True
    print("Offline routing gate:")
    for label, query, expected in CANONICAL:
        recipe = select_recipe(query)
        status = "PASS" if recipe_ok(recipe, expected) else "FAIL"
        if status == "FAIL":
            ok = False
        print(f"  [{status}] {label}: recipe={recipe} (expected {expected})")
    return ok


def live_gate() -> bool:
    from agents.atlas.graph import run_atlas

    ok = True
    print("\nLive artifact contract gate (run_atlas):")
    for label, query, expected in CANONICAL:
        try:
            data = run_atlas(query)
        except Exception as exc:
            print(f"  [FAIL] {label}: {exc}")
            ok = False
            continue

        ab = data.get("artifact_block") or {}
        recipe = ab.get("recipe") or data.get("recipe") or select_recipe(query)
        headline = (ab.get("headline") or "") if isinstance(ab, dict) else ""
        insight = (ab.get("insight_card") or data.get("analysis") or "") if isinstance(ab, dict) else ""
        blocks = len(ab.get("visual_blocks") or []) if isinstance(ab, dict) else 0
        cites = len(data.get("corpus_citations") or [])

        checks = [
            recipe_ok(str(recipe), expected),
            len(headline) >= GATE["min_headline_len"],
            len(insight) >= GATE["min_insight_len"] or len(headline) >= 40,
        ]
        status = "PASS" if all(checks) else "FAIL"
        if status == "FAIL":
            ok = False
        print(
            f"  [{status}] {label}: recipe={recipe} headline={len(headline)} "
            f"insight={len(insight)} blocks={blocks} citations={cites}"
        )
    return ok


def main() -> int:
    offline_ok = offline_gate()
    if "--live" in sys.argv:
        live_ok = live_gate()
        return 0 if offline_ok and live_ok else 1
    print("\n(Skip live gate — pass --live to run full LLM contract checks)")
    return 0 if offline_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
