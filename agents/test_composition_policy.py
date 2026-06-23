"""Composition policy — recipe vs free-compose routing."""

from __future__ import annotations

from agents.atlas_v5.composition_policy import recommend_worthy_recipe
from agents.atlas_v5.diagnose_assembler import assemble_diagnose_spec
from agents.atlas_v5.j1t1_assembler import assemble_j1t1_spec
from agents.atlas_v5.j1t1_types import FunderBreakdownRow, J1T1CorpusStats
from agents.atlas_v5.network_corpus import NetworkGraphData
from agents.atlas_v5.wide_pass import WidePassResult

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

MOCK_GRAPH = NetworkGraphData(
    nodes=[{"id": "a"}, {"id": "b"}],
    edges=[{"source": "a", "target": "b"}],
    ladder_rung="force-graph",
    edge_density=0.5,
    corpus_count=55,
)


def test_j1t1_orient_gets_recipe_lock():
    skeleton = assemble_j1t1_spec(MOCK_STATS)
    wide = WidePassResult(
        outcome="orient",
        query="State of play on rail decarbonisation in our corpus",
        stats=MOCK_STATS,
    )
    rec = recommend_worthy_recipe(wide.query, wide, skeleton)
    assert rec is not None
    assert rec.recipe == "IncommensurableMagnitudes"


def test_diagnose_gets_gap_matrix_recipe():
    skeleton = assemble_diagnose_spec(MOCK_STATS, query="gaps?")
    wide = WidePassResult(outcome="diagnose", query="gaps?", stats=MOCK_STATS)
    rec = recommend_worthy_recipe(wide.query, wide, skeleton)
    assert rec is not None
    assert rec.recipe == "EvidenceGapMatrix"


def test_connect_network_gets_recipe_when_edges():
    from agents.atlas_v5.connect_assembler import assemble_connect_spec

    skeleton = assemble_connect_spec(MOCK_STATS, MOCK_GRAPH, query="map network")
    wide = WidePassResult(
        outcome="connect",
        query="map network",
        stats=MOCK_STATS,
        graph=MOCK_GRAPH,
    )
    rec = recommend_worthy_recipe(wide.query, wide, skeleton)
    assert rec is not None
    assert rec.recipe == "NetworkMap"


def test_generic_orient_no_lock_without_j1t1_pattern():
    skeleton = assemble_j1t1_spec(MOCK_STATS)
    wide = WidePassResult(
        outcome="orient",
        query="Tell me about hydrogen in general terms",
        stats=MOCK_STATS,
    )
    rec = recommend_worthy_recipe(wide.query, wide, skeleton)
    assert rec is None
