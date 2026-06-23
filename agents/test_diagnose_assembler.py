"""Diagnose assembler tests."""

from __future__ import annotations

from agents.atlas_v5.diagnose_assembler import assemble_diagnose_spec
from agents.atlas_v5.j1t1_types import FunderBreakdownRow, J1T1CorpusStats

MOCK_STATS = J1T1CorpusStats(
    project_count=55,
    funding_sum=8_172_702.05,
    null_funding_count=18,
    funded_row_count=37,
    org_count=30,
    live_since_2024=27,
    funders=[
        FunderBreakdownRow("Innovate UK", 36, 1, 7_903_940.05),
        FunderBreakdownRow("EPSRC", 3, 3, 0),
    ],
    top_citations=[],
    queried_at="2026-06-17T00:00:00Z",
)


def test_diagnose_spec_shape():
    spec = assemble_diagnose_spec(
        MOCK_STATS,
        query="What evidence gaps exist?",
        object_label="Rail decarbonisation",
    )
    assert spec.mode == "Diagnose"
    assert spec.instrument is not None
    assert spec.instrument.recipe == "EvidenceGapMatrix"
    dims = spec.instrument.data.get("dimensions") or []
    assert len(dims) >= 4
    assert any(d["verdict"] == "GAP" for d in dims)
