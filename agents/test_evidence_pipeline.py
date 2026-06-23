"""Phase F PR2 — evidence pipeline (reconcile-before-build) tests."""
from __future__ import annotations

from unittest.mock import patch

import pytest

from agents.orchestrator.evidence_pipeline import run_harmonized_turn
from agents.orchestrator.evidence_schema import make_external_evidence, make_opportunity_candidate
from agents.orchestrator.retrieval_fabric import EvidenceBag


@pytest.fixture(autouse=True)
def enable_harmonized(monkeypatch):
    monkeypatch.setenv("ATLAS5_HARMONIZED_EVIDENCE_V1", "true")


def _thin_bag() -> EvidenceBag:
    ext = make_external_evidence(
        title="Innovate UK Connected Places funding call",
        url="https://www.gov.uk/test",
        publisher="InnovateUK",
    )
    cand = make_opportunity_candidate(
        title="New Rail Innovation Call 2026",
        url="https://www.gov.uk/call",
        funder="InnovateUK",
    )
    return EvidenceBag(
        corpus_raw=[{"id": "c1", "title": "Corpus rail", "organisation": "CPC"}],
        external=[ext],
        candidates=[cand],
        lane_mode="dual",
    )


@patch("agents.orchestrator.evidence_pipeline.run_retrieval_fabric")
def test_run_harmonized_turn_reconciles_and_meta(mock_fabric):
    mock_fabric.return_value = _thin_bag()

    def build(bag: EvidenceBag) -> dict:
        return {
            "outcome": "connect",
            "headline": "Routes",
            "insight_card": "Corpus routes",
            "confidence_tier": "Indicative",
            "corpus_citations": [{"id": "c1", "title": "Corpus rail"}],
            "blocks_data": {"opportunity_list": {"items": []}},
        }

    model = run_harmonized_turn(
        query="top opportunities for CPC in rail",
        outcome="connect",
        scope=None,
        intent=None,
        effort="analyze",
        build_model=build,
    )

    meta = model.get("retrieval_meta") or {}
    assert meta.get("external_count") == 1
    assert meta.get("candidate_count") == 1
    assert meta.get("external_led") is True
    assert meta.get("corpus_thin") is True
    assert model.get("external_evidence")
    assert model["blocks_data"].get("opportunity_candidates", {}).get("items")


@patch("agents.orchestrator.evidence_pipeline.run_retrieval_fabric")
def test_pre_built_merges_prefetched_corpus(mock_fabric):
    mock_fabric.return_value = EvidenceBag(
        corpus_raw=[{"id": "new", "title": "Fetched", "organisation": "X"}],
        external=[],
        lane_mode="corpus_only",
        external_skipped=True,
    )
    pre = {
        "headline": "VT",
        "insight_card": "Insight",
        "blocks_data": {},
    }
    out = run_harmonized_turn(
        query="transfer rail",
        outcome="diagnose",
        scope=None,
        intent=None,
        effort="analyze",
        build_model=lambda _b: pre,
        pre_built=pre,
    )
    assert out.get("corpus_citations")
    assert out["corpus_citations"][0]["id"] == "new"


@patch("agents.orchestrator.evidence_pipeline.run_retrieval_fabric")
def test_harmonized_flag_off_skips_external(mock_fabric, monkeypatch):
    monkeypatch.setenv("ATLAS5_HARMONIZED_EVIDENCE_V1", "false")
    mock_fabric.return_value = EvidenceBag(corpus_raw=[{"id": "a"}], external_skipped=True)

    out = run_harmonized_turn(
        query="opportunities",
        outcome="connect",
        scope=None,
        intent=None,
        effort="analyze",
        build_model=lambda bag: {"headline": "x", "blocks_data": {}, "corpus_citations": []},
    )
    mock_fabric.assert_called_once()
    assert out.get("retrieval_meta", {}).get("external_skipped") or not out.get("external_evidence")
