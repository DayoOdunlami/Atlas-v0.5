"""
agents.eval.chat_path
===================

Run queries through the **live orchestrator LangGraph** (same path as CopilotKit
AG-UI /workbench), not the shortcut eval trace.

Use for QA without browser automation:
  python -m agents.eval.chat_path "What evidence does CPC have in smart mobility?"
"""
from __future__ import annotations

import uuid
from typing import Any

from langchain_core.messages import AIMessage


def _message_text(msg: Any) -> str:
    if isinstance(msg, AIMessage):
        return str(getattr(msg, "content", "") or "")
    if isinstance(msg, dict):
        return str(msg.get("content") or "")
    return str(msg)


async def run_workbench_graph_chat(
    query: str,
    *,
    thread_id: str | None = None,
) -> dict[str, Any]:
    """
    Invoke orchestrator_graph with AG-UI-style message input.

    Returns assistant text, render_model, routing metadata for assertions.
    """
    from agents.orchestrator.graph import orchestrator_graph
    from langchain_core.messages import HumanMessage

    tid = thread_id or f"chat-path-{uuid.uuid4()}"
    config = {"configurable": {"thread_id": tid}}
    state: dict[str, Any] = {
        "messages": [HumanMessage(content=query)],
    }
    result = await orchestrator_graph.ainvoke(state, config)

    messages = result.get("messages") or []
    assistant_texts = [_message_text(m) for m in messages if _message_text(m)]

    render_model = result.get("render_model") or {}
    blocks = render_model.get("render_blocks") or render_model.get("blocks") or []

    block_types: list[str] = []
    for b in blocks:
        if isinstance(b, dict) and b.get("type"):
            block_types.append(str(b["type"]))
        elif isinstance(b, str):
            from agents.orchestrator.block_payloads import _BLOCK_TYPE_MAP
            mapped = _BLOCK_TYPE_MAP.get(b)
            block_types.append(mapped[0] if mapped else b)

    return {
        "thread_id": tid,
        "query": result.get("query", query),
        "effort": result.get("effort"),
        "outcome": result.get("outcome"),
        "intent": (result.get("_intent") or {}),
        "is_conversational": bool(result.get("_is_conversational")),
        "assistant_text": assistant_texts[-1] if assistant_texts else "",
        "assistant_messages": assistant_texts,
        "render_model": render_model,
        "block_types": block_types,
        "block_count": len(blocks),
        "confidence_tier": render_model.get("confidence_tier"),
        "has_citations": bool(render_model.get("corpus_citations")),
    }


def run_workbench_graph_chat_sync(query: str, **kwargs: Any) -> dict[str, Any]:
    import asyncio

    return asyncio.run(run_workbench_graph_chat(query, **kwargs))


def chat_result_to_eval_trace(out: dict[str, Any], *, query: str | None = None) -> dict[str, Any]:
    """Map live graph chat output to eval trace shape for battery/trajectory runners."""
    import uuid

    from agents.orchestrator.outcome_quality import score_render_model

    q = query or out.get("query", "")
    model = out.get("render_model") or {}
    block_types = out.get("block_types") or []

    quality = None
    if model:
        report = score_render_model(model, query=q, expected_outcome=out.get("outcome"))
        quality = {
            "completeness": report.completeness,
            "evidence_alignment": report.evidence_alignment,
            "block_substance": report.block_substance,
            "matcher_integrity": report.matcher_integrity,
            "overall": report.overall,
            "passed": report.passed,
            "failures": report.failures,
            "passes": report.passes,
        }

    return {
        "run_id": str(uuid.uuid4()),
        "query": q,
        "render_model": model,
        "summary": {
            "outcome": out.get("outcome") or model.get("outcome"),
            "confidence_tier": out.get("confidence_tier") or model.get("confidence_tier"),
            "render_mode": model.get("render_mode"),
            "citation_count": len(model.get("corpus_citations") or []),
            "block_types": block_types,
            "headline": model.get("headline"),
        },
        "quality": quality,
        "live_path": True,
        "is_conversational": out.get("is_conversational"),
    }
