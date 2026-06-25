"""Unit tests for atlas v5 trajectory eval harness (no live API)."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agents.atlas_v5.trajectory_eval import (
    _check_expect,
    run_trajectory,
)


def test_check_expect_route_and_reply():
    failures = _check_expect(
        {
            "route": "chat",
            "reply": "Hello — what strategic question can I help with?",
            "update_canvas": False,
            "dev_meta": {},
        },
        {
            "route": ["chat", "clarify"],
            "update_canvas": False,
            "min_reply_chars": 10,
            "reply_not_contains": ["lost the thread"],
        },
        1200.0,
    )
    assert failures == []


def test_check_expect_catches_bad_route():
    failures = _check_expect(
        {"route": "substantive", "reply": "ok", "update_canvas": True},
        {"route": "chat"},
        50.0,
    )
    assert any("route" in f for f in failures)


@pytest.mark.asyncio
async def test_run_trajectory_carries_state():
    calls: list[dict] = []

    async def fake_turn(query, *, thread_id=None, current_spec=None, prior_dev_meta=None):
        calls.append(
            {
                "query": query,
                "thread_id": thread_id,
                "has_spec": current_spec is not None,
                "has_meta": prior_dev_meta is not None,
            }
        )
        if len(calls) == 1:
            return {
                "route": "substantive",
                "update_canvas": True,
                "reply": "Rail landscape overview with TRIG context.",
                "spec": {"tier": "Indicative", "verdict": {"sentence": "Corpus-led view."}},
                "dev_meta": {"lane_mode": "dual"},
            }
        return {
            "route": "substantive",
            "update_canvas": False,
            "reply": "TRIG grants appear in Innovate UK rail programmes.",
            "dev_meta": {"lane_mode": "dual"},
        }

    scenario = {
        "id": "mock_two_turn",
        "name": "mock",
        "turns": [
            {
                "query": "State of play on rail decarbonisation",
                "expect": {"route": "substantive", "update_canvas": True},
            },
            {
                "query": "What about TRIG grants?",
                "expect": {"min_reply_chars": 10},
            },
        ],
    }
    result = await run_trajectory(scenario, run_turn=fake_turn)
    assert result.passed is True
    assert len(calls) == 2
    assert calls[1]["has_spec"] is True
    assert calls[1]["has_meta"] is True


@pytest.mark.asyncio
async def test_optional_scenario_skipped_without_env(monkeypatch):
    monkeypatch.delenv("ATLAS_TRAJECTORY_FORCE_OFFLINE", raising=False)
    scenario = {
        "id": "V05",
        "optional": True,
        "requires_env": "ATLAS_TRAJECTORY_FORCE_OFFLINE",
        "turns": [{"query": "x", "expect": {}}],
    }
    result = await run_trajectory(scenario, run_turn=lambda *a, **k: {})
    assert result.skipped is True
