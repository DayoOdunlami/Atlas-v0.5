#!/usr/bin/env python3
"""
Phase D — Run multi-turn trajectory eval scenarios.

Usage:
  python eval/run_trajectories.py
"""
from __future__ import annotations

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

try:
    from dotenv import load_dotenv
    load_dotenv(_root / ".env.local", override=True)
    load_dotenv(_root / ".env", override=True)
except ImportError:
    pass


def main() -> int:
    from agents.eval.runner import run_all_trajectories

    print("Atlas 5 — Trajectory eval (Phase D)")
    report = run_all_trajectories()
    for r in report["results"]:
        status = "PASS" if r["passed"] else "FAIL"
        name = (r.get("name") or "").encode("ascii", "replace").decode("ascii")
        print(f"  [{status}] {r['id']}: {name}")
        for f in r.get("failures") or []:
            print(f"         - {f}")
    print(f"\n  {report['scenarios_passed']}/{report['scenarios_total']} scenarios passed")
    return 0 if report["scenarios_passed"] == report["scenarios_total"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
