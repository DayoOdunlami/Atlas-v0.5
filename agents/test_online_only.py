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


def test_user_accepts_online_only_prefix_with_extra_when_pending():
    meta = {"online_only": {"pending": True, "query": "who are cpc?"}}
    assert user_accepts_online_only("yes.. show me something!", meta)


def test_build_online_only_offer_shape():
    decision = TurnDecision(route="substantive", outcome_hint="orient", source="heuristic")
    out = build_online_only_offer("WeWalk rail", decision)
    assert out["update_canvas"] is False
    assert out["route"] == "clarify"
    assert out["dev_meta"]["online_only"]["pending"] is True
    assert "online-only mode" in out["reply"].lower()
    assert out["dev_meta"].get("quick_replies")


def test_build_chat_only_greeting_no_fake_canvas():
    from agents.atlas_v5.chat_router import build_chat_only_reply

    reply = build_chat_only_reply("hello", None)
    assert "at rest" in reply.lower()
    assert "IncommensurableMagnitudes" not in reply


@pytest.mark.asyncio
async def test_run_turn_response_yes_after_corpus_offer():
    from agents.atlas_v5.run_turn import run_turn_response

    offer = build_online_only_offer(
        "who are cpc?",
        TurnDecision(route="substantive", outcome_hint="orient", source="heuristic"),
    )
    prior = offer["dev_meta"]
    out = await run_turn_response("yes", prior_dev_meta=prior)
    assert out.get("route") == "substantive"
    assert "continue online" not in (out.get("reply") or "").lower()
    assert "yes, continue online" not in (out.get("reply") or "").lower()


@pytest.mark.asyncio
async def test_graph_route_turn_yes_after_corpus_offer():
    from agents.atlas_v5.graph_nodes import route_turn
    from langchain_core.messages import HumanMessage

    offer = build_online_only_offer(
        "who are cpc?",
        TurnDecision(route="substantive", outcome_hint="orient", source="heuristic"),
    )
    state = {
        "query": "yes",
        "messages": [HumanMessage(content="yes")],
        "answer_dev_meta": offer["dev_meta"],
        "turn_pipeline": {"revision": 1, "stage_ms": {}},
    }
    routed = await route_turn(state)
    pipeline = {**state.get("turn_pipeline", {}), **routed.get("turn_pipeline", {})}
    assert pipeline.get("route") == "substantive"
    assert pipeline.get("query_for_turn") == "who are cpc?"
