"""Lane-relevance tier honesty — corpus is one peer, not default tier anchor."""

from __future__ import annotations

from agents.atlas_v5.reconcile_spec import apply_peer_tier_rules
from agents.atlas_v5.source_shopper import (
    CorpusAisleShopModel,
    ResearchAisleShopModel,
    ShoppingList,
    WebAisleShopModel,
)
from agents.atlas_v5.trust.lane_relevance import (
    corpus_expected_to_lead,
    is_research_led_query,
)
from agents.atlas_v5.trust.tier_from_evidence import tier_from_multi_lane_evidence


def _research_shopping() -> ShoppingList:
    return ShoppingList(
        outcome="orient",
        reconcile_lead="research",
        corpus=CorpusAisleShopModel(projects_weight=0.15, documents_weight=0.20, sub_queries=[]),
        web=WebAisleShopModel(
            govuk_weight=0.35,
            funders_weight=0.15,
            partners_weight=0.15,
            programmes_weight=0.25,
            sub_queries=[],
            exa_scopes=[],
        ),
        research=ResearchAisleShopModel(
            openalex_weight=0.85,
            sub_queries=["effective climate measures transport academic"],
        ),
        source="floor",
    )


def test_research_query_not_corpus_expected_lead():
    q = "What does academic research say about effective climate measures for transport?"
    assert is_research_led_query(q)
    shopping = _research_shopping()
    assert corpus_expected_to_lead(shopping, q) is False


def test_academic_query_not_capped_speculative_on_corpus_thin():
    shopping = _research_shopping()
    q = "What does academic research say about effective climate measures for transport?"
    assert corpus_expected_to_lead(shopping, q) is False

    tier, boosted, reason = apply_peer_tier_rules(
        "Indicative",
        corpus_substantive=False,
        web_substantive=False,
        research_substantive=True,
        corpus_expected_lead=False,
    )
    assert tier != "Speculative"
    assert "research" in reason.lower()

    final, cap_reason = tier_from_multi_lane_evidence(
        tier,
        corpus_citation_count=0,
        web_verified_count=0,
        corpus_substantive=False,
        web_substantive=False,
        lead_lane="research",
        research_substantive=True,
        research_work_count=5,
        corpus_expected_lead=False,
    )
    assert final in ("Indicative", "Supported", "Robust")
    assert "Speculative" not in cap_reason or final != "Speculative"


def test_corpus_orient_still_degrades_when_corpus_expected():
    shopping = ShoppingList(
        outcome="orient",
        reconcile_lead="corpus",
        corpus=CorpusAisleShopModel(projects_weight=0.75, documents_weight=0.25, sub_queries=[]),
        web=WebAisleShopModel(
            govuk_weight=0.55,
            funders_weight=0.20,
            partners_weight=0.15,
            programmes_weight=0.40,
            sub_queries=[],
            exa_scopes=[],
        ),
        research=ResearchAisleShopModel(openalex_weight=0.2, sub_queries=[]),
        source="floor",
    )
    q = "State of play on rail decarbonisation in our corpus"
    assert corpus_expected_to_lead(shopping, q) is True

    final, reason = tier_from_multi_lane_evidence(
        "Supported",
        corpus_citation_count=0,
        web_verified_count=0,
        corpus_substantive=False,
        web_substantive=False,
        lead_lane="corpus",
        corpus_expected_lead=True,
    )
    assert final == "Speculative"
    assert "corpus expected" in reason.lower()
