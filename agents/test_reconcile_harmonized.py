"""D4.6d — reconciliation tests."""
from __future__ import annotations

from agents.orchestrator.evidence_schema import make_external_evidence, make_opportunity_candidate
from agents.orchestrator.reconcile import apply_reconciliation


def test_reconcile_external_only_caps_tier():
    model = {
        "headline": "Test",
        "insight_card": "Corpus thin.",
        "confidence_tier": "Supported",
        "corpus_citations": [],
        "blocks_data": {},
    }
    ext = [
        make_external_evidence(
            title="Innovate UK Smart Mobility funding call",
            url="https://www.gov.uk/government/news/test",
            publisher="InnovateUK",
            source_tier="funder",
        )
    ]
    out = apply_reconciliation(model, ext, [], query="open funding call")
    assert out["confidence_tier"] == "Indicative"
    assert len(out["external_evidence"]) == 1
    assert out["corpus_citations"] == []


def test_reconcile_corroborate_boosts_tier():
    model = {
        "headline": "Test",
        "insight_card": "Strong rail autonomy deployment evidence in corpus.",
        "confidence_tier": "Indicative",
        "corpus_citations": [{"id": "abc", "title": "Rail project"}],
        "blocks_data": {},
    }
    ext = [
        make_external_evidence(
            title="DfT rail innovation strategy",
            url="https://www.gov.uk/government/publications/rail",
            publisher="DfT",
            source_tier="primary_gov",
        )
    ]
    out = apply_reconciliation(model, ext, [], query="rail evidence")
    assert out["confidence_tier"] == "Supported"
    assert out["reconciliation_notes"][0]["type"] == "corroborate"


def test_reconcile_opportunity_candidates_merge():
    model = {
        "headline": "Connect",
        "insight_card": "Routes",
        "confidence_tier": "Indicative",
        "blocks_data": {"opportunity_list": {"items": [{"id": "1", "title": "Corpus call"}]}},
    }
    cand = make_opportunity_candidate(
        title="New Innovate UK Rail Call 2026",
        url="https://example.gov.uk/call",
        funder="InnovateUK",
    )
    out = apply_reconciliation(model, [], [cand], query="opportunities")
    items = out["blocks_data"]["opportunity_list"]["items"]
    assert len(items) == 2
    assert any(i.get("source") == "external" for i in items)


def test_reconcile_conflict_surfaces():
    model = {
        "headline": "Autonomy",
        "insight_card": "CPC has strong autonomy deployment evidence across rail projects.",
        "confidence_tier": "Supported",
        "corpus_citations": [{"id": "x"}],
        "blocks_data": {},
    }
    ext = [
        make_external_evidence(
            title="CCAV safety case guidance update",
            url="https://www.gov.uk/guidance/ccav-safety",
            publisher="CCAV",
            source_tier="primary_gov",
        )
    ]
    out = apply_reconciliation(model, ext, [], query="autonomy policy")
    types = {n.get("type") for n in out.get("reconciliation_notes", [])}
    assert "conflict" in types
    assert "comparison_matrix" in out["blocks_data"]
