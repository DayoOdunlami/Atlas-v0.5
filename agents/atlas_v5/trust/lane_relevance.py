"""Shopper-weighted lane relevance — corpus is one peer, not the default tier anchor."""

from __future__ import annotations

import re

from agents.atlas_v5.source_shopper import ReconcileLead, ShoppingList

_ACADEMIC_QUERY_RE = re.compile(
    r"\b(academic|literature|peer[- ]review|research paper|systematic review|"
    r"openalex|journal|evidence base|what does research say)\b",
    re.I,
)
_CLIMATE_MEASURES_RE = re.compile(
    r"\b(climate measure|effective climate|climate mitigation|decarbonisation measure)\b",
    re.I,
)


def is_research_led_query(query: str) -> bool:
    q = query or ""
    return bool(_ACADEMIC_QUERY_RE.search(q) or _CLIMATE_MEASURES_RE.search(q))


def corpus_lane_emphasis(shopping: ShoppingList | None) -> float:
    if shopping is None:
        return 0.75
    return (shopping.corpus.projects_weight + shopping.corpus.documents_weight) / 2.0


def web_lane_emphasis(shopping: ShoppingList | None) -> float:
    if shopping is None:
        return 0.35
    w = shopping.web
    return (w.govuk_weight + w.funders_weight + w.partners_weight + w.programmes_weight) / 4.0


def research_lane_emphasis(shopping: ShoppingList | None) -> float:
    if shopping is None:
        return 0.2
    return shopping.research.openalex_weight


def corpus_expected_to_lead(shopping: ShoppingList | None, query: str = "") -> bool:
    """
    True when the shopper profile expects corpus to anchor tier/honesty for this turn.
    Near-zero corpus weight with reconcile_lead=research|web means corpus absence is not a fault.
    """
    if shopping is None:
        return True
    lead: ReconcileLead = shopping.reconcile_lead
    if lead == "corpus":
        return True
    if lead in ("web", "research"):
        return False
    if is_research_led_query(query) and research_lane_emphasis(shopping) >= corpus_lane_emphasis(
        shopping
    ):
        return False
    return corpus_lane_emphasis(shopping) >= max(
        web_lane_emphasis(shopping),
        research_lane_emphasis(shopping),
    )


def lead_lane_from_shopper(shopping: ShoppingList | None, query: str = "") -> ReconcileLead:
    """Narrative lead from shopper weights when reconcile_lead is balanced."""
    if shopping is None:
        return "corpus"
    if shopping.reconcile_lead != "balanced":
        return shopping.reconcile_lead
    if is_research_led_query(query):
        return "research"
    c, w, r = (
        corpus_lane_emphasis(shopping),
        web_lane_emphasis(shopping),
        research_lane_emphasis(shopping),
    )
    if r >= max(c, w):
        return "research"
    if w >= c:
        return "web"
    return "corpus"
