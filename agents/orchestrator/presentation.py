"""
Presentation composer — chooses how verified content is surfaced (Phase A).

Runs inside format_pass after block selection. Emits presentation_plan consumed
by the frontend progressive canvas and chat composer (Phase C).
"""
from __future__ import annotations

from typing import Any, Literal

ChatSurface = Literal["artifact_primary", "hybrid", "chat_only", "chat_primary"]

# Outcome → preferred dominant visual block ids (first match with data wins)
_OUTCOME_DOMINANT: dict[str, list[str]] = {
    "orient": ["comparison_matrix", "network_map", "opportunity_list", "claim_ledger"],
    "connect": ["opportunity_candidates", "opportunity_list", "transfer_lanes", "match_bench", "comparison_matrix"],
    "diagnose": ["dimension_gap", "match_bench", "transfer_lanes"],
    "act": ["economic_case", "comparison_matrix", "action_plan"],
    "defend": ["claim_ledger", "match_bench", "objection_response"],
}

_EXTERNAL_LED_DOMINANT: list[str] = [
    "opportunity_candidates",
    "opportunity_list",
    "comparison_matrix",
    "external_evidence",
]

_REFERENCE_BLOCKS = frozenset({
    "recommendation_confidence",
    "context_card",
    "provenance_trace",
    "external_evidence",
    "evidence_state_summary",
})

_ALWAYS_HIDDEN = frozenset({"decision_spine", "executive_summary"})

_BLOCK_HUMAN_LABEL: dict[str, str] = {
    "dimension_gap": "Gap matrix",
    "match_bench": "Evidence map",
    "transfer_lanes": "Transfer verdict",
    "opportunity_list": "Opportunity routes",
    "opportunity_candidates": "Live funding signals",
    "external_evidence": "Live web evidence",
    "comparison_matrix": "Comparison view",
    "economic_case": "Economic case",
    "action_plan": "Action plan",
    "claim_ledger": "Claim inventory",
    "objection_response": "Objection responses",
    "network_map": "Landscape map",
}

_OUTCOME_ACTION: dict[str, str] = {
    "orient": "Diagnose fit for a specific call →",
    "connect": "Diagnose fit for the top route →",
    "diagnose": "Build Five Case for this →",
    "act": "Defend this recommendation →",
    "defend": "Strengthen weakest claim →",
}


def _block_has_data(block_id: str, blocks_data: dict[str, Any]) -> bool:
    payload = blocks_data.get(block_id)
    if not payload:
        return False
    if isinstance(payload, dict):
        for key in ("items", "matches", "lanes", "gaps", "rows", "sections", "summary"):
            val = payload.get(key)
            if val:
                return True
        return len(payload) > 1
    return bool(payload)


def _pick_dominant(
    outcome: str,
    block_ids: list[str],
    blocks_data: dict[str, Any],
    *,
    external_led: bool = False,
) -> str | None:
    prefs = list(_OUTCOME_DOMINANT.get(outcome, []))
    if external_led:
        prefs = _EXTERNAL_LED_DOMINANT + prefs
    for bid in prefs:
        if bid in block_ids and _block_has_data(bid, blocks_data):
            return bid
    for bid in block_ids:
        if bid not in _ALWAYS_HIDDEN and bid not in _REFERENCE_BLOCKS and _block_has_data(bid, blocks_data):
            return bid
    return None


def _choose_chat_surface(
    model: dict[str, Any],
    *,
    render_mode: str,
    block_ids: list[str],
    turn_lane: str,
) -> ChatSurface:
    if turn_lane == "clarify":
        return "chat_primary"
    if turn_lane == "refine":
        return "hybrid"
    if render_mode == "document":
        return "chat_primary" if model.get("confidence_tier") == "Speculative" else "hybrid"
    blocks_data = model.get("blocks_data") or {}
    n_blocks = len([b for b in block_ids if b not in _ALWAYS_HIDDEN])
    outcome = model.get("outcome", "orient")
    if n_blocks == 0:
        return "chat_only"
    if n_blocks >= 3 or outcome in ("diagnose", "connect", "act", "defend"):
        return "artifact_primary"
    return "hybrid"


def compose_presentation(
    model: dict[str, Any],
    *,
    query: str = "",
    render_mode: str = "blocks",
    block_ids: list[str] | None = None,
    turn_lane: str = "analyze",
) -> dict[str, Any]:
    """
    Build presentation_plan — above_fold, collapsed, hidden, dominant visual, chat surface.
    """
    _ = query  # reserved for future query-complexity scoring
    blocks_data = model.get("blocks_data") or {}
    ids = list(block_ids or model.get("blocks") or [])
    outcome = str(model.get("outcome") or "orient")

    if render_mode == "document":
        n_citations = len(model.get("corpus_citations") or [])
        return {
            "chat_surface": _choose_chat_surface(model, render_mode=render_mode, block_ids=ids, turn_lane=turn_lane),
            "turn_lane": turn_lane,
            "above_fold": [],
            "collapsed": [],
            "hidden": list(_ALWAYS_HIDDEN),
            "dominant_visual_id": None,
            "primary_action": _primary_action(model, outcome),
            "evidence_collapsed": True,
            "citation_count": n_citations,
            "max_expanded_blocks": 1,
        }

    hidden = [b for b in ids if b in _ALWAYS_HIDDEN or not _block_has_data(b, blocks_data)]
    visible = [b for b in ids if b not in hidden]

    dominant = _pick_dominant(
        outcome,
        visible,
        blocks_data,
        external_led=bool((model.get("retrieval_meta") or {}).get("external_led")),
    )
    above_fold: list[str] = []
    collapsed: list[str] = []
    reference: list[str] = []

    for bid in visible:
        if bid == dominant:
            above_fold.append(bid)
        elif bid in _REFERENCE_BLOCKS:
            reference.append(bid)
        elif bid in _ALWAYS_HIDDEN:
            hidden.append(bid)
        else:
            collapsed.append(bid)

    # Cap expanded surface: dominant + at most one high-value secondary for act/defend
    max_expanded = 1
    if outcome == "act" and "economic_case" in above_fold and "action_plan" in collapsed:
        above_fold.append("action_plan")
        collapsed.remove("action_plan")
        max_expanded = 2

    n_citations = len(model.get("corpus_citations") or [])
    chat_surface = _choose_chat_surface(model, render_mode=render_mode, block_ids=visible, turn_lane=turn_lane)

    return {
        "chat_surface": chat_surface,
        "turn_lane": turn_lane,
        "above_fold": above_fold,
        "collapsed": collapsed,
        "reference": reference,
        "hidden": hidden,
        "dominant_visual_id": dominant,
        "primary_action": _primary_action(model, outcome),
        "evidence_collapsed": n_citations > 0,
        "citation_count": n_citations,
        "max_expanded_blocks": max_expanded,
    }


