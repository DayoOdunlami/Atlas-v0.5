"""D4.6 integration — harmonized enrichment with flag."""
from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from agents.orchestrator.evidence_schema import make_external_evidence
from agents.orchestrator.harmonized import enrich_with_harmonized_evidence


@pytest.fixture(autouse=True)
def enable_harmonized(monkeypatch):
    monkeypatch.setenv("ATLAS5_HARMONIZED_EVIDENCE_V1", "true")


def test_harmonized_skipped_when_flag_off(monkeypatch):
    monkeypatch.setenv("ATLAS5_HARMONIZED_EVIDENCE_V1", "false")
    model = {"headline": "x", "insight_card": "y", "blocks_data": {}}
    out = enrich_with_harmonized_evidence(model, query="opportunities", outcome="connect")
    assert "external_evidence" not in out


@patch("agents.orchestrator.harmonized.fetch_external_evidence")
def test_harmonized_enriches_connect(mock_fetch):
    mock_fetch.return_value = (
        [
            make_external_evidence(
                title="Innovate UK Connected Places funding",
                url="https://www.gov.uk/test",
                publisher="InnovateUK",
            )
        ],
        [],
    )
    model = {
        "headline": "Opportunities",
        "insight_card": "Corpus routes",
        "confidence_tier": "Indicative",
        "corpus_citations": [{"id": "a"}],
        "blocks_data": {"opportunity_list": {"items": []}},
    }
    out = enrich_with_harmonized_evidence(
        model,
        query="top opportunities for CPC in rail",
        outcome="connect",
    )
    assert out.get("external_evidence")
    assert "external_lane" in str(out.get("blocks_data", {}).get("provenance_trace", {}))
