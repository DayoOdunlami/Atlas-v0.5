#!/usr/bin/env python3
"""
Phase B — Run orchestrator golden battery and write baseline report.

Usage:
  python eval/run_battery.py
  python eval/run_battery.py --limit 5
  python eval/run_battery.py --no-judge
  EVAL_HEURISTIC_JUDGE_ONLY=1 python eval/run_battery.py
"""
from __future__ import annotations

import argparse
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
    parser = argparse.ArgumentParser(description="Run orchestrator eval battery")
    parser.add_argument("--limit", type=int, default=None, help="Run first N items only")
    parser.add_argument("--no-judge", action="store_true", help="Skip LLM/heuristic judge")
    args = parser.parse_args()

    from agents.eval.runner import run_battery, write_baseline_report

    print("Atlas 5 — Orchestrator eval battery (Phase B)")
    report = run_battery(include_judge=not args.no_judge, limit=args.limit)
    path = write_baseline_report(report)
    agg = report["aggregate"]
    print(f"  Pass: {agg['items_passed']}/{agg['items_total']} ({agg['pass_rate']:.0%})")
    print(f"  Quality mean: {agg['quality_mean']}")
    print(f"  Judge mean: {agg.get('judge_mean')}")
    print(f"  Latency mean: {agg['latency_ms_mean']} ms")
    print(f"  Report: {path}")
    pass_rate = agg["pass_rate"]
    threshold = 0.85
    if agg["items_passed"] == agg["items_total"]:
        return 0
    if pass_rate >= threshold:
        print(f"  Note: pass rate {pass_rate:.0%} >= {threshold:.0%} threshold — exit 0")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
