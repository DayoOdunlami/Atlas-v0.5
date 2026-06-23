"""
Universal DecisionSpine — injected on every orchestrator artifact.
"""
from __future__ import annotations

from typing import Any


def build_decision_spine(model: dict[str, Any]) -> dict[str, Any]:
    """Top-level decision_spine dict for coAgent + frontend adapter."""
    blocks = model.get("blocks_data") or {}
    headline = model.get("headline") or "Analysis complete"
    insight = (
        model.get("executive_summary")
        or model.get("insight_card")
        or (blocks.get("executive_summary") or {}).get("summary")
        or headline
    )
    sections = model.get("sections") or {}
    outcome = model.get("outcome") or "orient"
    tier = model.get("confidence_tier") or "Indicative"
    rc = blocks.get("recommendation_confidence") or {}
    score = rc.get("score")
    if score is None and model.get("translation_summary"):
        score = model["translation_summary"].get("readiness_rate")

    next_action = _next_action_for_outcome(outcome, model)
    key_assumption = _key_assumption(model)

    return {
        "decision": sections.get("opportunity") or sections.get("priority_move") or headline[:120],
        "recommendation": headline,
        "summary": insight[:600],
        "confidence_tier": tier,
        "key_assumption": key_assumption,
        "next_action": next_action,
        "score": score if isinstance(score, (int, float)) else None,
    }


def _next_action_for_outcome(outcome: str, model: dict[str, Any]) -> str:
    blocks = model.get("blocks_data") or {}
    plan = (blocks.get("action_plan") or {}).get("items") or []
    if plan:
        first = plan[0]
        return str(first.get("action") or first.get("title") or "Review action plan in artifact")
    defaults = {
        "orient": "Review capability portrait and identify priority sectors.",
        "connect": "Shortlist top opportunity routes and assess transfer conditions.",
        "diagnose": "Address essential gaps before committing to a bid.",
        "act": "Validate economic case assumptions and scope a pilot.",
        "defend": "Prepare objection responses with verified corpus citations.",
    }
    return defaults.get(outcome, "Review the artifact and decide next steps.")


def _key_assumption(model: dict[str, Any]) -> str:
    if model.get("is_demo_comparison"):
        return "Sample passport/spec comparison — not a live funding decision."
    n = len(model.get("corpus_citations") or [])
    if n == 0:
        return "No corpus citations attached — treat as structural scaffold."
    if n < 3:
        return f"Based on {n} corpus project(s) — tier may rise with more evidence."
    return f"Supported by {n} verified corpus citations."


def ensure_decision_spine(model: dict[str, Any]) -> dict[str, Any]:
    """Inject decision_spine on model and blocks_data for format pass."""
    updated = dict(model)
    spine = build_decision_spine(updated)
    updated["decision_spine"] = spine

    blocks_data = dict(updated.get("blocks_data") or {})
    blocks_data["decision_spine"] = {
        "summary": spine["summary"],
        "headline": spine["recommendation"],
        "decision": spine["decision"],
        "confidence_tier": spine["confidence_tier"],
        "next_action": spine["next_action"],
        "key_assumption": spine["key_assumption"],
    }
    updated["blocks_data"] = blocks_data
    if not updated.get("executive_summary"):
        updated["executive_summary"] = spine["summary"]
    return updated
