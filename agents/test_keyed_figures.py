"""KeyedFigureIndex tests."""

from __future__ import annotations

from agents.atlas_v5.j1t1_assembler import assemble_j1t1_spec
from agents.atlas_v5.j1t1_types import FunderBreakdownRow, J1T1CorpusStats
from agents.atlas_v5.keyed_figures import build_keyed_index
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


def test_keyed_index_j1t1_stable_keys():
    skeleton = assemble_j1t1_spec(MOCK_STATS)
    wide = WidePassResult(
        outcome="orient",
        query="state of play",
        stats=MOCK_STATS,
        retrieval_meta={"lane_mode": "corpus_only", "external_skipped": True},
    )
    index = build_keyed_index(wide, skeleton)
    assert "stats.project_count" in index.figures
    assert index.figures["stats.project_count"].value == 55
    assert "web.programme_upper_gbp" not in index.figures
    assert index.web_keys_absent_reason is not None


def test_keyed_index_merge_dict_formats_gbp():
    skeleton = assemble_j1t1_spec(MOCK_STATS)
    wide = WidePassResult(
        outcome="orient",
        query="q",
        stats=MOCK_STATS,
        retrieval_meta={"external_skipped": True},
    )
    index = build_keyed_index(wide, skeleton)
    merged = index.as_merge_dict()
    assert merged["stats.project_count"] == "55"
    assert "8.17" in merged["stats.funding_floor_gbp"]
