"""
Thread context assembler — bounded memory for multi-turn workbench sessions.

Injected before triage on every turn. No Supabase round-trip.
"""
from __future__ import annotations

from typing import Any


def build_artifact_summary(model: dict[str, Any] | None) -> dict[str, Any]:
    """Slim summary pushed from frontend coAgent state each turn."""
    if not model or not isinstance(model, dict):
        return {}
    blocks_data = model.get("blocks_data") or {}
    block_ids = model.get("blocks") or list(blocks_data.keys())
    es = (
        model.get("executive_summary")
        or (blocks_data.get("executive_summary") or {}).get("summary")
        or (blocks_data.get("decision_spine") or {}).get("summary")
        or model.get("insight_card")
        or ""
    )
    return {
        "headline": model.get("headline", ""),
        "outcome": model.get("outcome", ""),
        "confidence_tier": model.get("confidence_tier", ""),
        "is_demo_comparison": bool(model.get("is_demo_comparison")),
        "executive_summary": es[:600] if es else "",
        "block_ids": block_ids[:16],
        "citation_count": len(model.get("corpus_citations") or []),
        "artifact_id": model.get("artifact_id") or model.get("thread_id") or "",
    }


def assemble_thread_context(state: dict[str, Any]) -> dict[str, Any]:
    """
    Build context_packet fragment from LangGraph state + prior render_model.

    Returns dict merged into state as `_context`.
    """
    messages = state.get("messages") or []
    prior_model = state.get("_prior_render_model") or state.get("render_model")
    artifact_summary = state.get("artifact_summary") or build_artifact_summary(
        prior_model if isinstance(prior_model, dict) else None
    )

    # Last N user/assistant snippets
    history: list[dict[str, str]] = []
    for msg in messages[-8:]:
        role = getattr(msg, "type", None) or (msg.get("role") if isinstance(msg, dict) else "unknown")
        content = getattr(msg, "content", None) if not isinstance(msg, dict) else msg.get("content")
        if isinstance(content, list):
            content = " ".join(str(c) for c in content)
        text = str(content or "")[:400]
        if not text:
            continue
        r = "user" if role in ("human", "user") else "assistant"
        history.append({"role": r, "content": text})

    prior_citations: list[dict[str, Any]] = []
    if isinstance(prior_model, dict):
        prior_citations = list(prior_model.get("corpus_citations") or [])[:12]

    intent_hist = state.get("_intent_history") or []
    if state.get("_intent"):
        intent_hist = (intent_hist + [state["_intent"]])[-5:]

    return {
        "thread_id": state.get("thread_id"),
        "lens": state.get("lens") or "CPC",
        "active_agent": "workbench",
        "prior_citations": prior_citations,
        "session_history": history,
        "last_outcome": prior_model.get("outcome") if isinstance(prior_model, dict) else None,
        "last_headline": prior_model.get("headline") if isinstance(prior_model, dict) else None,
        "artifact_summary": artifact_summary,
        "active_scope": state.get("active_scope"),
        "pending_clarify": state.get("_pending_clarify"),
        "_prior_render_model": prior_model if isinstance(prior_model, dict) else None,
    }


def node_assemble_context(state: dict[str, Any]) -> dict[str, Any]:
    ctx = assemble_thread_context(state)
    updates: dict[str, Any] = {"_context": ctx}

    # Clarify-and-resume: if user answered a pending clarify, clear it
    if state.get("_pending_clarify") and state.get("query"):
        updates["_pending_clarify"] = None
        updates["effort"] = state.get("effort") or "analyze"

    # Persist scope across turns when detected
    from agents.cpc_passport.loader import resolve_scope_from_query

    q = state.get("query") or ""
    scope = resolve_scope_from_query(q)
    if scope:
        updates["active_scope"] = scope
    elif ctx.get("active_scope"):
        updates["active_scope"] = ctx["active_scope"]

    return updates


def merge_render_models(
    prior: dict[str, Any] | None,
    new: dict[str, Any],
    *,
    outcome: str,
) -> dict[str, Any]:
    """
    Session artifact merge — replace on outcome change or analyze lane.

    Refine lane patches in place via refine_artifact.py; analyze always replaces.
    """
    if not prior or not isinstance(prior, dict):
        return new
    prior_outcome = prior.get("outcome")
    new_outcome = new.get("outcome") or outcome
    if prior_outcome and new_outcome and prior_outcome != new_outcome:
        return new
    if new.get("refined"):
        return new
    # Same outcome: replace blocks (no accumulation pollution)
    merged = dict(new)
    if prior.get("thread_id") and not merged.get("thread_id"):
        merged["thread_id"] = prior.get("thread_id")
    return merged
