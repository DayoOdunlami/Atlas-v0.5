"""Phase D trajectory eval tests."""
from __future__ import annotations

import pytest


def test_trajectory_sameer_transfer():
    from agents.eval.runner import run_trajectory

    scenario = {
        "id": "T01_sameer_transfer",
        "name": "Sameer transfer",
        "turns": [
            {
                "query": (
                    "What evidence does CPC have in smart mobility that would transfer "
                    "to the Innovate UK Smart City Challenge?"
                ),
                "expect_outcome": ["connect", "diagnose"],
                "expect_blocks": ["TransferLanes", "MatchBench"],
                "min_quality": 0.65,
            },
        ],
    }
    result = run_trajectory(scenario, include_judge=False)
    assert result["id"] == "T01_sameer_transfer"
    assert result["turns"][0]["passed"] is True


def test_all_trajectories_offline():
    from agents.eval.runner import run_all_trajectories

    report = run_all_trajectories(include_judge=False)
    assert report["scenarios_total"] == 5
    # At least canonical Sameer scenario must pass
    sameer = next(r for r in report["results"] if r["id"] == "T01_sameer_transfer")
    assert sameer["passed"] is True


def test_trajectory_detects_missing_block():
    from agents.eval.runner import run_trajectory

    scenario = {
        "id": "T_fail",
        "turns": [
            {
                "query": "Explore the UK smart mobility innovation landscape",
                "expect_outcome": ["orient"],
                "expect_blocks": ["NonExistentBlock"],
                "min_quality": 0.5,
            },
        ],
    }
    result = run_trajectory(scenario, include_judge=False)
    assert result["passed"] is False
    assert any("missing block" in f for f in result["failures"])
