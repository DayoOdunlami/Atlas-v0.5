"""OpenAlex research lane tests."""

from __future__ import annotations

from unittest.mock import patch

from agents.atlas_v5.trust.validate_research import (
    build_research_figures,
    fetch_openalex_snapshot,
)


def test_build_research_figures_from_snapshot():
    snapshot = {
        "query": "rail decarbonisation",
        "total_count": 1200,
        "sample_size": 2,
        "works": [
            {"id": "https://openalex.org/W1", "title": "Rail energy", "cited_by_count": 45},
            {"id": "https://openalex.org/W2", "title": "Decarb pathways", "cited_by_count": 12},
        ],
    }
    figs = build_research_figures(snapshot)
    assert figs["research.work_count"].lane == "research"
    assert figs["research.work_count"].value == 1200
    assert figs["research.top_cited_count"].value == 45
    assert figs["research.work_count"].validation_status in ("verified", "candidate")


def test_build_research_figures_empty():
    figs = build_research_figures(None)
    assert figs["research.work_count"].validation_status == "absent"


@patch("agents.atlas_v5.trust.validate_research.httpx.Client")
def test_fetch_openalex_snapshot_parses(mock_client_cls):
    mock_resp = mock_client_cls.return_value.__enter__.return_value.get.return_value
    mock_resp.raise_for_status = lambda: None
    mock_resp.json.return_value = {
        "meta": {"count": 3},
        "results": [
            {
                "id": "https://openalex.org/W99",
                "display_name": "Hydrogen rail",
                "cited_by_count": 8,
                "publication_year": 2023,
            }
        ],
    }
    snap = fetch_openalex_snapshot("hydrogen rail")
    assert snap is not None
    assert snap["total_count"] == 3
    assert snap["works"][0]["title"] == "Hydrogen rail"
