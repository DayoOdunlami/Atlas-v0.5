"""
agents.spine.falsification
==========================

Falsification lane — disconfirming search before artifact publish (Sigint-inspired).

Promoted from agents.atlas.falsification per ADR-0001 (D0.3).
Uses external search only; never promotes web results to corpus_citations.

Flag: ATLAS5_FALSIFICATION_LANE_V1 (formerly ATLAS_FALSIFICATION_LANE_V1 —
both are checked for backward compatibility).
"""
from __future__ import annotations

import os
from typing import Any


def _falsification_enabled() -> bool:
    for key in ("ATLAS5_FALSIFICATION_LANE_V1", "ATLAS_FALSIFICATION_LANE_V1"):
        if os.getenv(key, "").strip().lower() in ("1", "true", "yes"):
            return True
    return False


def build_disconfirm_query(query: str, headline: str = "") -> str:
    subject = (headline or query).strip()[:200]
    return (
        f"Evidence against or limitations of: {subject}. "
        "Find contradictions, failed deployments, or sceptical analysis."
    )


def run_falsification_lane(
    *,
    query: str,
    headline: str = "",
    confidence_tier: str = "Speculative",
) -> dict[str, Any]:
    """
    Run disconfirming search when falsification flag is enabled.
    Returns falsification payload; may recommend tier cap.
    """
    if not _falsification_enabled():
        return {
            "status": "skipped",
            "enabled": False,
            "finding_count": 0,
            "findings": [],
            "tier_cap_recommended": None,
        }

    disconfirm_q = build_disconfirm_query(query, headline)
    findings: list[dict[str, Any]] = []

    try:
        from agents.external_search import search_tavily, search_exa

        if os.getenv("TAVILY_API_KEY", "").strip():
            findings = search_tavily(disconfirm_q, limit=5)
        elif os.getenv("EXA_API_KEY", "").strip():
            findings = search_exa(disconfirm_q, limit=4)
    except Exception as exc:
        return {
            "status": "error",
            "enabled": True,
            "query": disconfirm_q,
            "finding_count": 0,
            "findings": [],
            "error": str(exc),
            "tier_cap_recommended": None,
        }

    finding_count = len(findings)
    tier_cap = None
    if finding_count >= 2 and confidence_tier in ("Supported", "Robust"):
        tier_cap = "Indicative"
    elif finding_count >= 1 and confidence_tier == "Robust":
        tier_cap = "Supported"

    return {
        "status": "contradictions_found" if finding_count else "none_found",
        "enabled": True,
        "query": disconfirm_q,
        "finding_count": finding_count,
        "findings": findings[:5],
        "tier_cap_recommended": tier_cap,
    }
