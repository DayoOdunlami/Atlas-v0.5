"""Calibration eval harness — verdict logic, rubric shape, transcript packing."""

from __future__ import annotations

import pytest

from agents.atlas_v5.calibration_rubric import CALIBRATION_CASES, get_calibration_case
from agents.atlas_v5.calibration_eval import (
    build_transcript_pack,
    extract_structural_signals,
    _followup_references_declared,
    _spec_excerpt,
)
from agents.eval.behavioral_grader import (
    GradedCriterion,
    RubricCriterion,
    TurnSwot,
    build_diagnosis,
    compute_verdict,
    grade_heuristic,
)


def test_calibration_cases_include_strategy():
    assert len(CALIBRATION_CASES) >= 8
    ids = {c.id for c in CALIBRATION_CASES}
    assert "cal_03_lost_rail" in ids
    assert "cal_04_clean_rail" in ids
    assert "cal_08_strategy" in ids


def test_cal_03_has_routing_and_persistence_layers():
    case = get_calibration_case("cal_03_lost_rail")
    assert case is not None
    layers = {r.layer for r in case.rubric}
    assert "routing" in layers
    assert "persistence" in layers
    assert "render" in layers
    assert case.follow_up_query


def test_compute_verdict_broken_on_load_bearing_zero():
    rubric = [
        RubricCriterion(id="a", layer="routing", description="x", load_bearing=True),
        RubricCriterion(id="b", layer="disposition", description="y"),
    ]
    criteria = [
        GradedCriterion(id="a", layer="routing", score=0, reason="wrong route"),
        GradedCriterion(id="b", layer="disposition", score=3, reason="ok"),
    ]
    assert compute_verdict(criteria, rubric) == "broken"


def test_compute_verdict_ship_when_mostly_threes():
    rubric = [
        RubricCriterion(id="a", layer="disposition", description="x"),
        RubricCriterion(id="b", layer="disposition", description="y"),
    ]
    criteria = [
        GradedCriterion(id="a", layer="disposition", score=3, reason="ok"),
        GradedCriterion(id="b", layer="disposition", score=3, reason="ok"),
    ]
    assert compute_verdict(criteria, rubric) == "ship"


def test_compute_verdict_tune_on_mixed_twos():
    rubric = [
        RubricCriterion(id="a", layer="disposition", description="x"),
        RubricCriterion(id="b", layer="disposition", description="y"),
    ]
    criteria = [
        GradedCriterion(id="a", layer="disposition", score=2, reason="thin"),
        GradedCriterion(id="b", layer="disposition", score=2, reason="thin"),
    ]
    assert compute_verdict(criteria, rubric) == "tune"


def test_build_diagnosis_names_layer():
    criteria = [
        GradedCriterion(id="r", layer="routing", score=0, reason="orient not find_path"),
        GradedCriterion(id="d", layer="disposition", score=2, reason="ok"),
    ]
    rubric = [
        RubricCriterion(id="r", layer="routing", description="route"),
        RubricCriterion(id="d", layer="disposition", description="disp"),
    ]
    diag = build_diagnosis(criteria, rubric)
    assert "routing" in diag
    assert "turn_classifier" in diag


def test_spec_excerpt_detects_declared_markup():
    payload = {
        "spec": {
            "canvas": {
                "merged_markup": '<section data-testid="declared-situation" data-material="declared">',
            },
            "instrument": {"recipe": "OpportunityList"},
            "reconciliation": {"retrieval": {"lane_mode": "dual", "corpus_count": 3}},
        }
    }
    ex = _spec_excerpt(payload)
    assert ex["declared_in_markup"] is True
    assert ex["recipe"] == "OpportunityList"


def test_followup_reference_heuristic():
    claims = [{"text": "rail idea for SME innovator", "kind": "uncertainty"}]
    assert _followup_references_declared(
        "Given your rail idea and SME context, Innovate UK might fit",
        claims,
    )


def test_extract_structural_signals_find_path():
    case = get_calibration_case("cal_03_lost_rail")
    assert case is not None
    turns = [
        {
            "query": case.query,
            "route": "substantive",
            "outcome_hint": "find_path",
            "update_canvas": True,
            "spec_excerpt": {"recipe": None, "declared_in_markup": True},
            "payload": {},
        }
    ]
    signals = extract_structural_signals(
        case,
        thread_id="t-1",
        turns=turns,
        follow_up_payload={"reply": "For your rail SME idea, consider…"},
        case_file_after=[{"text": "rail idea", "kind": "uncertainty"}],
    )
    assert signals["outcome_hint"] == "find_path"
    assert signals["case_file_count"] == 1
    assert signals["follow_up_ran"] is True


def test_heuristic_grader_routing_failure():
    case = get_calibration_case("cal_03_lost_rail")
    assert case is not None
    transcript = build_transcript_pack(
        case,
        thread_id="t-1",
        turn_records=[{"query": case.query, "reply": "…", "route": "substantive"}],
        case_file_after=[],
        prior_case_file=[],
    )
    signals = {
        "route": "substantive",
        "outcome_hint": "orient",
        "update_canvas": True,
        "recipe": "OpportunityList",
        "declared_in_markup": False,
        "case_file_count": 0,
        "follow_up_ran": False,
    }
    result = grade_heuristic(
        agent_id="atlas_v5_practitioner",
        case_id=case.id,
        case_label=case.label,
        rubric=case.rubric,
        transcript=transcript,
        structural_signals=signals,
    )
    routing = next(c for c in result.criteria if c.id == "cal_03_routing_find_path")
    assert routing.score == 0
    assert result.verdict == "broken"


def test_grade_heuristic_returns_swot():
    case = get_calibration_case("cal_01_hello")
    assert case is not None
    result = grade_heuristic(
        agent_id="atlas_v5_practitioner",
        case_id=case.id,
        case_label=case.label,
        rubric=case.rubric,
        transcript={"turns": [{"query": "hello", "reply": "Hi there"}]},
        structural_signals={"route": "chat", "update_canvas": False},
    )
    assert isinstance(result.turn_swot, TurnSwot)
