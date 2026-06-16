"""
Chat-path integration tests — orchestrator graph end-to-end (no browser).

Distinct from eval/trace.py which bypasses extract_query → intent_router → triage.
"""
from __future__ import annotations

import os
import pytest

CANONICAL = (
    "What evidence does CPC have in smart mobility that would transfer "
    "to the Innovate UK Smart City Challenge?"
)


@pytest.mark.asyncio
async def test_chat_path_canonical_runs_pipeline():
    from agents.eval.chat_path import run_workbench_graph_chat

    out = await run_workbench_graph_chat(CANONICAL)
    assert not out["is_conversational"], out.get("intent")
    assert out["block_count"] >= 1 or out["has_citations"] or len(out["assistant_text"]) > 80, out


@pytest.mark.asyncio
async def test_chat_path_swot_not_generic_menu():
    from agents.eval.chat_path import run_workbench_graph_chat

    out = await run_workbench_graph_chat("Help me build a SWOT for CPC smart mobility portfolio")
    assert not out["is_conversational"]
    assert "Orient" not in out["assistant_text"] or out["block_count"] > 0


@pytest.mark.asyncio
async def test_chat_path_hello_is_instant():
    from agents.eval.chat_path import run_workbench_graph_chat

    out = await run_workbench_graph_chat("hello")
    assert out["is_conversational"]
    assert out["assistant_text"]
    assert out["block_count"] == 0


@pytest.mark.asyncio
async def test_chat_path_cpc_question_not_clarify():
    from agents.eval.chat_path import run_workbench_graph_chat

    out = await run_workbench_graph_chat("What does CPC do in rail decarbonisation?")
    assert not out["is_conversational"]
    assert "more detail" not in out["assistant_text"].lower()


@pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="Haiku intent router requires ANTHROPIC_API_KEY",
)
@pytest.mark.asyncio
async def test_haiku_intent_router_classifies_mixed_greeting():
    from agents.orchestrator.intent_router import route_intent

    decision = route_intent(f"Hi — {CANONICAL}")
    assert decision.route == "pipeline", decision
