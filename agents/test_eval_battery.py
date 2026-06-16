"""Phase A–C eval tests — trace, judge, battery runner."""
from __future__ import annotations

import os

import pytest


CANONICAL_QUERY = (
    "What evidence does CPC have in smart mobility that would transfer "
    "to the Innovate UK Smart City Challenge?"
)


def test_run_orchestrator_eval_returns_trace():
    from agents.eval.trace import run_orchestrator_eval

    trace = run_orchestrator_eval(
        CANONICAL_QUERY,
        expected_outcome="connect",
        include_quality=True,
        include_judge=False,
    )
    assert trace["query"] == CANONICAL_QUERY
    assert trace["triage"]["outcome"] in ("connect", "diagnose")
    assert trace["summary"]["outcome"] in ("connect", "diagnose")
    assert trace["quality"]["overall"] >= 0.6
    assert "TransferLanes" in trace["summary"]["block_types"] or "MatchBench" in trace["summary"]["block_types"]


def test_heuristic_judge_scores():
    from agents.eval.judge import heuristic_judge
    from agents.eval.trace import run_orchestrator_eval

    trace = run_orchestrator_eval(CANONICAL_QUERY, include_quality=False, include_judge=False)
    result = heuristic_judge(trace["render_model"], CANONICAL_QUERY)
    assert result["method"] == "heuristic"
    assert 0 <= result["overall"] <= 5
    assert "Evidence honesty" in result["scores"]


def test_judge_orchestrator_heuristic_only(monkeypatch):
    monkeypatch.setenv("EVAL_HEURISTIC_JUDGE_ONLY", "true")
    from agents.eval.judge import judge_orchestrator_trace
    from agents.eval.trace import run_orchestrator_eval

    trace = run_orchestrator_eval(CANONICAL_QUERY, include_judge=False)
    judged = judge_orchestrator_trace(trace["render_model"], query=CANONICAL_QUERY)
    assert judged["method"] == "heuristic"


def test_battery_item_runs():
    from agents.eval.runner import run_battery_item

    item = {
        "id": "Q026",
        "query": CANONICAL_QUERY,
        "expected_outcome": "connect",
        "follow_ups": ["Which claims travel, reframe or fail?"],
    }
    result = run_battery_item(item, include_judge=False)
    assert result["id"] == "Q026"
    assert result["primary"]["summary"]["outcome"] in ("connect", "diagnose")
    assert len(result["follow_ups"]) == 1


def test_battery_limit_three():
    from agents.eval.runner import run_battery

    report = run_battery(include_judge=False, limit=3)
    assert report["aggregate"]["items_total"] == 3
    assert report["aggregate"]["quality_mean"] >= 0.5


def test_write_baseline_report(tmp_path, monkeypatch):
    from agents.eval import runner as runner_mod

    monkeypatch.setattr(runner_mod, "_BASELINE_DIR", tmp_path)
    report = {
        "aggregate": {
            "items_total": 1,
            "items_passed": 1,
            "pass_rate": 1.0,
            "quality_mean": 0.85,
            "judge_mean": 3.5,
            "latency_ms_mean": 120.0,
            "latency_ms_p95": 150.0,
        },
        "results": [
            {
                "id": "Q026",
                "passed": True,
                "primary": {
                    "summary": {"outcome": "connect"},
                    "quality": {"overall": 0.85},
                    "judge": {"overall": 3.5},
                    "timings_ms": {"total_ms": 120},
                },
            }
        ],
    }
    path = runner_mod.write_baseline_report(report)
    assert path.exists()
    assert path.suffix == ".json"
