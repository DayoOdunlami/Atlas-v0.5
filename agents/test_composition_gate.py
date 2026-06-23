"""Composition merge + gate adversarial tests."""

from __future__ import annotations

from agents.atlas_v5.composition_gate import validate_composition_gate
from agents.atlas_v5.composition_merge import merge_composition_markup
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


def _index():
    skeleton = assemble_j1t1_spec(MOCK_STATS)
    wide = WidePassResult(
        outcome="orient",
        query="q",
        stats=MOCK_STATS,
        retrieval_meta={"external_skipped": True, "lane_mode": "corpus_only"},
    )
    return build_keyed_index(wide, skeleton)


def test_orphan_figure_rejected():
    index = _index()
    source = '<div data-material="owned">Floor: £8.17m</div>'
    merge = merge_composition_markup(source, index)
    gate = validate_composition_gate(source, merge.merged_markup, merge, index)
    assert not gate.passed
    assert any("orphan" in e.lower() for e in gate.errors)


def test_hand_typed_scale_rejected():
    index = _index()
    source = '<rect width="240px" height="20" data-to-scale="true" data-material="owned" />'
    merge = merge_composition_markup(source, index)
    gate = validate_composition_gate(source, merge.merged_markup, merge, index)
    assert not gate.passed


def test_valid_holes_pass():
    index = _index()
    source = (
        '<div data-material="owned" data-key="stats.funding_floor_gbp">'
        "{{stats.funding_floor_gbp}}</div>"
        '<rect width="{{scale(stats.funding_floor_gbp, policy=linear_bar_v1)}}px" '
        'data-to-scale="true" />'
    )
    merge = merge_composition_markup(source, index)
    assert not merge.errors
    gate = validate_composition_gate(source, merge.merged_markup, merge, index)
    assert gate.passed


def test_unknown_key_rejected_at_merge():
    index = _index()
    merge = merge_composition_markup("{{funding.total}}", index)
    assert merge.errors
