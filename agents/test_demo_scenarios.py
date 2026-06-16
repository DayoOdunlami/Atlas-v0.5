"""
Five MVP demo scenarios — multi-turn and single-turn dynamic routing.

Run: pytest agents/test_demo_scenarios.py -q
"""
from __future__ import annotations

import pytest

from agents.eval.chat_path import run_workbench_graph_chat


@pytest.mark.asyncio
async def test_s1_sector_deep_dive_rail():
    out = await run_workbench_graph_chat("What is CPC good at in rail?")
    assert not out["is_conversational"], out
    assert out["outcome"] in ("orient", "diagnose", "connect")
    assert out["block_count"] >= 1 or len(out["assistant_text"]) > 60


@pytest.mark.asyncio
async def test_s2_connect_opportunities():
    out = await run_workbench_graph_chat(
        "What are the top opportunity routes for CPC in rail?"
    )
    assert not out["is_conversational"]
    assert out["outcome"] in ("connect", "orient", "diagnose")


@pytest.mark.asyncio
async def test_s3_canonical_value_translation():
    out = await run_workbench_graph_chat(
        "What evidence does CPC have in smart mobility that would transfer "
        "to the Innovate UK Smart City Challenge?"
    )
    assert not out["is_conversational"]
    assert out["block_count"] >= 1 or out["has_citations"]


@pytest.mark.asyncio
async def test_s4_act_next_move():
    out = await run_workbench_graph_chat(
        "What should CPC do next to pursue rail innovation funding?"
    )
    assert not out["is_conversational"]
    assert out["outcome"] in ("act", "connect", "diagnose", "orient")


@pytest.mark.asyncio
async def test_s5_defend_pushback():
    out = await run_workbench_graph_chat(
        "We're considering a major rail bid — back it up or push back with evidence"
    )
    assert not out["is_conversational"]
    assert out["outcome"] in ("defend", "act", "diagnose", "connect")


@pytest.mark.asyncio
async def test_multi_turn_memory_same_thread():
    tid = "demo-scenario-multi"
    r1 = await run_workbench_graph_chat("What is CPC good at in rail?", thread_id=tid)
    r2 = await run_workbench_graph_chat("Compare that to highways", thread_id=tid)
    assert not r1["is_conversational"]
    assert not r2["is_conversational"]


@pytest.mark.asyncio
async def test_cpc_passport_loader_has_claims():
    from agents.cpc_passport.loader import load_cpc_passport

    data = load_cpc_passport("Rail")
    assert data.get("passport_id")
    assert len(data.get("claims") or []) >= 1