def _primary_action(model: dict[str, Any], outcome: str) -> str:
    spine = model.get("decision_spine") or {}
    if isinstance(spine, dict) and spine.get("next_action"):
        return str(spine["next_action"])
    blocks_data = model.get("blocks_data") or {}
    ds = blocks_data.get("decision_spine") or {}
    if ds.get("next_action"):
        return str(ds["next_action"])
    return _OUTCOME_ACTION.get(outcome, "Ask a follow-up →")


def apply_presentation_to_render_blocks(
    render_blocks: list[dict[str, Any]],
    plan: dict[str, Any],
) -> list[dict[str, Any]]:
    """Tag each RenderBlock with role/state from presentation_plan."""
    above = set(plan.get("above_fold") or [])
    collapsed = set(plan.get("collapsed") or [])
    hidden = set(plan.get("hidden") or [])
    reference = set(plan.get("reference") or [])
    dominant = plan.get("dominant_visual_id")

    updated: list[dict[str, Any]] = []
    for block in render_blocks:
        bid = block.get("id", "").replace("-", "_")
        b = dict(block)
        if bid in hidden:
            b["state"] = "hidden"
            b["role"] = "archived"
        elif bid in reference:
            b["state"] = "collapsed"
            b["role"] = "reference"
        elif bid in collapsed:
            b["state"] = "collapsed"
            b["role"] = "context"
        elif bid in above or bid == dominant:
            b["state"] = "core"
            b["role"] = "focus"
        else:
            b["state"] = "collapsed"
            b["role"] = "context"
        updated.append(b)
    return updated


def compose_analyze_chat_message(model: dict[str, Any], plan: dict[str, Any]) -> str:
    """Analyze lane — verdict in chat; detail on canvas. No internal block ids."""
    headline = str(model.get("headline") or "Analysis complete")
    blocks_data = model.get("blocks_data") or {}
    insight = (
        model.get("executive_summary")
        or (blocks_data.get("executive_summary") or {}).get("summary")
        or model.get("insight_card")
        or ""
    )
    tier = str(model.get("confidence_tier") or "Indicative")
    n_citations = int(plan.get("citation_count") or 0)
    is_demo = bool(model.get("is_demo_comparison"))

    first_sentence = insight.split(".")[0].strip() + "." if insight and "." in insight else insight

    lines = [f"**{headline}**"]
    if first_sentence and first_sentence.lower() != headline.lower()[: len(first_sentence)]:
        lines.extend(["", first_sentence])

    lines.extend(["", f"_{tier} tier · {n_citations} verified source{'s' if n_citations != 1 else ''}_"])

    if is_demo:
        lines.extend(["", "_⚠ Sample comparison — target call uses demo fixtures; corpus citations are real._"])

    meta = model.get("retrieval_meta") or {}
    corpus_n = int(meta.get("corpus_count") or n_citations)
    ext_n = int(meta.get("external_count") or 0)
    conflicts = int(meta.get("conflict_count") or 0)
    if ext_n > 0 or meta.get("lane_mode") == "dual":
        disclosure = f"Checked {corpus_n} corpus + {ext_n} live source{'s' if ext_n != 1 else ''}"
        if conflicts:
            disclosure += f" · {conflicts} tension{'s' if conflicts != 1 else ''} noted"
        lines.extend(["", f"_{disclosure}_"])
        if meta.get("errors"):
            lines.append(f"_({len(meta['errors'])} retrieval warning(s) — partial results)_")

    surface = plan.get("chat_surface", "hybrid")
    dominant = plan.get("dominant_visual_id")
    if surface == "chat_only" or not dominant:
        return "\n".join(lines)

    label = _BLOCK_HUMAN_LABEL.get(str(dominant), "Detailed analysis")
    lines.extend(["", f"→ **{label}** is on the workbench — supporting detail is collapsed below."])
    return "\n".join(lines)


def compose_refine_chat_message(model: dict[str, Any], plan: dict[str, Any]) -> str:
    """Refine lane — short ack; canvas holds the update."""
    headline = str(model.get("headline") or "Artifact updated")
    return (
        f"Updated **{headline[:80]}** on the workbench.\n\n"
        f"_Confidence: {model.get('confidence_tier', 'Indicative')} · "
        f"{plan.get('citation_count', 0)} sources_"
    )
