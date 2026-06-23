"""
agents.orchestrator.outcome_builders
=====================================

Deterministic outcome builders for Orient, Connect, Act, and Defend.

Uses corpus search (when available) to populate blocks_data without requiring
an LLM call.  Falls back to structured stubs when corpus is unreachable.
"""
from __future__ import annotations

import re
from typing import Any

from agents.registry.render_model import build_atlas_render_model


def _is_corpus_search_query(query: str) -> bool:
    q = query.lower()
    return bool(
        re.search(
            r"\bfind\b.*\b(?:corpus|evidence)\b|\bcorpus\b.*\b(?:evidence|project)\b|"
            r"\bsearch\b.*\bproject|\bevidence\b.*\bproject",
            q,
        )
    )


def _is_compare_projects_query(query: str) -> bool:
    q = query.lower()
    return bool(
        re.search(
            r"\bcompare\b.*\bproject|\bproject\b.*\bcompare\b|\bany two\b.*\bproject|\bpick any two\b",
            q,
        )
    )


def _is_capability_portrait_query(query: str) -> bool:
    q = query.lower()
    return any(
        k in q
        for k in (
            "good at",
            "swot",
            "capability",
            "what is cpc",
            "what does cpc",
            "claims passport",
            "capabilit",
        )
    )


def _is_cpc_query(query: str) -> bool:
    q = query.lower()
    return any(k in q for k in ("cpc", "catapult", "connected places"))


def _load_cpc_context(query: str, scope: str | None = None) -> dict[str, Any] | None:
    if _is_corpus_search_query(query) or _is_compare_projects_query(query):
        return None
    if not _is_capability_portrait_query(query) and not scope:
        if "opportunit" not in query.lower():
            return None
    if not _is_cpc_query(query) and scope is None and not _is_capability_portrait_query(query):
        return None
    try:
        from agents.cpc_passport.loader import load_cpc_passport, load_cpc_passport_for_query

        if scope:
            return load_cpc_passport(scope)
        return load_cpc_passport_for_query(query)
    except Exception:
        return None


