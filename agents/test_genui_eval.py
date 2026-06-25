"""GenUI eval scoring — fixture tests (no live API)."""

from __future__ import annotations

from agents.atlas_v5.genui_eval import (
    FIXTURE_CASES,
    GOLDEN_RAIL_BU_QUERY,
    GenUICase,
    run_fixture_cases,
    score_payload,
)


def test_fixture_golden_rail_bu_passes():
    results = run_fixture_cases()
    golden = next(r for r in results if r.case_id == "golden_rail_bu_fixture")
    assert golden.passed
    assert golden.chart_count >= 2
    assert golden.has_merged_markup


def test_fixture_programme_compare_passes():
    results = run_fixture_cases()
    dual = next(r for r in results if r.case_id == "programme_scale_fixture")
    assert dual.passed
    assert "compare" in dual.chart_roles
    assert dual.trust_conflicts


def test_score_payload_penalizes_missing_charts():
    case = GenUICase(
        id="x",
        query=GOLDEN_RAIL_BU_QUERY,
        expect_charts_min=2,
        min_score=3,
    )
    result = score_payload(
        case,
        {
            "update_canvas": True,
            "dev_meta": {"gate_status": "pass"},
            "spec": {"canvas": {"merged_markup": "swot", "gate_status": "pass"}},
        },
    )
    assert result.chart_count == 0
    assert not result.passed
    assert any("charts" in e for e in result.errors)


def test_score_payload_rewards_trust_meta():
    case = GenUICase(id="y", query="q", expect_charts_min=1, min_score=5)
    payload = FIXTURE_CASES["programme_scale_fixture"]
    result = score_payload(case, payload)
    assert result.lead_lane == "web"
    assert result.chart_count == 1
