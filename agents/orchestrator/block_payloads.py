"""
agents.orchestrator.block_payloads
===================================

Materialize frontend-ready RenderBlock dicts from orchestrator blocks_data.

The format pass selects block IDs; this module fills in type, visual, content,
and headline so the TypeScript adapter can map directly to AtlasRenderModel.
"""
from __future__ import annotations

from typing import Any

from agents.registry.blocks import BLOCK_REGISTRY

_TIER_TO_EVIDENCE: dict[str, str] = {
    "Robust": "verified",
    "Supported": "self-reported",
    "Indicative": "inferred",
    "Speculative": "unknown",
}

_VERDICT_TO_EVIDENCE_VERDICT: dict[str, str] = {
    "FIT": "strong",
    "GAP": "partial",
    "RISK": "judgement",
    "MOVE": "not mapped",
}

_BLOCK_TYPE_MAP: dict[str, tuple[str, str]] = {
    "context_card": ("ContextCard", "paired_context_cards"),
    "claim_ledger": ("ClaimLedger", "claim_audit_ledger"),
    "evidence_state_summary": ("EvidenceStateSummary", "evidence_state_donut"),
    "dimension_gap": ("DimensionGap", "source_target_gap_rows"),
    "match_bench": ("MatchBench", "evidence_map_table"),
    "transfer_lanes": ("TransferLanes", "four_lane_board"),
    "recommendation_confidence": ("RecommendationConfidence", "decision_card"),
    "action_plan": ("ActionPlan", "sequenced_action_list"),
    "objection_response": ("ObjectionResponse", "objection_response_cards"),
    "provenance_trace": ("ProvenanceTrace", "provenance_path"),
    "comparison_matrix": ("ComparisonMatrix", "stored_match_list"),
    "opportunity_list": ("OpportunityList", "ranked_table"),
    "network_map": ("NetworkMap", "knowledge_graph"),
    "economic_case": ("EconomicCase", "value_driver_cards"),
}


def _gap_magnitude(score: float) -> str:
    if score >= 0.6:
        return "small"
    if score >= 0.3:
        return "medium"
    if score > 0:
        return "large"
    return "unknown"


def _gap_severity(importance: str, verdict: str) -> str:
    if importance == "essential" and verdict in ("GAP", "MOVE", "RISK"):
        return "critical"
    if verdict in ("GAP", "MOVE"):
        return "significant"
    return "minor"


def _build_match_bench(blocks_data: dict[str, Any]) -> list[dict[str, Any]]:
    raw = blocks_data.get("match_bench", {}).get("matches", [])
    items: list[dict[str, Any]] = []
    for i, m in enumerate(raw):
        tier = m.get("matched_tier", "Speculative")
        items.append({
            "id": f"mb-{i + 1}",
            "claim_id": f"criterion-{i + 1}",
            "claim_text": m.get("matched_claim") or m.get("criterion", ""),
            "verdict": _VERDICT_TO_EVIDENCE_VERDICT.get(m.get("verdict", "MOVE"), "not mapped"),
            "judgement": m.get("rationale", ""),
            "evidence_state": _TIER_TO_EVIDENCE.get(tier, "unknown"),
            "provenance": "stored" if m.get("matched_claim") else "live-gap",
            "confidence_reason": f"{m.get('importance', '')} · {m.get('domain', '')}",
        })
    return items


def _build_transfer_lanes(blocks_data: dict[str, Any]) -> list[dict[str, Any]]:
    lanes = blocks_data.get("transfer_lanes", {}).get("lanes", [])
    items: list[dict[str, Any]] = []
    for i, lane in enumerate(lanes):
        label = lane.get("transfer_label", "evidence-needed")
        items.append({
            "id": f"tl-{i + 1}",
            "claim_text": lane.get("criterion", lane.get("domain", "Criterion")),
            "transfer_outcome": label,
            "evidence_state": "inferred" if label == "needs-reframing" else "unknown",
            "provenance": "derived",
            "note": lane.get("note", ""),
        })
    return items


def _build_dimension_gaps(blocks_data: dict[str, Any]) -> list[dict[str, Any]]:
    dims = blocks_data.get("dimension_gap", {}).get("dimensions", [])
    items: list[dict[str, Any]] = []
    for i, d in enumerate(dims):
        verdict = d.get("verdict", "MOVE")
        score = float(d.get("score", 0))
        importance = d.get("importance", "desirable")
        items.append({
            "id": f"gap-{i + 1}",
            "gap_type": d.get("domain", "capability"),
            "title": d.get("domain", "Gap"),
            "magnitude": _gap_magnitude(score),
            "severity": _gap_severity(importance, verdict),
            "description": d.get("description", d.get("rationale", "")),
            "provenance": "stored" if verdict == "FIT" else "live-gap",
            "evidence_state": "verified" if verdict == "FIT" else "unknown",
            "what_would_change": "" if verdict == "FIT" else "Strengthen evidence or reframe claim.",
        })
    return items