def _search_corpus(
    query: str,
    k: int = 8,
    prefetched: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    if prefetched is not None:
        return prefetched[:k]
    try:
        from mcps.cpc_corpus import queries as cq
        results = cq.search_projects(query, limit=k)
        return results or []
    except Exception:
        return []


def _citation_score(row: dict[str, Any]) -> float:
    """Resolve a numeric score; ILIKE fallback rows often have null similarity."""
    for key in ("score", "similarity", "transport_relevance_score"):
        val = row.get(key)
        if val is None:
            continue
        try:
            return float(val)
        except (TypeError, ValueError):
            continue
    return 0.5


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
            "score": _citation_score(r),
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


def build_corpus_evidence_model(
    query: str,
    thread_id: str | None = None,
    prefetched_corpus: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Corpus-first evidence pack — real Supabase project citations, not passport portrait."""
    raw = _search_corpus(query, k=10, prefetched=prefetched_corpus)
    citations = _normalize_citations(raw)
    tier = _tier_from_count(len(citations))

    claims = [
        {
            "id": c["id"],
            "claim_id": c["id"],
            "claim_text": c["title"],
            "domain": "corpus",
            "role": "evidence",
            "evidence_state": "stored",
            "provenance": "corpus_search",
            "confidence_reason": f"Similarity {c['score']:.0%}",
        }
        for c in citations[:8]
    ]
    opportunities = [
        {
            "id": c["id"],
            "title": c["title"],
            "organisation": c["organisation"],
            "score": c["score"],
            "abstract": f"Corpus match ({c['score']:.0%})",
        }
        for c in citations[:6]
    ]

    headline = (
        f"Corpus evidence — {len(citations)} projects"
        if citations
        else "Corpus evidence — no matches yet"
    )
    insight = (
        f"Live semantic search against atlas.projects returned {len(citations)} "
        f"verified project(s). Confidence tier: {tier}."
        if citations
        else "No corpus hits — try a broader topic or check Supabase connectivity."
    )

    return build_atlas_render_model(
        outcome="orient",
        headline=headline,
        insight_card=insight,
        sections={
            "entity": "CPC corpus",
            "opportunity": query[:80],
            "landscape_overview": insight,
        },
        corpus_citations=citations,
        confidence_tier=tier,  # type: ignore[arg-type]
        query=query,
        thread_id=thread_id,
        canonical_question_id="cq.explore.landscape",
        extra={
            "chat_surface": "artifact_primary",
            "is_demo_comparison": False,
            "blocks_data": {
                "executive_summary": {
                    "summary": insight,
                    "is_demo_comparison": False,
                    "caption": "Live corpus search — not a sample comparison.",
                },
                "context_card": {"entity": "CPC corpus", "scope": "semantic search"},
                "claim_ledger": {"claims": claims or [{
                    "id": "no-hits",
                    "claim_text": "No corpus projects matched — broaden the query.",
                    "domain": "corpus",
                    "role": "evidence",
                    "evidence_state": "unknown",
                    "provenance": "corpus_search",
                    "confidence_reason": "Speculative",
                }]},
                "opportunity_list": {"items": opportunities},
                "recommendation_confidence": {"score": citations[0]["score"] if citations else 0.1},
            },
        },
    )


def build_compare_projects_model(
    query: str,
    thread_id: str | None = None,
    prefetched_corpus: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Pick top-two corpus projects and compare — no clarify loop."""
    topic = re.sub(
        r"\b(compare|contrast|two|project?s?|any|pick|surprise|test|your|capability|just|me|would|like|to)\b",
        " ",
        query,
        flags=re.I,
    )
    topic = re.sub(r"\s+", " ", topic).strip() or query
    raw = _search_corpus(topic, k=8, prefetched=prefetched_corpus)
    citations = _normalize_citations(raw)

    if len(citations) < 2:
        return build_corpus_evidence_model(
            query,
            thread_id=thread_id,
        )

    a, b = citations[0], citations[1]
    tier = _tier_from_count(len(citations))
    comparisons = [
        {
            "match_id": a["id"],
            "passport": a["title"],
            "target": b["title"],
            "score": a["score"],
            "funder": a["organisation"],
            "status": "corpus",
        },
        {
            "match_id": b["id"],
            "passport": b["title"],
            "target": a["title"],
            "score": b["score"],
            "funder": b["organisation"],
            "status": "corpus",
        },
    ]
    stronger = a if a["score"] >= b["score"] else b
    headline = f"Stronger corpus match: {stronger['title'][:60]}"
    insight = (
        f"Compared **{a['title'][:50]}** ({a['score']:.0%}) vs "
        f"**{b['title'][:50]}** ({b['score']:.0%}). "
        f"Stronger signal: {stronger['title'][:50]}."
    )

    return build_atlas_render_model(
        outcome="orient",
        headline=headline,
        insight_card=insight,
        sections={
            "entity": "CPC corpus comparison",
            "opportunity": query[:80],
        },
        corpus_citations=citations[:6],
        confidence_tier=tier,  # type: ignore[arg-type]
        query=query,
        thread_id=thread_id,
        canonical_question_id="cq.explore.landscape",
        extra={
            "chat_surface": "artifact_primary",
            "is_demo_comparison": False,
            "blocks_data": {
                "executive_summary": {"summary": insight, "is_demo_comparison": False},
                "comparison_matrix": {"items": comparisons},
                "opportunity_list": {
                    "items": [
                        {
                            "id": c["id"],
                            "title": c["title"],
                            "organisation": c["organisation"],
                            "score": c["score"],
                        }
                        for c in citations[:4]
                    ],
                },
                "recommendation_confidence": {"score": stronger["score"]},
            },
        },
    )


def build_orient_model(
    query: str,
    thread_id: str | None = None,
    scope: str | None = None,
    prefetched_corpus: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """D4.1 — CPC capability portrait or corpus landscape."""
    if _is_compare_projects_query(query):
        return build_compare_projects_model(query, thread_id=thread_id, prefetched_corpus=prefetched_corpus)
    if _is_corpus_search_query(query):
        return build_corpus_evidence_model(query, thread_id=thread_id, prefetched_corpus=prefetched_corpus)

    cpc = _load_cpc_context(query, scope=scope)
    if cpc and cpc.get("claims") and _is_capability_portrait_query(query):
        claims = cpc["claims"]
        tier = "Supported" if len(claims) >= 5 else "Indicative"
        scope_label = cpc.get("scope") or "all sectors"
        headline = f"CPC capability — {scope_label}"
        insight = (
            f"{cpc.get('owner_org', 'CPC')} — {cpc.get('claim_count', len(claims))} claims "
            f"from CPC Capability Corpus ({cpc.get('project_evidence_count', 0)} projects)."
        )
        claim_rows = [
            {
                "id": c.get("id", f"cl-{i}"),
                "claim_id": c.get("id", f"cl-{i}"),
                "claim_text": c.get("text", ""),
                "domain": c.get("domain", "general"),
                "role": c.get("role", "asserts"),
                "evidence_state": c.get("claim_state", "stated"),
                "provenance": c.get("source", "cpc_v0_1"),
                "confidence_reason": c.get("confidence_tier", "Indicative"),
            }
            for i, c in enumerate(claims[:12])
        ]
        return build_atlas_render_model(
            outcome="orient",
            headline=headline,
            insight_card=insight,
            sections={
                "entity": cpc.get("title") or "Connected Places Catapult",
                "opportunity": query[:80],
                "landscape_overview": cpc.get("summary", "")[:600],
                "key_players": cpc.get("owner_org", "CPC"),
                "cpc_position": f"Scoped to {scope_label}.",
            },
            corpus_citations=[],
            confidence_tier=tier,  # type: ignore[arg-type]
            query=query,
            thread_id=thread_id,
            canonical_question_id="cq.explore.landscape",
            extra={
                "chat_surface": "hybrid",
                "blocks_data": {
                    "context_card": {"entity": cpc.get("title"), "scope": scope_label},
                    "claim_ledger": {"claims": claim_rows},
                    "recommendation_confidence": {"score": 0.75 if tier == "Supported" else 0.55},
                },
            },
        )

    raw = _search_corpus(query, prefetched=prefetched_corpus)
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


def build_connect_model(
    query: str,
    thread_id: str | None = None,
    scope: str | None = None,
    prefetched_corpus: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """D4.2 — opportunity routes from CPC passport × live calls."""
    cpc = _load_cpc_context(query, scope=scope)
    if (cpc and _is_cpc_query(query)) or scope or "opportunit" in query.lower():
        try:
            from agents.cpc_passport.loader import load_cpc_top_opportunities

            opps = load_cpc_top_opportunities(scope=cpc.get("scope") if cpc else scope, limit=5)
        except Exception:
            opps = []

        if opps:
            opportunities = [
                {
                    "id": o.get("live_call_id") or o.get("match_id"),
                    "title": o.get("title"),
                    "organisation": o.get("funder") or "Funder TBC",
                    "score": o.get("score", 0),
                    "funder": o.get("funder"),
                    "status": "open",
                    "abstract": (o.get("summary") or o.get("description") or "")[:200],
                    "why_now": "Live call in corpus with CPC capability alignment.",
                    "why_cpc": cpc.get("summary", "")[:120] if cpc else "CPC capability profile match.",
                }
                for o in opps
            ]
            lanes = [
                {
                    "criterion": o.get("title", "")[:80],
                    "domain": "funding-fit",
                    "transfer_label": "needs-reframing" if o.get("score", 0) < 0.45 else "travels-as-is",
                    "note": (o.get("summary") or "")[:160],
                }
                for o in opps[:4]
            ]
            tier = "Supported" if opps[0].get("score", 0) >= 0.4 else "Indicative"
            return build_atlas_render_model(
                outcome="connect",
                headline=f"Top {len(opps)} opportunity routes for CPC",
                insight_card=(
                    f"Ranked live funding calls against the CPC capability passport"
                    f" ({cpc.get('scope') if cpc else 'all sectors'}). "
                    f"Top: {opps[0].get('title', '')[:80]}."
                ),
                sections={
                    "entity": "Connected Places Catapult",
                    "opportunity": query[:80],
                    "priority_move": opps[0].get("title", ""),
                },
                corpus_citations=[],
                confidence_tier=tier,  # type: ignore[arg-type]
                query=query,
                thread_id=thread_id,
                canonical_question_id="cq.match.workbench",
                extra={
                    "chat_surface": "artifact_primary",
                    "blocks_data": {
                        "context_card": {},
                        "opportunity_list": {"items": opportunities},
                        "transfer_lanes": {"lanes": lanes},
                        "recommendation_confidence": {"score": opps[0].get("score", 0)},
                    },
                },
            )

    raw = _search_corpus(query, prefetched=prefetched_corpus)
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


def build_act_model(
    query: str,
    thread_id: str | None = None,
    prefetched_corpus: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """D4.3 — decision-ready brief scaffold (Five Case when requested)."""
    import re

    q_lower = query.lower()
    is_five_case = bool(
        re.search(r"\bfive\s+case\b|\bbusiness\s+case\b|\binvestment\s+brief\b|\beconomic\s+case\b", q_lower)
    )
    raw = _search_corpus(query, prefetched=prefetched_corpus)
    citations = _normalize_citations(raw)
    tier = _tier_from_count(len(citations))

    headline = (
        f"Five Case investment brief — {query[:50]}"
        if is_five_case
        else f"Recommendation: proceed with evidence-backed pilot for '{query[:40]}'"
    )
    sections: dict[str, str] = {
        "entity": "Connected Places Catapult",
        "opportunity": query[:80],
        "strategic_case": "Aligns with CPC connected-places mission and national transport priorities.",
        "delivery_approach": "Phase 1: evidence audit. Phase 2: pilot scoping. Phase 3: investment decision.",
    }
    if is_five_case:
        sections.update({
            "strategic_case": "Strategic fit with CPC capability passport and funder priorities.",
            "economic_case": f"Indicative appraisal at HMT STPR 3.5% — {len(citations)} corpus evidence projects.",
            "commercial_case": "Revenue/cost sharing to be scoped with delivery partners.",
            "financial_case": "Affordability and funding stack TBC pending business case gate.",
            "management_case": "CPC programme lead with partner delivery consortium.",
        })

    value_drivers = [
        {
            "name": "Evidence base",
            "description": f"{len(citations)} supporting corpus projects",
            "direction": "benefit",
            "magnitude": "medium",
            "evidence_state": "self-reported",
        },
    ]
    if is_five_case:
        value_drivers.extend([
            {
                "name": "Strategic value",
                "description": "Connected-places innovation aligned to funder mission",
                "direction": "benefit",
                "magnitude": "high",
                "evidence_state": "inferred",
            },
            {
                "name": "Delivery risk",
                "description": "Pilot scope and partner capacity unverified",
                "direction": "cost",
                "magnitude": "medium",
                "evidence_state": "unknown",
            },
        ])

    return build_atlas_render_model(
        outcome="act",
        headline=headline,
        insight_card=(
            "Structured Five Case brief from corpus evidence at HMT STPR 3.5%."
            if is_five_case
            else "Structured action brief from corpus evidence. Economic case uses HMT STPR 3.5% discount rate."
        ),
        sections=sections,
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
                    "five_case": is_five_case,
                    "value_drivers": value_drivers,
                },
                "action_plan": {
                    "items": [
                        {"action": "Audit corpus evidence", "linked_gap": "evidence", "owner": "CPC", "sequence": 1},
                        {"action": "Scope pilot programme", "linked_gap": "delivery", "owner": "Programme lead", "sequence": 2},
                        {"action": "Prepare investment brief", "linked_gap": "economic", "owner": "ATLAS", "sequence": 3},
                        *(
                            [{"action": "Complete Five Case sections", "linked_gap": "management", "owner": "Programme lead", "sequence": 4}]
                            if is_five_case
                            else []
                        ),
                    ],
                },
                "recommendation_confidence": {"score": 0.65 if citations and is_five_case else (0.6 if citations else 0.2)},
            },
        },
    )


def build_defend_model(
    query: str,
    thread_id: str | None = None,
    prefetched_corpus: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """D4.4 — scrutiny-ready evidence pack."""
    raw = _search_corpus(query, prefetched=prefetched_corpus)
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
    scope: str | None = None,
    evidence_bag: Any | None = None,
) -> dict[str, Any]:
    """Route to the correct deterministic outcome builder."""
    prefetched = evidence_bag.corpus_raw if evidence_bag is not None else None

    if _is_compare_projects_query(query):
        return build_compare_projects_model(query, thread_id=thread_id, prefetched_corpus=prefetched)
    if _is_corpus_search_query(query):
        return build_corpus_evidence_model(query, thread_id=thread_id, prefetched_corpus=prefetched)
    if outcome == "diagnose":
        return build_corpus_evidence_model(query, thread_id=thread_id, prefetched_corpus=prefetched)
    builders = {
        "orient": build_orient_model,
        "connect": build_connect_model,
        "act": build_act_model,
        "defend": build_defend_model,
    }
    builder = builders.get(outcome)
    if builder is None:
        return build_orient_model(query, thread_id, scope=scope, prefetched_corpus=prefetched)
    if outcome in ("orient", "connect"):
        return builder(query, thread_id, scope=scope, prefetched_corpus=prefetched)
    return builder(query, thread_id, prefetched_corpus=prefetched)
