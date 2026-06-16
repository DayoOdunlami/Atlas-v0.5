"""
Thread context assembler — bounded memory for multi-turn workbench sessions.

Injected before triage on every turn. No Supabase round-trip.
"""
from __future__ import annotations

from typing import Any


def assemble_thread_context(state: dict[str, Any]) -> dict[str, Any]:
    """
    Build context_packet fragment from LangGraph state + prior render_model.

    Returns dict merged into state as `_context`.
    """
    messages = state.get("messages") or []
    prior_model = state.get("_prior_render_model") or state.get("render_model")

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
        "active_scope": state.get("active_scope"),
        "pending_clarify": state.get("_pending_clarify"),
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
    Stateful artifact: augment prior blocks_data rather than replace wholesale.
    """
    if not prior or not isinstance(prior, dict):
        return new

    merged = dict(new)
    prior_blocks = prior.get("blocks_data") or {}
    new_blocks = new.get("blocks_data") or {}
    combined_blocks = {**prior_blocks, **new_blocks}

    # Carry forward citations union
    seen: set[str] = set()
    citations: list[dict[str, Any]] = []
    for c in (prior.get("corpus_citations") or []) + (new.get("corpus_citations") or []):
        cid = str(c.get("id", ""))
        if cid and cid not in seen:
            seen.add(cid)
            citations.append(c)

    merged["blocks_data"] = combined_blocks
    merged["corpus_citations"] = citations
    merged["prior_outcome"] = prior.get("outcome")
    merged["augmented"] = True
    return merged
