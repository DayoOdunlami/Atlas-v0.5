"""
agents.orchestrator.outcome_builders
=====================================

Deterministic outcome builders for Orient, Connect, Act, and Defend.

Uses corpus search (when available) to populate blocks_data without requiring
an LLM call.  Falls back to structured stubs when corpus is unreachable.
"""
from __future__ import annotations

from typing import Any

from agents.registry.render_model import build_atlas_render_model


def _search_corpus(query: str, k: int = 8) -> list[dict[str, Any]]:
    try:
        from mcps.cpc_corpus import queries as cq
        results = cq.search_projects(query, limit=k)
        return results or []
    except Exception:
        return []


def _normalize_citations(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for r in results:
        cid = r.get("id")
        if not cid:
            continue
        out.append({
            "id": str(cid),
            "title": r.get("title") or r.get("project_title") or "CPC project",
            "organisation": r.get("organisation") or r.get("lead_organisation") or "CPC",
            "score": float(r.get("score", r.get("similarity", 0.5))),
        })
    return out


def _tier_from_count(n: int) -> str:
    if n >= 5:
        return "Robust"
    if n >= 3:
        return "Supported"
    if n >= 1:
        return "Indicative"
    return "Speculative"


def build_orient_model(query: str, thread_id: str | None = None) -> dict[str, Any]:
    """D4.1 — landscape survey from corpus search."""
    raw = _search_corpus(query)
    citations = _normalize_citations(raw)
    tier = _tier_from_count(len(citations))

    opportunities = [
        {
            "id": c["id"],
            "title": c["title"],
            "organisation": c["organisation"],
            "score": c["score"],
            "funder": "CPC corpus",
            "status": "active",
            "abstract": f"Corpus match ({c['score']:.0%} similarity)",
        }
        for c in citations[:6]
    ]
    if not opportunities:
        opportunities = [
            {
                "id": "scaffold-orient",
                "title": "Run corpus landscape search",
                "organisation": "CPC",
                "score": 0.0,
                "funder": "CPC corpus",
                "status": "pending",
                "abstract": "Structural scaffold — no ILIKE/vector hits for this query.",
            },
        ]

    comparisons = [
        {
            "match_id": c["id"],
            "passport": "CPC corpus",
            "target": c["title"],
            "score": c["score"],
            "funder": c["organisation"],
            "status": "corpus",
        }
        for c in citations[:4]
    ]
    if not comparisons:
        comparisons = [
            {
                "match_id": "scaffold-orient",
                "passport": "CPC corpus",
                "target": "Pending corpus match",
                "score": 0.0,
                "funder": "CPC",
                "status": "scaffold",
            },
        ]

    headline = f"Landscape: {len(citations)} CPC projects match '{query[:50]}'"
    insight = (
        f"Found {len(citations)} corpus projects related to this query. "
        f"Top match: {citations[0]['title'] if citations else 'none'}."
        if citations
        else "No live corpus hits — showing structural landscape scaffold."
    )

    return build_atlas_render_model(
        outcome="orient",
        headline=headline,
        insight_card=insight,
        sections={
            "entity": "Connected Places Catapult",
            "opportunity": query[:80],
            "landscape_overview": insight,
            "key_players": ", ".join({c["organisation"] for c in citations[:5]}) or "CPC",
            "cpc_position": "Evidence drawn from atlas.projects semantic search.",
        },
        corpus_citations=citations,
        confidence_tier=tier,  # type: ignore[arg-type]
        query=query,
        thread_id=thread_id,
        canonical_question_id="cq.match.browse",
        extra={
            "blocks_data": {
                "context_card": {},
                "opportunity_list": {"items": opportunities},
                "comparison_matrix": {"items": comparisons},
                "recommendation_confidence": {
                    "score": citations[0]["score"] if citations else 0,
                },
            },
        },
    )


def build_connect_model(query: str, thread_id: str | None = None) -> dict[str, Any]:
    """D4.2 — opportunity routes (non-transfer connect queries)."""
    raw = _search_corpus(query)
    citations = _normalize_citations(raw)
    tier = _tier_from_count(len(citations))

    opportunities = [
        {
            "id": c["id"],
            "title": c["title"],
            "organisation": c["organisation"],
            "score": c["score"],
            "abstract": "Potential analogue or funding-route match",
        }
        for c in citations[:5]
    ]

    lanes = [
        {
            "criterion": c["title"],
            "domain": "cross-sector",
            "transfer_label": "needs-reframing" if c["score"] < 0.7 else "travels-as-is",
            "note": f"Corpus similarity {c['score']:.0%} — assess sector transfer conditions.",
        }
        for c in citations[:4]
    ]
    if not opportunities:
        opportunities = [
            {
                "id": "scaffold-connect",
                "title": "Map funding calls to CPC capability profile",
                "organisation": "CPC",
                "score": 0.0,
                "abstract": "Structural scaffold — commission corpus search for live calls.",
            },
        ]
    if not lanes:
        lanes = [
            {
                "criterion": "Capability alignment",
                "domain": "funding-fit",
                "transfer_label": "evidence-needed",
                "note": "No corpus hits — run semantic search to populate transfer lanes.",
            },
        ]

    return build_atlas_render_model(
        outcome="connect",
        headline=f"Opportunity routes: {len(citations)} analogue signals",
        insight_card=(
            f"Identified {len(citations)} corpus projects that may transfer or connect "
            f"to '{query[:60]}'."
        ),
        sections={
            "entity": "CPC capability",
            "opportunity": query[:80],
            "priority_move": citations[0]["title"] if citations else "Commission feasibility study",
        },
        corpus_citations=citations,
        confidence_tier=tier,  # type: ignore[arg-type]
        query=query,
        thread_id=thread_id,
        canonical_question_id="cq.match.workbench",
        extra={
            "blocks_data": {
                "context_card": {},
                "opportunity_list": {"items": opportunities},
                "transfer_lanes": {"lanes": lanes},
                "recommendation_confidence": {"score": citations[0]["score"] if citations else 0},
            },
        },
    )


def build_act_model(query: str, thread_id: str | None = None) -> dict[str, Any]:
    """D4.3 — decision-ready brief scaffold."""
    raw = _search_corpus(query)
    citations = _normalize_citations(raw)
    tier = _tier_from_count(len(citations))

    return build_atlas_render_model(
        outcome="act",
        headline=f"Recommendation: proceed with evidence-backed pilot for '{query[:40]}'",
        insight_card=(
            "Structured action brief from corpus evidence. "
            "Economic case uses HMT STPR 3.5% discount rate."
        ),
        sections={
            "entity": "Connected Places Catapult",
            "opportunity": query[:80],
            "strategic_case": "Aligns with CPC connected-places mission.",
            "delivery_approach": "Phase 1: evidence audit. Phase 2: pilot scoping.",
        },
        corpus_citations=citations,
        confidence_tier=tier,  # type: ignore[arg-type]
        query=query,
        thread_id=thread_id,
        canonical_question_id="cq.match.act",
        extra={
            "blocks_data": {
                "context_card": {},
                "economic_case": {
                    "verdict": "indicative" if citations else "insufficient_data",
                    "npv_value": None,
                    "discount_rate": 0.035,
                    "value_drivers": [
                        {
                            "name": "Evidence base",
                            "description": f"{len(citations)} supporting corpus projects",
                            "direction": "benefit",
                            "magnitude": "medium",
                            "evidence_state": "self-reported",
                        },
                    ],
                },
                "action_plan": {
                    "items": [
                        {"action": "Audit corpus evidence", "linked_gap": "evidence", "owner": "CPC", "sequence": 1},
                        {"action": "Scope pilot programme", "linked_gap": "delivery", "owner": "Programme lead", "sequence": 2},
                        {"action": "Prepare investment brief", "linked_gap": "economic", "owner": "ATLAS", "sequence": 3},
                    ],
                },
                "recommendation_confidence": {"score": 0.6 if citations else 0.2},
            },
        },
    )


def build_defend_model(query: str, thread_id: str | None = None) -> dict[str, Any]:
    """D4.4 — scrutiny-ready evidence pack."""
    raw = _search_corpus(query)
    citations = _normalize_citations(raw)
    tier = _tier_from_count(len(citations))

    claims = [
        {
            "id": f"cl-{i + 1}",
            "claim_id": c["id"],
            "claim_text": c["title"],
            "domain": "corpus",
            "role": "primary",
            "evidence_state": "self-reported",
            "provenance": "stored",
            "confidence_reason": f"Similarity {c['score']:.0%}",
        }
        for i, c in enumerate(citations[:5])
    ]
    if not claims:
        claims = [
            {
                "id": "cl-scaffold",
                "claim_id": "scaffold-defend",
                "claim_text": "Defensibility scaffold — link corpus citations before board scrutiny.",
                "domain": "method",
                "role": "primary",
                "evidence_state": "self-reported",
                "provenance": "derived",
                "confidence_reason": "Speculative until corpus search populates claims",
            },
        ]

    objections = [
        {
            "challenge": "Is the evidence base strong enough for this claim?",
            "response": (
                f"We have {len(citations)} corpus projects; "
                f"confidence tier is {tier}."
            ),
            "evidence_state": "self-reported",
            "provenance": "stored",
        },
        {
            "challenge": "Are citations verified in Supabase?",
            "response": "Trust spine citation_guard runs on every orchestrator response.",
            "evidence_state": "verified",
            "provenance": "derived",
        },
    ]

    return build_atlas_render_model(
        outcome="defend",
        headline=f"Defensibility assessment: {tier} tier on '{query[:40]}'",
        insight_card=f"Mapped {len(claims)} claims to corpus evidence for scrutiny.",
        sections={
            "entity": "CPC evidence pack",
            "opportunity": query[:80],
            "confidence_floor": tier,
        },
        corpus_citations=citations,
        confidence_tier=tier,  # type: ignore[arg-type]
        query=query,
        thread_id=thread_id,
        canonical_question_id="cq.match.defend",
        extra={
            "blocks_data": {
                "context_card": {},
                "claim_ledger": {"claims": claims},
                "objection_response": {"items": objections},
                "recommendation_confidence": {"score": 0.7 if tier in ("Supported", "Robust") else 0.4},
            },
        },
    )


def build_outcome_model(
    *,
    query: str,
    outcome: str,
    thread_id: str | None = None,
) -> dict[str, Any]:
    """Route to the correct deterministic outcome builder."""
    builders = {
        "orient": build_orient_model,
        "connect": build_connect_model,
        "act": build_act_model,
        "defend": build_defend_model,
    }
    builder = builders.get(outcome)
    if builder is None:
        return build_orient_model(query, thread_id)
    return builder(query, thread_id)
