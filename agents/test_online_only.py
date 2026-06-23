"""Online-only mode when corpus DB is unreachable."""

from __future__ import annotations

import pytest

from agents.atlas_v5.online_only import (
    build_online_only_offer,
    user_accepts_online_only,
)
from agents.atlas_v5.turn_classifier import TurnDecision


def test_user_accepts_online_only_explicit():
    meta = {
        "online_only": {
            "pending": True,
            "query": "WeWalk rail opportunities",
        }
    }
    assert user_accepts_online_only("yes, continue online", meta)
    assert user_accepts_online_only("ok continue online only", meta)


def test_user_accepts_online_only_short_when_pending():
    meta = {"online_only": {"pending": True, "query": "WeWalk"}}
    assert user_accepts_online_only("yes", meta)
    assert user_accepts_online_only("continue", meta)


def test_user_accepts_online_only_not_without_pending():
    assert not user_accepts_online_only("yes", None)


def test_build_online_only_offer_shape():
    decision = TurnDecision(route="substantive", outcome_hint="orient", source="heuristic")
    out = build_online_only_offer("WeWalk rail", decision)
    assert out["update_canvas"] is False
    assert out["route"] == "clarify"
    assert out["dev_meta"]["online_only"]["pending"] is True
    assert "online-only mode" in out["reply"].lower()
