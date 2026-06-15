"""
D5.1–D5.3 acceptance tests — latency budget, encoding guardrail, render-parity gate.

D5.3 render-parity gate: all five outcome modes must produce render models
that meet the same structural contract as the legacy workbench graph output.
This test is suitable for CI — it runs without a live LLM or DB.
"""

import math
import pytest
from agents.orchestrator.latency import LatencyBudget, BUDGETS_SECONDS
from agents.registry.viz_guardrail import validate_chart_spec, sanitise_chart_spec
from agents.orchestrator.format_pass import run_format_pass
from agents.spine.verify import run_verify_spine
from agents.registry.render_model import build_atlas_render_model, validate_render_model


# ---------------------------------------------------------------------------
# D5.1 Latency budget
# ---------------------------------------------------------------------------

def test_budget_defaults_per_effort():
    for effort, expected in BUDGETS_SECONDS.items():
        budget = LatencyBudget(effort=effort)
        assert budget._budget == expected


def test_budget_not_exceeded_immediately():
    budget = LatencyBudget(effort="analyze")
    budget.start()
    assert not budget.is_exceeded()


def test_budget_exceeded_when_start_is_old():
    budget = LatencyBudget(effort="refine")
    budget._start = -1000.0  # far in the past
    budget._budget = 8.0
    assert budget.is_exceeded()


def test_early_exit_caps_tier():
    budget = LatencyBudget(effort="deep")
    budget._start = -100.0  # expired
    model = build_atlas_render_model(
        outcome="orient",
        headline="Test headline for latency test scenario",
        insight_card="Test insight card.",
        confidence_tier="Robust",
        query="test",
    )
    exited = budget.early_exit_model(model)
    assert exited["budget_exceeded"] is True
    assert exited["confidence_tier"] in ("Speculative", "Indicative")
    assert "Partial response" in exited["insight_card"]


def test_early_exit_preserves_citations():
    budget = LatencyBudget(effort="deep")
    budget._start = -100.0
    model = build_atlas_render_model(
        outcome="diagnose",
        headline="Test headline for citation preservation check",
        insight_card="Test insight.",
        confidence_tier="Supported",
        corpus_citations=[{"id": "uuid-1"}, {"id": "uuid-2"}],
        query="test",
    )
    exited = budget.early_exit_model(model)
    assert len(exited["corpus_citations"]) == 2


# ---------------------------------------------------------------------------
# D5.2 Encoding guardrail
# ---------------------------------------------------------------------------

def test_valid_bar_chart_passes():
    spec = {
        "series": [{"type": "bar", "data": [10, 20, 30], "name": "Evidence"}],
        "xAxis": {"type": "category", "data": ["A", "B", "C"], "name": "Category"},
        "yAxis": {"type": "value", "name": "Count"},
    }
    is_valid, issues = validate_chart_spec(spec)
    assert is_valid, f"Expected valid, got issues: {issues}"


def test_missing_series_fails():
    spec = {"xAxis": {"data": ["A", "B"]}, "yAxis": {}}
    is_valid, issues = validate_chart_spec(spec)
    assert not is_valid
    assert any("series" in i for i in issues)


def test_length_mismatch_fails():
    spec = {
        "series": [{"type": "bar", "data": [1, 2, 3]}],
        "xAxis": {"type": "category", "data": ["A", "B"]},
        "yAxis": {},
    }
    is_valid, issues = validate_chart_spec(spec)
    assert not is_valid
    assert any("length" in i for i in issues)


def test_nan_in_data_fails():
    spec = {
        "series": [{"type": "bar", "data": [1, float("nan"), 3]}],
        "xAxis": {"type": "category", "data": ["A", "B", "C"]},
        "yAxis": {},
    }
    is_valid, issues = validate_chart_spec(spec)
    assert not is_valid
    assert any("non-finite" in i for i in issues)


def test_sanitise_fixes_nan():
    spec = {
        "series": [{"type": "bar", "data": [1, float("nan"), float("inf")]}],
        "xAxis": {"data": ["A", "B", "C"]},
        "yAxis": {},
    }
    fixed = sanitise_chart_spec(spec)
    data = fixed["series"][0]["data"]
    assert all(isinstance(v, (int, float)) and math.isfinite(v) for v in data)


def test_sanitise_adds_axis_names():
    spec = {
        "series": [{"type": "bar", "data": [1, 2, 3]}],
        "xAxis": {"data": ["A", "B", "C"]},
        "yAxis": {},
    }
    fixed = sanitise_chart_spec(spec)
    assert fixed["xAxis"].get("name") is not None
    assert fixed["yAxis"].get("name") is not None


# ---------------------------------------------------------------------------
# D5.3 Render-parity gate (CI gate)
# ---------------------------------------------------------------------------

REQUIRED_MODEL_KEYS = {
    "type", "outcome", "headline", "insight_card",
    "sections", "corpus_citations", "hive_citations",
    "confidence_tier", "blocks", "render_mode",
    "citation_guard", "artifact_qa",
}

THREE_CITATIONS = [
    {"id": "00000000-0000-0000-0000-000000000001", "title": "P1"},
    {"id": "00000000-0000-0000-0000-000000000002", "title": "P2"},
    {"id": "00000000-0000-0000-0000-000000000003", "title": "P3"},
]


@pytest.mark.parametrize("outcome", ["orient", "connect", "diagnose", "act", "defend"])
def test_render_parity_all_outcomes(outcome):
    """
    CI gate: every outcome must produce a render model with all required keys,
    a valid confidence tier, and correctly ordered blocks.
    """
    effort = "deep" if outcome == "defend" else "analyze"
    model = build_atlas_render_model(
        outcome=outcome,  # type: ignore[arg-type]
        headline=f"Render parity test for {outcome} — twelve words minimum",
        insight_card=f"Insight card for {outcome} with sufficient length.",
        confidence_tier="Supported",
        corpus_citations=THREE_CITATIONS,
        query=f"render parity test for {outcome}",
        effort=effort,  # type: ignore[arg-type]
    )
    verified = run_verify_spine(artifact=model, query=model["query"], effort=effort)  # type: ignore[arg-type]
    formatted = run_format_pass(verified, query=model["query"])

    # All required keys present
    missing_keys = REQUIRED_MODEL_KEYS - set(formatted.keys())
    assert not missing_keys, f"Missing keys for outcome={outcome}: {missing_keys}"

    # Valid according to schema
    errs = validate_render_model(formatted)
    assert errs == [], f"Schema errors for outcome={outcome}: {errs}"

    # Blocks list is a list
    assert isinstance(formatted["blocks"], list)

    # Render mode is one of the three valid values
    assert formatted["render_mode"] in ("blocks", "document", "chart")

    # context_card first (when blocks are present)
    if formatted["blocks"]:
        assert formatted["blocks"][0] == "context_card", (
            f"context_card must be first for outcome={outcome}, got {formatted['blocks'][0]}"
        )

    # recommendation_confidence last (when blocks are present)
    if formatted["blocks"]:
        assert formatted["blocks"][-1] == "recommendation_confidence", (
            f"recommendation_confidence must be last for outcome={outcome}, got {formatted['blocks'][-1]}"
        )

    # Trust spine populated
    assert formatted["citation_guard"] is not None
    assert formatted["artifact_qa"] is not None
    assert "status" in formatted["citation_guard"]
    assert "status" in formatted["artifact_qa"]
