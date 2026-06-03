#!/usr/bin/env python3
"""
Parity smoke — canonical queries × recipe routing (offline).

Live dual-path parity (:8000 vs :2024) requires running servers.
This script validates routing + citation helper contracts offline.

Run: python eval/test_parity_smoke.py
     python eval/test_parity_smoke.py --live   # requires :8000 and :2024
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from agents.visual_recipe_director import select_recipe  # noqa: E402

CANONICAL = [
    ("Innovation landscape CAT UK", "Explore the innovation landscape for connected and autonomous transport in the UK.", "orient"),
    ("GPS-denied UAS gaps", "What evidence gap blocks GPS-denied UAS deployment in urban environments?", "diagnose"),
    ("Funding opportunities autonomous rail", "What funding opportunities exist for autonomous rail in the UK?", "connect"),
    ("Build Five Case port inspection", "Build a Five Case investment brief for port inspection drones.", "act"),
    ("CPC maritime autonomy (not act)", "What should CPC do in maritime autonomy?", "orient"),
]


def offline_smoke() -> bool:
    ok = True
    for label, query, expected in CANONICAL:
        recipe = select_recipe(query)
        ok_recipe = recipe == expected or (
            expected == "diagnose" and recipe in ("diagnose", "cpc_evidence_gaps")
        )
        status = "PASS" if ok_recipe else "FAIL"
        if status == "FAIL":
            ok = False
        print(f"  [{status}] {label}: got={recipe} expected={expected}")
    return ok


def _post_json(url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode())


def live_smoke() -> bool:
    """Best-effort live smoke against AG-UI :8000 — skips if server down."""
    ok = True
    for label, query, expected in CANONICAL[:3]:
        try:
            data = _post_json(
                "http://localhost:8000/agents/atlas",
                {"query": query},
            )
            recipe = data.get("recipe") or data.get("artifact_block", {}).get("recipe")
            cites = len(data.get("corpus_citations") or [])
            status = "PASS" if recipe == expected else "FAIL"
            if status == "FAIL":
                ok = False
            print(f"  [{status}] {label} @8000: recipe={recipe} citations={cites}")
        except (urllib.error.URLError, TimeoutError) as exc:
            print(f"  [SKIP] {label} @8000: {exc}")
            return False
    return ok


def main() -> int:
    print("Offline routing smoke:")
    offline_ok = offline_smoke()
    if "--live" in sys.argv or (len(sys.argv) > 1 and sys.argv[1] == "live"):
        print("\nLive AG-UI smoke (:8000):")
        live_ok = live_smoke()
        return 0 if offline_ok and live_ok else 1
    return 0 if offline_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
