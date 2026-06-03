"""
Deterministic citation / confidence tier guard for ATLAS artifacts.

Caps confidence_tier when corpus evidence is insufficient. No LLM calls.
"""
from __future__ import annotations

import re
from typing import Any

TIER_ORDER = ("Speculative", "Indicative", "Supported", "Robust")
TIER_RANK = {t: i for i, t in enumerate(TIER_ORDER)}

STRONG_HEADLINE_RE = re.compile(
    r"\b("
    r"clearly|definitively|undeniably|proven|conclusive|"
    r"without doubt|established fact|robust evidence shows"
    r")\b",
    re.I,
)


def max_tier_for_citation_count(count: int) -> str:
    """Upper bound on publishable tier given verified corpus citation count."""
    if count <= 0:
        return "Speculative"
    if count <= 2:
        return "Indicative"
    if count <= 4:
        return "Supported"
    return "Robust"


def _cap_tier(tier: str, cap: str) -> str:
    tier = tier if tier in TIER_RANK else "Speculative"
    cap = cap if cap in TIER_RANK else "Speculative"
    return TIER_ORDER[min(TIER_RANK[tier], TIER_RANK[cap])]


def apply_citation_guard(
    *,
    confidence_tier: str,
    citation_count: int,
    headline: str = "",
) -> dict[str, Any]:
    """
    Returns citation_guard payload and adjusted tier.

    status:
      pass — tier unchanged
      warn — tier capped or headline softened
      fail — reserved for hard publish block (same as warn for MVP)
    """
    original = confidence_tier if confidence_tier in TIER_RANK else "Speculative"
    cap = max_tier_for_citation_count(citation_count)
    final = _cap_tier(original, cap)
    reasons: list[str] = []

    if TIER_RANK[original] > TIER_RANK[final]:
        reasons.append(
            f"Only {citation_count} verified corpus citation"
            f"{'s' if citation_count != 1 else ''} — tier capped at {final}"
        )

    headline_out = headline
    if headline and TIER_RANK[final] <= TIER_RANK["Indicative"] and STRONG_HEADLINE_RE.search(headline):
        headline_out = STRONG_HEADLINE_RE.sub("may", headline, count=1)
        reasons.append("Headline softened — strong language inconsistent with evidence tier")

    status = "pass"
    if reasons:
        status = "warn" if final != "Speculative" or citation_count > 0 else "fail"

    return {
        "confidence_tier": final,
        "citation_guard": {
            "status": status,
            "original_tier": original,
            "final_tier": final,
            "citation_count": citation_count,
            "reason": "; ".join(reasons) if reasons else "Tier aligned with citation count",
        },
        "headline": headline_out if headline_out != headline else headline,
        "headline_adjusted": headline_out != headline,
    }
