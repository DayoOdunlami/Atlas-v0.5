"""D4.6b — evidence lane router tests."""
from __future__ import annotations

import os

import pytest

from agents.orchestrator.evidence_router import detect_evidence_gaps, select_lane_mode


@pytest.mark.parametrize(
    "query,outcome,expected",
    [
        ("What is CPC good at in rail?", "orient", "corpus_only"),
        ("Top opportunities for CPC in rail", "connect", "dual"),
        ("Government policy on CCAV safety", "orient", "dual"),
        ("What should CPC do next for funding?", "act", "corpus_primary"),
        ("Back this bid with evidence", "defend", "dual"),
    ],
)
def test_lane_router_fixtures(query: str, outcome: str, expected: str):
    lane = select_lane_mode(query, outcome, {}, has_gaps=False, corpus_opportunity_count=3)
    assert lane == expected


def test_lane_router_respects_gaps():
    lane = select_lane_mode(
        "What is CPC good at in rail?",
        "orient",
        {},
        has_gaps=True,
        corpus_opportunity_count=5,
    )
    assert lane == "corpus_primary"


def test_lane_router_external_intent():
    lane = select_lane_mode(
        "CPC capability overview",
        "orient",
        {"external_search": True},
        has_gaps=False,
        corpus_opportunity_count=0,
    )
    assert lane == "corpus_primary"


def test_detect_gaps_from_match_bench():
    model = {
        "outcome": "diagnose",
        "blocks_data": {
            "match_bench": {"matches": [{"verdict": "GAP"}]},
        },
    }
    assert detect_evidence_gaps(model) is True
