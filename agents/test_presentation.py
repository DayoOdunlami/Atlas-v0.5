"""Presentation composer — Phase A/B/C unit tests."""
from __future__ import annotations

from agents.orchestrator.presentation import (
    apply_presentation_to_render_blocks,
    compose_analyze_chat_message,
    compose_presentation,
    compose_refine_chat_message,
)


def _model_with_blocks(outcome: str = "diagnose") -> dict:
    return {
        "outcome": outcome,
        "headline": "CPC should build safety evidence before bidding",
        "insight_card": "Operational trial data is missing. That caps confidence.",
        "confidence_tier": "Indicative",
        "corpus_citations": [{"id": "1"}, {"id": "2"}, {"id": "3"}],
        "blocks_data": {
            "decision_spine": {"summary": "Build evidence first", "next_action": "Collect trial data →"},
            "executive_summary": {"summary": "Operational trial data is missing."},
            "dimension_gap": {"gaps": [{"title": "Safety trials"}]},
            "match_bench": {"matches": [{"criterion": "Safety", "verdict": "GAP"}]},
            "transfer_lanes": {"lanes": [{"transfer_outcome": "evidence-needed"}]},
            "recommendation_confidence": {"tier": "Indicative"},
        },
    }


def test_compose_presentation_picks_dominant_for_diagnose():
    model = _model_with_blocks("diagnose")
    block_ids = list(model["blocks_data"].keys())
    plan = compose_presentation(model, block_ids=block_ids, render_mode="blocks")
    assert plan["dominant_visual_id"] == "dimension_gap"
    assert "dimension_gap" in plan["above_fold"]
    assert "match_bench" in plan["collapsed"]
    assert "decision_spine" in plan["hidden"]


def test_compose_analyze_chat_no_internal_block_names():
    model = _model_with_blocks("diagnose")
    plan = compose_presentation(model, block_ids=list(model["blocks_data"].keys()), render_mode="blocks")
    chat = compose_analyze_chat_message(model, plan)
    assert "transfer_lanes" not in chat
    assert "match_bench" not in chat
    assert "Gap matrix" in chat
    assert "Indicative" in chat


def test_apply_presentation_tags_render_blocks():
    plan = compose_presentation(_model_with_blocks(), block_ids=list(_model_with_blocks()["blocks_data"].keys()))
    blocks = [
        {"id": "dimension-gap", "type": "DimensionGap", "visual": "x", "state": "core", "headline": "Gaps", "content": []},
        {"id": "match-bench", "type": "MatchBench", "visual": "x", "state": "core", "headline": "Map", "content": []},
    ]
    tagged = apply_presentation_to_render_blocks(blocks, plan)
    by_id = {b["id"]: b for b in tagged}
    assert by_id["dimension-gap"]["state"] == "core"
    assert by_id["match-bench"]["state"] == "collapsed"


def test_compose_refine_chat_short():
    model = _model_with_blocks()
    plan = compose_presentation(model, block_ids=list(model["blocks_data"].keys()))
    chat = compose_refine_chat_message(model, plan)
    assert "workbench" in chat.lower()
    assert len(chat) < 400


def test_compose_analyze_chat_discloses_live_research():
    model = _model_with_blocks("connect")
    model["retrieval_meta"] = {
        "corpus_count": 4,
        "external_count": 2,
        "conflict_count": 1,
        "lane_mode": "dual",
        "errors": ["exa: timeout"],
    }
    plan = compose_presentation(model, block_ids=list(model["blocks_data"].keys()), render_mode="blocks")
    chat = compose_analyze_chat_message(model, plan)
    assert "Checked 4 corpus + 2 live sources" in chat
    assert "1 tension" in chat
    assert "retrieval warning" in chat
