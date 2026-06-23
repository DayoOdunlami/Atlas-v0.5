"""
Injected multi-turn session test — WeWalk company → rail transfer (no browser).

Simulates:
  1. Entry bootstrap query (chat-first)
  2. Company clarification
  3. Rail-focused value transfer ask

Also verifies LangGraph thread does not stick on first query.
"""

from __future__ import annotations

import asyncio
import os
import uuid

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from agents.atlas_v5.graph import _extract_query, atlas_v5_graph
from agents.atlas_v5.run_turn import run_turn_response

_RUN_INTEGRATION = os.getenv("RUN_ATLAS_INTEGRATION") == "1"

TURN1 = (
    "I'm working with a company called WeWalk. I'd like to understand their product "
    "and service offering and potential opportunities / value transition, especially "
    "in a rail-focused application."
)
TURN2 = "WeWalk is the company — smart cane for visually impaired people."
TURN3 = (
    "I want to know how WeWalk can translate to grow in the UK innovation landscape, "
    "specifically rail stations and passenger assistance."
)


@pytest.mark.asyncio
async def test_extract_query_prefers_latest_wewalk_message():
    """Unit check — no graph/DB; stale state.query must not win."""
    state = {
        "query": TURN1,
        "messages": [
            HumanMessage(content=TURN1),
            AIMessage(content="Thanks — what's the company name?"),
            HumanMessage(content=TURN3),
        ],
    }
    assert _extract_query(state) == TURN3


@pytest.mark.skipif(not _RUN_INTEGRATION, reason="set RUN_ATLAS_INTEGRATION=1 for live brain")
@pytest.mark.asyncio
async def test_wewalk_three_turn_session_routes():
    """Each turn uses its own message; turn 1 should not update canvas to rail J1T1."""
    current_spec = None
    prior_meta = None
    turns = []

    for i, q in enumerate([TURN1, TURN2, TURN3], start=1):
        out = await run_turn_response(q, current_spec=current_spec, prior_dev_meta=prior_meta)
        turns.append(
            {
                "turn": i,
                "query_head": q[:60],
                "route": out.get("route"),
                "update_canvas": out.get("update_canvas"),
                "reply_head": (out.get("reply") or "")[:120],
                "mode": (out.get("spec") or {}).get("mode") if out.get("spec") else None,
                "verdict_head": (
                    ((out.get("spec") or {}).get("verdict") or {}).get("sentence") or ""
                )[:80],
            }
        )
        if out.get("update_canvas") and out.get("spec"):
            current_spec = out["spec"]
        prior_meta = out.get("dev_meta") or prior_meta

    # Turn 1: chat/clarify — must NOT silently load rail orient demo
    assert turns[0]["update_canvas"] is False, turns[0]
    assert turns[0]["mode"] is None, turns[0]
    assert "rail decarb" not in (turns[0]["reply_head"] or "").lower()

    # All turns should get non-empty replies
    for t in turns:
        assert t["reply_head"], t

    # Turn 3 mentions company + rail — may be chat or substantive; must not repeat turn 1 verbatim
    assert turns[2]["reply_head"] != turns[0]["reply_head"]


@pytest.mark.skipif(not _RUN_INTEGRATION, reason="set RUN_ATLAS_INTEGRATION=1 for live brain")
@pytest.mark.asyncio
async def test_graph_wewalk_thread_second_turn_reply():
    """Integration — needs live Postgres for substantive WeWalk routing."""
    config = {"configurable": {"thread_id": f"wewalk-inject-{uuid.uuid4().hex[:8]}"}}
    await atlas_v5_graph.ainvoke(
        {"messages": [HumanMessage(content=TURN1)]},
        config=config,
    )

    r2 = await atlas_v5_graph.ainvoke(
        {"messages": [HumanMessage(content=TURN3)]},
        config=config,
    )
    reply = ""
    for msg in reversed(r2.get("messages") or []):
        if isinstance(msg, AIMessage):
            reply = str(msg.content)
            break
    assert reply
    assert "rail decarb portfolio" not in reply.lower()


async def _print_live_report() -> None:
    """Manual report when run as __main__."""
    print("=== WeWalk 3-turn injected session (run_turn_response) ===\n")
    current_spec = None
    prior_meta = None
    for i, q in enumerate([TURN1, TURN2, TURN3], start=1):
        out = await run_turn_response(q, current_spec=current_spec, prior_dev_meta=prior_meta)
        print(f"--- Turn {i} ---")
        print(f"Q: {q[:100]}...")
        print(f"route={out.get('route')} update_canvas={out.get('update_canvas')}")
        print(f"reply: {(out.get('reply') or '')[:500]}\n")
        if out.get("spec"):
            spec = out["spec"]
            print(
                f"canvas: mode={spec.get('mode')} "
                f"verdict={(spec.get('verdict') or {}).get('sentence', '')[:100]}\n"
            )
            current_spec = spec
        prior_meta = out.get("dev_meta") or prior_meta


if __name__ == "__main__":
    asyncio.run(_print_live_report())
