"""Multi-lane tier caps — no corpus-only ceiling when web leads."""

from __future__ import annotations

from agents.spine.citation_guard import TIER_ORDER, _cap_tier, max_tier_for_citation_count


def tier_from_multi_lane_evidence(
    tier: str,
    *,
    corpus_citation_count: int,
    web_verified_count: int,
    corpus_substantive: bool,
    web_substantive: bool,
    lead_lane: str,
) -> tuple[str, str]:
    """
    Returns (adjusted_tier, tier_reason).
    Uses the leading lane's evidence depth for the cap when lanes are asymmetric.
    """
    corpus_cap = max_tier_for_citation_count(corpus_citation_count)
    web_cap = max_tier_for_citation_count(max(web_verified_count, 1 if web_substantive else 0))

    if lead_lane == "web" and web_substantive:
        cap = web_cap if not corpus_substantive else _max_tier(corpus_cap, web_cap)
        reason = f"web-led tier cap ({web_verified_count} verified web refs)"
    elif lead_lane == "corpus" and corpus_substantive:
        cap = corpus_cap
        reason = f"corpus-led tier cap ({corpus_citation_count} corpus citations)"
    elif lead_lane == "balanced" and corpus_substantive and web_substantive:
        cap = _max_tier(corpus_cap, web_cap)
        reason = "balanced lanes — tier cap from stronger evidence depth"
    else:
        cap = corpus_cap if corpus_substantive else web_cap
        reason = "single-lane signal tier cap"

    final = _cap_tier(tier, cap)
    if final != tier:
        return final, f"{reason}; capped from {tier} to {final}"
    return tier, reason


def _max_tier(a: str, b: str) -> str:
    a = a if a in TIER_ORDER else "Speculative"
    b = b if b in TIER_ORDER else "Speculative"
    return TIER_ORDER[max(TIER_ORDER.index(a), TIER_ORDER.index(b))]