def _build_recommendation_confidence(model: dict[str, Any]) -> dict[str, Any]:
    summary = model.get("translation_summary") or {}
    blocks_data = model.get("blocks_data") or {}
    rc = blocks_data.get("recommendation_confidence") or {}
    ready = summary.get("essential_ready", 0)
    total = summary.get("total_essential", 0)
    score = float(rc.get("score", summary.get("readiness_rate", model.get("confidence_score", 0.5))))
    sections = model.get("sections", {})
    return {
        "decision": sections.get("opportunity") or sections.get("priority_move") or model.get("headline", "Assess"),
        "summary": model.get("insight_card", ""),
        "score": score,
        "confidence_tier": model.get("confidence_tier", "Speculative"),
        "confidence_cap_reason": (
            f"{ready}/{total} essential criteria travel as-is"
            if total
            else f"Based on {len(model.get('corpus_citations') or [])} corpus citations"
        ),
    }


def _build_opportunity_list(blocks_data: dict[str, Any]) -> list[dict[str, Any]]:
    return blocks_data.get("opportunity_list", {}).get("items", [])


def _build_comparison_matrix(blocks_data: dict[str, Any]) -> list[dict[str, Any]]:
    return blocks_data.get("comparison_matrix", {}).get("items", [])


def _build_economic_case(model: dict[str, Any], blocks_data: dict[str, Any]) -> dict[str, Any]:
    ec = blocks_data.get("economic_case", {})
    citations = model.get("corpus_citations") or []
    return {
        "verdict": ec.get("verdict", "insufficient_data"),
        "verdict_summary": model.get("insight_card", ""),
        "confidence_tier": model.get("confidence_tier", "Speculative"),
        "npv_value": ec.get("npv_value"),
        "bcr": ec.get("bcr"),
        "discount_rate": ec.get("discount_rate", 0.035),
        "section_scores": [
            {"case": "strategic", "label": "Strategic", "score": 0.7, "summary": "Mission aligned", "evidence_state": "inferred"},
            {"case": "economic", "label": "Economic", "score": 0.5, "summary": "Qualitative drivers only", "evidence_state": "unknown"},
        ],
        "value_drivers": ec.get("value_drivers", []),
        "assumptions": [{"name": "STPR discount rate", "value": "3.5%", "sensitivity": "high", "evidence_state": "verified"}],
        "sensitivity_note": "Quantified NPV requires additional corpus metrics.",
        "corpus_citations": citations,
        "skills_applied": ["green-book"],
    }


def _build_action_plan(blocks_data: dict[str, Any]) -> list[dict[str, Any]]:
    return blocks_data.get("action_plan", {}).get("items", [])


def _build_claim_ledger(blocks_data: dict[str, Any]) -> list[dict[str, Any]]:
    return blocks_data.get("claim_ledger", {}).get("claims", [])


def _build_objection_response(blocks_data: dict[str, Any]) -> list[dict[str, Any]]:
    return blocks_data.get("objection_response", {}).get("items", [])


def _build_evidence_state_summary(model: dict[str, Any]) -> dict[str, Any]:
    citations = model.get("corpus_citations") or []
    n = len(citations)
    return {
        "counts": {
            "verified": min(1, n),
            "self-reported": max(0, n - 1),
            "inferred": 0,
            "unknown": 0,
            "contested": 0,
        },
        "total_claims": n,
        "cap_reason": f"{n} corpus citations in this analysis",
    }


def _build_provenance_trace(blocks_data: dict[str, Any]) -> dict[str, Any]:
    claims = blocks_data.get("claim_ledger", {}).get("claims", [])
    items = [
        {
            "id": c.get("id", f"pt-{i}"),
            "claim_id": c.get("claim_id", ""),
            "claim_text": c.get("claim_text", ""),
            "verdict": "strong",
            "judgement": c.get("confidence_reason", ""),
            "evidence_state": c.get("evidence_state", "self-reported"),
            "provenance": c.get("provenance", "stored"),
        }
        for i, c in enumerate(claims[:3])
    ]
    return {"path": ["corpus_search", "citation_guard", "artifact_qa"], "evidence_map_items": items}


