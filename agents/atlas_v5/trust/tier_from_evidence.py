"""Multi-lane tier caps — lead lane from shopper weights, not corpus-by-default."""

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
    research_substantive: bool = False,
    research_work_count: int = 0,
    corpus_expected_lead: bool = True,
) -> tuple[str, str]:
    """
    Returns (adjusted_tier, tier_reason).
    When corpus was not the expected lead lane, do not tier-cap on corpus absence.
    """
    corpus_cap = max_tier_for_citation_count(corpus_citation_count)
    web_cap = max_tier_for_citation_count(max(web_verified_count, 1 if web_substantive else 0))
    research_cap = max_tier_for_citation_count(max(research_work_count, 1 if research_substantive else 0))

    if lead_lane == "research" and research_substantive:
        cap = research_cap
        reason = f"research-led tier cap ({research_work_count} OpenAlex works)"
    elif lead_lane == "web" and web_substantive:
        cap = web_cap if not corpus_substantive else _max_tier(corpus_cap, web_cap)
        reason = f"web-led tier cap ({web_verified_count} verified web refs)"
    elif lead_lane == "corpus" and corpus_substantive:
        cap = corpus_cap
        reason = f"corpus-led tier cap ({corpus_citation_count} corpus citations)"
    elif lead_lane == "balanced" and corpus_substantive and web_substantive:
        cap = _max_tier(corpus_cap, web_cap)
        reason = "balanced lanes — tier cap from stronger evidence depth"
    elif web_substantive and not corpus_expected_lead:
        cap = web_cap
        reason = "web-led — corpus was not the expected source lane"
    elif research_substantive and not corpus_expected_lead:
        cap = research_cap
        reason = "research-led — corpus was not the expected source lane"
    elif corpus_substantive:
        cap = corpus_cap
        reason = "corpus substantive — corpus-led cap"
    elif web_substantive:
        cap = web_cap
        reason = "web substantive — single-lane web cap"
    elif research_substantive:
        cap = research_cap
        reason = "research substantive — single-lane research cap"
    elif not corpus_expected_lead and (web_substantive or research_substantive):
        cap = _max_tier(web_cap if web_substantive else "Speculative", research_cap if research_substantive else "Speculative")
        reason = "leading lane substantive; corpus thin but not expected to lead"
    elif corpus_expected_lead and not corpus_substantive:
        cap = "Speculative"
        reason = "corpus expected to lead but lane thin — honest degradation"
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
