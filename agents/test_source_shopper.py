"""Source shopper + reconcile tier tests (Increment 1A)."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from agents.atlas_v5.j1t1_assembler import assemble_j1t1_spec
from agents.atlas_v5.j1t1_types import FunderBreakdownRow, J1T1CorpusStats
from agents.atlas_v5.reconcile_spec import (
    apply_peer_tier_rules,
    lane_corpus_substantive,
    lane_web_substantive,
    reconcile_answer_spec,
)
from agents.atlas_v5.source_shopper import (
    ShoppingListModel,
    build_shopping_list,
    clear_shopper_cache,
    floor_shopping_list,
    shopper_cache_enabled,
)
from agents.orchestrator.retrieval_fabric import EvidenceBag, _fetch_documents


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_shopper_cache()
    yield
    clear_shopper_cache()


def test_shopping_list_schema_requires_both_lanes():
    with pytest.raises(Exception):
        ShoppingListModel.model_validate(
            {
                "reconcile_lead": "corpus",
                "corpus": {"projects_weight": 0.5, "documents_weight": 0.5},
            }
        )


def test_floor_find_path_deemphasises_govuk():
    floor = floor_shopping_list("help me find funding as an SME", "find_path")
    assert floor.web.govuk_weight < floor.web.funders_weight
    assert floor.corpus.documents_weight > floor.corpus.projects_weight
    assert floor.reconcile_lead == "web"


def test_build_shopping_list_no_key_uses_floor():
    lst = build_shopping_list("state of rail decarbonisation", "orient")
    assert lst.source == "floor"
    assert lst.corpus.projects_weight > lst.corpus.documents_weight


def test_shopper_cache_round_trip():
    with patch(
        "agents.atlas_v5.source_shopper.shopper_cache_enabled",
        return_value=True,
    ):
        a = build_shopping_list("rail decarb landscape", "orient")
        b = build_shopping_list("rail decarb landscape", "orient")
        assert a.to_dict() == b.to_dict()


def test_corroboration_boost_only_when_both_substantive():
    tier, boosted, reason = apply_peer_tier_rules(
        "Indicative",
        corpus_substantive=True,
        web_substantive=True,
    )
    assert boosted is True
    assert tier == "Supported"
    assert "both lanes substantive" in reason


def test_no_boost_when_web_thin_despite_corpus_sql():
    tier, boosted, reason = apply_peer_tier_rules(
        "Indicative",
        corpus_substantive=True,
        web_substantive=False,
    )
    assert boosted is False
    assert tier == "Indicative"
    assert "web thin" in reason


def test_no_dual_boost_when_corpus_thin_web_led():
    tier, boosted, reason = apply_peer_tier_rules(
        "Indicative",
        corpus_substantive=False,
        web_substantive=True,
    )
    assert boosted is False
    assert tier == "Supported"
    assert "no dual-peer boost" in reason


def test_lane_substantive_helpers():
    bag = EvidenceBag(project_hit_count=1, document_hit_count=0, external=[{}, {}])
    assert lane_web_substantive(bag)
    assert not lane_corpus_substantive(bag, has_sql_stats=False)
    assert lane_corpus_substantive(bag, has_sql_stats=True)


MOCK_STATS = J1T1CorpusStats(
    project_count=55,
    funding_sum=8_172_702.05,
    null_funding_count=18,
    funded_row_count=37,
    org_count=30,
    live_since_2024=27,
    funders=[FunderBreakdownRow("Innovate UK", 36, 1, 7_903_940.05)],
    top_citations=[],
    queried_at="2026-06-17T00:00:00Z",
)


def test_reconcile_honest_tier_in_meta():
    skeleton = assemble_j1t1_spec(MOCK_STATS)
    bag = EvidenceBag(
        lane_mode="dual",
        project_hit_count=5,
        document_hit_count=0,
        external=[{"title": "a", "url": "http://a"}, {"title": "b", "url": "http://b"}],
    )
    floor = floor_shopping_list("rail decarb", "orient")
    out = reconcile_answer_spec(
        skeleton,
        bag,
        shopping=floor,
        has_sql_stats=True,
    )
    meta = out.reconciliation.retrieval.model_dump()
    assert meta["corroboration_boost"] is True
    assert out.tier == "Robust"


def test_reconcile_no_boost_when_web_thin():
    skeleton = assemble_j1t1_spec(MOCK_STATS)
    bag = EvidenceBag(
        lane_mode="dual",
        project_hit_count=5,
        document_hit_count=0,
        external=[],
    )
    floor = floor_shopping_list("rail decarb", "orient")
    out = reconcile_answer_spec(
        skeleton,
        bag,
        shopping=floor,
        has_sql_stats=True,
    )
    meta = out.reconciliation.retrieval.model_dump()
    assert meta["corroboration_boost"] is False
    assert out.tier == skeleton.tier


def test_document_fetch_wires_knowledge_chunks():
    from mcps.cpc_corpus import queries as cq

    with patch.object(cq, "evidence_for_claim", return_value=[{"title": "doc1", "body": "x"}]):
        rows = _fetch_documents("practitioner messy situation", 3, ["situation text"])
    assert len(rows) == 1
    assert rows[0]["source_type"] == "knowledge_doc"
