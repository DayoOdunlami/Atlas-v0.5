"""Judgement prose merge — {{key}} holes must not reach the UI."""

from __future__ import annotations

from agents.atlas_v5.composition_merge import (
    merge_keyed_figures_in_text,
    strip_unresolved_key_holes,
)
from agents.atlas_v5.connect_assembler import assemble_connect_spec
from agents.atlas_v5.j1t1_assembler import assemble_j1t1_spec
from agents.atlas_v5.j1t1_types import FunderBreakdownRow, J1T1CorpusStats
from agents.atlas_v5.judgement_merge import (
    merge_chat_complement,
    merge_keyed_figures_into_spec,
)
from agents.atlas_v5.keyed_figures import build_keyed_index
from agents.atlas_v5.network_corpus import NetworkGraphData
from agents.atlas_v5.wide_pass import WidePassResult
from agents.contracts.answer_spec import Blindspot, SoWhat, Verdict

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
    nodes=[{"id": "a", "label": "A"}, {"id": "b", "label": "B"}],
    edges=[{"source": "a", "target": "b", "kind": "bridge"}],
    ladder_rung="force-graph",
    edge_density=0.5,
    corpus_count=55,
)


def _connect_bundle():
    skeleton = assemble_connect_spec(MOCK_STATS, MOCK_GRAPH, query="map network")
    wide = WidePassResult(
        outcome="connect",
        query="map network",
        stats=MOCK_STATS,
        graph=MOCK_GRAPH,
        retrieval_meta={"lane_mode": "dual", "external_skipped": False},
    )
    index = build_keyed_index(wide, skeleton)
    return skeleton, index


def test_merge_keyed_figures_in_text_replaces_known_keys():
    _, index = _connect_bundle()
    out = merge_keyed_figures_in_text(
        "{{stats.project_count}} projects across {{graph.edge_count}} edges",
        index,
    )
    assert "{{" not in out
    assert "55" in out
    assert "1" in out


def test_merge_keyed_figures_into_spec_fills_verdict_and_sowhat():
    skeleton, index = _connect_bundle()
    polluted = skeleton.model_copy(
        update={
            "verdict": Verdict(
                sentence="{{graph.edge_count}} edges across {{stats.org_count}} orgs",
                tail="Floor £{{stats.funding_floor_gbp}}",
            ),
            "soWhat": SoWhat(
                lookingAt="{{stats.project_count}} projects in view",
                oneDecision="Decide on {{graph.node_count}} nodes",
                gate="Check nulls: {{stats.null_funding_count}}",
                primaryAction="Act",
                turn="2 / 4",
            ),
        }
    )
    merged = merge_keyed_figures_into_spec(polluted, index, skeleton=skeleton)
    assert "{{" not in merged.verdict.sentence
    assert "1" in merged.verdict.sentence
    assert "30" in merged.verdict.sentence
    assert "{{" not in merged.soWhat.lookingAt
    assert "55" in merged.soWhat.lookingAt


def test_merge_keyed_figures_into_spec_falls_back_to_skeleton_on_unknown_key():
    skeleton, index = _connect_bundle()
    polluted = skeleton.model_copy(
        update={
            "verdict": Verdict(
                sentence="{{funding.total}} programme scale",
                tail=None,
            ),
        }
    )
    merged = merge_keyed_figures_into_spec(polluted, index, skeleton=skeleton)
    assert merged.verdict.sentence == skeleton.verdict.sentence


def test_merge_chat_complement_strips_unknown_holes():
    skeleton, index = _connect_bundle()
    out = merge_chat_complement(
        "See {{stats.project_count}} projects and {{web.missing_key}} context",
        index,
    )
    assert "{{" not in out
    assert "55" in out


def test_strip_unresolved_key_holes_cleans_spacing():
    out = strip_unresolved_key_holes("Across {{missing}} entities here")
    assert "{{" not in out
    assert "Across entities here" in out
