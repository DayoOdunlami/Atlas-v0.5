"""
Honesty mode for diagnose: when fixtures are used, the model MUST disclose it.
Also covers Pass 3: diagnose + has_gaps now triggers dual lane.
"""
from __future__ import annotations

from agents.orchestrator.diagnose import run_value_translation_pipeline
from agents.orchestrator.evidence_router import select_lane_mode

CANONICAL_VT_QUERY = (
    "What evidence does CPC have in smart mobility that would transfer "
    "to the Innovate UK Smart City Challenge?"
)

# Queries that trigger VT and historically used fixtures when spec extraction fails
DEMO_TRIGGER_QUERIES = [
    CANONICAL_VT_QUERY,
    "Compare CPC smart mobility evidence against the Innovate UK Smart City Challenge",
    "What would transfer from CPC smart mobility to Innovate UK?",
]


def test_diagnose_model_marks_demo_when_no_real_spec_extracted():
    for q in DEMO_TRIGGER_QUERIES:
        model = run_value_translation_pipeline(query=q, outcome="diagnose")
        assert model is not None, f"pipeline returned None for {q!r}"
        assert model.get("is_demo_comparison") is True, (
            f"expected demo flag for {q!r} — fixture spec was used but not disclosed"
        )


def test_diagnose_headline_says_sample_when_demo():
    model = run_value_translation_pipeline(
        query=CANONICAL_VT_QUERY,
        outcome="diagnose",
    )
    assert model is not None
    assert "Sample comparison" in model["headline"]


def test_diagnose_executive_summary_present_in_blocks():
    model = run_value_translation_pipeline(
        query=CANONICAL_VT_QUERY,
        outcome="diagnose",
    )
    assert model is not None
    bd = model.get("blocks_data") or {}
    assert "executive_summary" in bd
    summary = bd["executive_summary"].get("summary", "")
    assert "Sample comparison" in summary or "demo fixtures" in summary.lower()


def test_diagnose_insight_card_is_now_executive_summary_not_metric():
    model = run_value_translation_pipeline(
        query=CANONICAL_VT_QUERY,
        outcome="diagnose",
    )
    assert model is not None
    insight = model.get("insight_card", "")
    # Insight card should be the executive summary, not the raw match assessment
    assert "FIT" not in insight or "Sample" in insight, (
        f"insight_card looks like raw metrics, not executive summary: {insight!r}"
    )


# ---------------------------------------------------------------------------
# Pass 3 — Lane router fix: diagnose + gaps = dual
# ---------------------------------------------------------------------------


def test_lane_router_diagnose_with_gaps_returns_dual():
    """The whole point of D6.x — diagnose with gaps must fire external lane."""
    lane = select_lane_mode(
        "What evidence gaps does CPC have in rail decarbonisation?",
        "diagnose",
        intent=None,
        has_gaps=True,
    )
    assert lane == "dual", (
        "Regression: diagnose+has_gaps must be 'dual' so external lane fires "
        "(this is the exact case where corpus is incomplete and we want enrichment)"
    )


def test_lane_router_diagnose_without_gaps_still_corpus_primary():
    lane = select_lane_mode(
        "summarise CPC mobility evidence",
        "diagnose",
        intent=None,
        has_gaps=False,
    )
    assert lane in ("corpus_primary", "corpus_only")


def test_lane_router_diagnose_policy_query_returns_dual():
    lane = select_lane_mode(
        "what's the latest UK government policy on autonomous vehicles?",
        "diagnose",
        intent=None,
        has_gaps=False,
    )
    assert lane == "dual"
