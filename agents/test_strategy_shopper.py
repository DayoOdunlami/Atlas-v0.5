"""Tests for strategy alignment shopping profile."""

from __future__ import annotations

from agents.atlas_v5.source_shopper import floor_shopping_list


def test_strategy_alignment_weights_documents():
    shop = floor_shopping_list(
        "How does CPC align with DfT Better Connected and Innovate UK delivery plan?",
        "diagnose",
    )
    assert shop.corpus.documents_weight >= 0.7
    assert shop.corpus.projects_weight <= 0.3
    assert any("Better Connected" in q for q in shop.corpus.sub_queries)
