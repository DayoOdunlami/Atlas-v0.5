"""
Reconciliation — corpus + external lanes with conflict-as-feature.
"""
from __future__ import annotations

import re
from typing import Any

_TIER_RANK = {"Speculative": 0, "Indicative": 1, "Supported": 2, "Robust": 3}


def _cap_tier(current: str, cap: str) -> str:
    if _TIER_RANK.get(current, 0) <= _TIER_RANK.get(cap, 2):
        return current
    return cap


def _boost_tier(current: str) -> str:
    order = ["Speculative", "Indicative", "Supported", "Robust"]
    try:
        i = order.index(current)
        return order[min(i + 1, len(order) - 1)]
    except ValueError:
        return current


def _policy_conflict(corpus_text: str, external_items: list[dict[str, Any]]) -> dict[str, Any] | None:
    corpus_lower = corpus_text.lower()
    for ext in external_items:
        if ext.get("source_tier") != "primary_gov":
            continue
        title = (ext.get("title") or "").lower()
        if "safety" in title and "autonom" in corpus_lower:
            return {
                "type": "conflict",
                "corpus_signal": "Corpus emphasises autonomy deployment evidence.",
                "external_signal": f"GovUK ({ext.get('publisher', 'gov')}): {ext.get('title', '')[:120]}",
                "note": "Policy direction may constrain how autonomy claims are framed — tension worth noting.",
            }
        if "net zero" in title and "highway" in corpus_lower:
            return {
                "type": "conflict",
                "corpus_signal": "Corpus highlights highways innovation capability.",
                "external_signal": f"Recent policy: {ext.get('title', '')[:120]}",
                "note": "External policy signal may shift priority weighting vs stored corpus claims.",
            }
    return None


def apply_reconciliation(
    model: dict[str, Any],
    external_items: list[dict[str, Any]],
    candidates: list[dict[str, Any]],
    *,
    query: str = "",
) -> dict[str, Any]:
    """Merge external lane into render model without polluting corpus_citations."""
    if not external_items and not candidates:
        return model

    updated = dict(model)
    blocks_data = dict(updated.get("blocks_data") or {})

    updated["external_evidence"] = external_items
    notes: list[dict[str, Any]] = []

    corpus_text = " ".join(
        [
            updated.get("insight_card") or "",
            " ".join(str(v) for v in (updated.get("sections") or {}).values()),
        ]
    )

    if external_items and updated.get("corpus_citations"):
        notes.append({
            "type": "corroborate",
            "message": (
                f"Corpus ({len(updated.get('corpus_citations') or [])} citations) "
                f"supplemented by {len(external_items)} external source(s) — see ProvenanceTrace."
            ),
        })
        tier = updated.get("confidence_tier", "Speculative")
        updated["confidence_tier"] = _boost_tier(str(tier))
    elif external_items and not updated.get("corpus_citations"):
        notes.append({
            "type": "external_primary",
            "message": (
                "No strong corpus match; external signals shown as candidates (Indicative tier cap)."
            ),
        })
        updated["confidence_tier"] = _cap_tier(str(updated.get("confidence_tier", "Speculative")), "Indicative")

    conflict = _policy_conflict(corpus_text, external_items)
    if conflict:
        notes.append(conflict)
        blocks_data["comparison_matrix"] = {
            "items": [
                {
                    "id": "reconcile-corpus",
                    "title": "Corpus signal",
                    "summary": conflict["corpus_signal"],
                },
                {
                    "id": "reconcile-external",
                    "title": "External signal",
                    "summary": conflict["external_signal"],
                },
            ],
        }
        insight = updated.get("insight_card") or ""
        if conflict["note"] not in insight:
            updated["insight_card"] = f"{insight}\n\n⚠ {conflict['note']}".strip()

    if candidates:
        existing = blocks_data.get("opportunity_list", {}).get("items", [])
        merged = list(existing) + candidates
        blocks_data["opportunity_list"] = {"items": merged}
        blocks_data["opportunity_candidates"] = {"items": candidates}
        notes.append({
            "type": "discover",
            "message": (
                f"{len(candidates)} funding signal(s) found online not yet in CPC live_calls — "
                "shown as Opportunity candidates."
            ),
        })
        if not existing:
            updated["headline"] = updated.get("headline") or "Opportunity signals (external discovery)"

    blocks_data["external_evidence"] = {"items": external_items}
    if external_items:
        trace_items = [
            {
                "id": e["id"],
                "claim_id": e["id"],
                "claim_text": e.get("title", ""),
                "verdict": "partial",
                "judgement": f"{e.get('publisher', '')} · {e.get('retrieval_tool', '')} · candidate",
                "evidence_state": "unknown",
                "provenance": "live-gap",
                "url": e.get("url"),
            }
            for e in external_items[:5]
        ]
        blocks_data["provenance_trace"] = {
            "path": ["corpus_search", "external_lane", "reconcile", "citation_guard"],
            "evidence_map_items": trace_items,
        }

    updated["blocks_data"] = blocks_data
    updated["reconciliation_notes"] = notes

    policy_hit = next((e for e in external_items if e.get("source_tier") == "primary_gov"), None)
    if policy_hit and re.search(r"\bpolicy|government|direction\b", query, re.I):
        sections = dict(updated.get("sections") or {})
        sections["policy_signal"] = policy_hit.get("title", "")[:200]
        updated["sections"] = sections

    return updated
