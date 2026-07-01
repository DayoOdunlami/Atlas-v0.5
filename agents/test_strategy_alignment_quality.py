"""Strategy alignment quality — intent, diagnose gaps, chart suppression, thread routing."""

from __future__ import annotations

from agents.atlas_v5.diagnose_assembler import assemble_diagnose_spec
from agents.atlas_v5.intent import (
    is_strategy_alignment_query,
    is_strategy_thread_continuation,
)
from agents.atlas_v5.j1t1_assembler import assemble_j1t1_spec
from agents.atlas_v5.j1t1_types import FunderBreakdownRow, J1T1CorpusStats
from agents.atlas_v5.keyed_figures import build_keyed_index
from agents.atlas_v5.turn_classifier import infer_outcome_hint
from agents.atlas_v5.visual.attach import attach_visuals
from agents.atlas_v5.visual.opportunity import select_opportunities
from agents.atlas_v5.visual.data_profile import DataProfile
from agents.atlas_v5.wide_pass import WidePassResult

MOCK_STATS = J1T1CorpusStats(
    project_count=729,
    funding_sum=353_830_000.0,
    null_funding_count=291,
    funded_row_count=438,
    org_count=319,
    live_since_2024=285,
    funders=[
        FunderBreakdownRow("Innovate UK", 383, 9, 258_510_000.0),
        FunderBreakdownRow("EPSRC", 158, 158, 0),
    ],
    top_citations=[],
    queried_at="2026-06-17T00:00:00Z",
)

STRATEGY_QUERIES = [
    "UK transport strategy alignment",
    "How does CPC align with DfT Better Connected and Innovate UK delivery plan?",
    "What is the policy alignment between CPC and Innovate UK strategic delivery plan?",
]


def test_short_strategy_query_detected():
    assert is_strategy_alignment_query("UK transport strategy alignment")


def test_strategy_diagnose_dimensions_not_corpus_hygiene():
    spec = assemble_diagnose_spec(
        MOCK_STATS,
        query="UK transport strategy alignment",
        object_label="UK transport strategy alignment",
    )
    dims = spec.instrument.data.get("dimensions") or []
    labels = {d["label"] for d in dims}
    assert "Published concordance" in labels
    assert "Programme pillar tags" in labels
    assert "Funding completeness" not in labels
    assert spec.scope.startswith("STRATEGY ALIGNMENT")
    assert spec.tier == "Indicative"
    assert spec.instrument.data.get("strategyAlignment") is True


def test_strategy_query_suppresses_all_charts():
    for q in STRATEGY_QUERIES:
        profile = DataProfile(
            query=q,
            outcome="diagnose",
            project_count=729,
            citation_count=8,
            funder_count=5,
            funded_funder_count=4,
            null_funding_ratio=0.4,
            has_funder_breakdown=True,
            has_evidence_matrix=True,
            has_flow_data=True,
            has_temporal_series=True,
            tier="Indicative",
            is_sparse=False,
        )
        plan = select_opportunities(profile)
        assert plan.opportunities == [], f"expected no charts for: {q}"


def test_attach_visuals_zero_for_strategy():
    stats = MOCK_STATS
    skeleton = assemble_j1t1_spec(stats)
    wide = WidePassResult(
        outcome="diagnose",
        query="UK transport strategy alignment",
        stats=stats,
        corpus_hits=[],
        retrieval_meta={"lane_mode": "dual"},
    )
    index = build_keyed_index(wide, skeleton)
    result = attach_visuals(skeleton, wide, index, wide.query)
    assert result.meta.get("charts_attached", 0) == 0
    assert result.meta.get("visual_suppressed") is True


def test_strategy_thread_continuation_keeps_diagnose():
    prior_spec = assemble_diagnose_spec(
        MOCK_STATS,
        query="How does CPC align with DfT Better Connected?",
        object_label="UK transport strategy alignment",
    ).model_dump(mode="json")
    assert infer_outcome_hint("tell me more about those pillar gaps", prior_spec) == "diagnose"
    assert infer_outcome_hint("state of play on rail", prior_spec) == "orient"


def test_strategy_thread_continuation_short_query():
    prior_spec = {
        "mode": "Diagnose",
        "scope": "STRATEGY ALIGNMENT · 4 GAPS · DIAGNOSE",
        "query": "How does CPC align with DfT Better Connected?",
        "instrument": {"recipe": "EvidenceGapMatrix", "data": {"subjectQuery": "..."}},
    }
    assert is_strategy_thread_continuation("UK transport strategy alignment", prior_spec)
    assert infer_outcome_hint("UK transport strategy alignment", prior_spec) == "diagnose"


def test_strategy_tier_capped_at_indicative():
    from agents.atlas_v5.intent import cap_strategy_alignment_tier

    spec = assemble_diagnose_spec(
        MOCK_STATS,
        query="UK transport strategy alignment",
        object_label="UK transport strategy alignment",
    )
    spec = spec.model_copy(update={"tier": "Supported"})
    capped = cap_strategy_alignment_tier(spec)
    assert capped.tier == "Indicative"