def _build_context_card(model: dict[str, Any]) -> dict[str, Any]:
    sections = model.get("sections", {})
    entity = sections.get("entity", "Connected Places Catapult")
    opportunity = sections.get("opportunity", model.get("query", "Analysis")[:80])
    return {
        "source": {
            "id": "passport-orchestrator",
            "title": entity.split("(")[0].strip(),
            "summary": model.get("insight_card", "")[:280],
        },
        "target": {
            "id": "target-orchestrator",
            "title": opportunity,
            "funder": sections.get("funder", ""),
            "status": "Open",
            "abstract": model.get("query", ""),
        },
    }


def _content_for_block(block_id: str, model: dict[str, Any], blocks_data: dict[str, Any]) -> Any:
    if block_id == "match_bench":
        return _build_match_bench(blocks_data)
    if block_id == "transfer_lanes":
        return _build_transfer_lanes(blocks_data)
    if block_id == "dimension_gap":
        return _build_dimension_gaps(blocks_data)
    if block_id == "recommendation_confidence":
        return _build_recommendation_confidence(model)
    if block_id == "context_card":
        return _build_context_card(model)
    if block_id == "opportunity_list":
        return _build_opportunity_list(blocks_data)
    if block_id == "comparison_matrix":
        return _build_comparison_matrix(blocks_data)
    if block_id == "economic_case":
        return _build_economic_case(model, blocks_data)
    if block_id == "action_plan":
        return _build_action_plan(blocks_data)
    if block_id == "claim_ledger":
        return _build_claim_ledger(blocks_data)
    if block_id == "objection_response":
        return _build_objection_response(blocks_data)
    if block_id == "evidence_state_summary":
        return _build_evidence_state_summary(model)
    if block_id == "provenance_trace":
        return _build_provenance_trace(blocks_data)
    return []


_FOCUS_BLOCKS = frozenset({
    "transfer_lanes", "match_bench", "dimension_gap",
    "opportunity_list", "comparison_matrix", "economic_case",
    "action_plan", "claim_ledger", "objection_response",
})


def _headline_for_block(block_id: str, model: dict[str, Any]) -> str:
    spec = BLOCK_REGISTRY.get(block_id)
    if block_id == "transfer_lanes":
        return "Four-lane transfer verdict — does CPC evidence travel to the target call?"
    if block_id == "match_bench":
        return "Evidence map — criterion-by-criterion fit assessment"
    if block_id == "dimension_gap":
        return "Capability gaps against requirement dimensions"
    if block_id == "recommendation_confidence":
        return model.get("headline", spec.display_name if spec else block_id)
    if block_id == "context_card":
        return "Source capability × target opportunity"
    if block_id == "opportunity_list":
        return "Corpus opportunities ranked by relevance"
    if block_id == "comparison_matrix":
        return "Project comparison matrix"
    if block_id == "economic_case":
        return "Five Case economic assessment"
    if block_id == "action_plan":
        return "Sequenced action plan"
    if block_id == "claim_ledger":
        return "Claim inventory for scrutiny"
    if block_id == "objection_response":
        return "Anticipated objections and responses"
    if block_id == "evidence_state_summary":
        return "Evidence quality summary"
    if block_id == "provenance_trace":
        return "Evidence provenance path"
    return spec.display_name if spec else block_id.replace("_", " ").title()


def materialize_render_blocks(
    model: dict[str, Any],
    block_ids: list[str],
) -> list[dict[str, Any]]:
    """
    Build full RenderBlock-shaped dicts for the frontend adapter.

    Attaches result to model['render_blocks'] when blocks_data is present.
    """
    blocks_data = model.get("blocks_data") or {}
    if not blocks_data and not block_ids:
        return []

    render_blocks: list[dict[str, Any]] = []
    for block_id in block_ids:
        block_type, visual = _BLOCK_TYPE_MAP.get(block_id, (block_id, "default"))
        role = "focus" if block_id in _FOCUS_BLOCKS else "context"
        if block_id == "recommendation_confidence":
            role = "context"
        if block_id == "context_card":
            role = "context"

        render_blocks.append({
            "id": block_id.replace("_", "-"),
            "type": block_type,
            "visual": visual,
            "state": "core",
            "headline": _headline_for_block(block_id, model),
            "role": role,
            "content": _content_for_block(block_id, model, blocks_data),
        })

    return render_blocks
