"""
Clarify lane — answer about the current artifact; canvas unchanged.
"""
from __future__ import annotations

import json
import os
import uuid
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from agents.orchestrator.intent_router import build_artifact_meta_reply


def _prior_model(state: dict[str, Any]) -> dict[str, Any] | None:
    p = state.get("_prior_render_model")
    return p if isinstance(p, dict) else None


def _artifact_json_for_llm(model: dict[str, Any]) -> str:
    blocks = model.get("blocks_data") or {}
    block_ids = model.get("blocks") or list(blocks.keys())
    payload = {
        "outcome": model.get("outcome"),
        "headline": model.get("headline"),
        "executive_summary": model.get("executive_summary") or model.get("insight_card"),
        "insight_card": model.get("insight_card"),
        "confidence_tier": model.get("confidence_tier"),
        "is_demo_comparison": model.get("is_demo_comparison"),
        "sections": model.get("sections"),
        "block_ids": block_ids[:12],
        "corpus_citations": (model.get("corpus_citations") or [])[:8],
        "reconciliation_notes": model.get("reconciliation_notes"),
    }
    return json.dumps(payload, indent=2)[:14000]


def node_clarify_artifact(state: dict[str, Any]) -> dict[str, Any]:
    """Clarify lane — conversational answer from prior artifact; render_model restored."""
    query = (state.get("query") or "").strip()
    prior = _prior_model(state)
    ctx = state.get("_context") or {}

    if prior:
        ctx = {**ctx, "_prior_render_model": prior, "last_headline": prior.get("headline"), "last_outcome": prior.get("outcome")}
    meta = build_artifact_meta_reply(query, ctx)
    if meta:
        return {
            "messages": [AIMessage(content=meta, id=str(uuid.uuid4()))],
            "render_model": prior,
            "_is_conversational": True,
        }

    if not prior:
        return {
            "messages": [AIMessage(
                content="No artifact on screen yet — ask a strategic question first (e.g. rail capabilities, funding fit, evidence gaps).",
                id=str(uuid.uuid4()),
            )],
            "_is_conversational": True,
        }

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        headline = prior.get("headline", "Current artifact")
        summary = prior.get("executive_summary") or prior.get("insight_card") or ""
        return {
            "messages": [AIMessage(
                content=f"**{headline}**\n\n{summary}\n\n_Artifact unchanged — see canvas for blocks and citations._",
                id=str(uuid.uuid4()),
            )],
            "render_model": prior,
            "_is_conversational": True,
        }

    system = """You are Atlas Workbench for Connected Places Catapult.

The user is asking a follow-up about the artifact already on screen.
Answer clearly in markdown. You may use bullets and short tables.
Reference the artifact JSON — headline, outcome, blocks, tier, demo flag.
If the artifact is a sample/demo comparison, say so honestly.
Do NOT claim you cannot see the artifact. Do NOT output JSON.
Do NOT regenerate the full artifact."""

    try:
        from langchain_anthropic import ChatAnthropic

        llm = ChatAnthropic(model=os.getenv("INTENT_MODEL_NAME", "claude-haiku-4-5"), api_key=api_key, max_tokens=1200, temperature=0)
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"Current artifact:\n{_artifact_json_for_llm(prior)}\n\nUser question: {query}"),
        ])
        content = str(response.content).strip()
    except Exception as exc:
        content = f"I couldn't answer that follow-up: {exc}"

    return {
        "messages": [AIMessage(content=content, id=str(uuid.uuid4()))],
        "render_model": prior,
        "_is_conversational": True,
    }
