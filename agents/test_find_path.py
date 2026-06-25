"""Increment 1B — find_path routing, assembler, C1 precedence."""

from __future__ import annotations

import pytest

from agents.atlas_v5.case_file import bootstrap_declared_claims_heuristic
from agents.atlas_v5.find_path_assembler import assemble_find_path_spec
from agents.atlas_v5.intent import has_declared_uncertainty_cue
from agents.atlas_v5.j1t1_types import FunderBreakdownRow, J1T1CorpusStats
from agents.atlas_v5.turn_classifier import (
    TurnClassifierOutput,
    classify_turn,
    classify_turn_heuristic,
)
from agents.atlas_v5.wide_pass import WidePassResult


MOCK_STATS = J1T1CorpusStats(
    project_count=12,
    funding_sum=1_500_000.0,
    null_funding_count=2,
    funded_row_count=10,
    org_count=8,
    live_since_2024=4,
    funders=[FunderBreakdownRow("Innovate UK", 8, 0, 1_200_000.0)],
    top_citations=[],
    queried_at="2026-06-22T00:00:00Z",
)


def test_uncertainty_cue_detected():
    assert has_declared_uncertainty_cue("I've got a rail idea, not sure what I'm asking")
    assert not has_declared_uncertainty_cue("state of play on rail decarbonisation")


def test_c1_find_path_beats_domain_orient():
    q = "I've got a rail idea, not sure what I'm asking"
    d = classify_turn_heuristic(q)
    assert d.route == "substantive"
    assert d.outcome_hint == "find_path"


def test_c1_overrides_haiku_chat_misroute():
    fake = TurnClassifierOutput(route="chat", reasoning="misclassified thinking aloud")
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "agents.atlas_v5.turn_classifier._haiku_classify",
            lambda q, spec=None: fake,
        )
        d = classify_turn("I've got a rail idea, not sure what I'm asking")
    assert d.route == "substantive"
    assert d.outcome_hint == "find_path"
    assert d.source == "heuristic"


def test_clean_rail_stays_orient():
    q = "State of play on rail decarbonisation in our corpus"
    d = classify_turn_heuristic(q)
    assert d.route == "substantive"
    assert d.outcome_hint == "orient"


def test_assemble_find_path_not_opportunity_list():
    claims = bootstrap_declared_claims_heuristic(
        "I've got a rail idea, not sure what I'm asking"
    )
    wide = WidePassResult(
        outcome="find_path",
        query="I've got a rail idea, not sure what I'm asking",
        stats=MOCK_STATS,
        session_claims=claims,
        retrieval_meta={"lane_mode": "dual"},
    )
    spec = assemble_find_path_spec(wide)
    assert spec.mode == "FindPath"
    assert spec.instrument is None
    markup = spec.canvas.merged_markup or ""
    assert 'data-testid="find-my-path"' in markup
    assert "OpportunityList" not in markup
    assert any(c.trust == "declared" for c in spec.claims)


def test_find_path_wide_assemble_branch():
    from agents.atlas_v5.wide_pass import assemble_spec_from_wide_pass

    wide = WidePassResult(
        outcome="find_path",
        query="help me figure out funding as an SME",
        stats=MOCK_STATS,
        session_claims=[],
        retrieval_meta={"lane_mode": "corpus_only"},
    )
    spec = assemble_spec_from_wide_pass(wide)
    assert spec.mode == "FindPath"
