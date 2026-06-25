"""Visual Opportunity Engine tests."""

from __future__ import annotations

from agents.atlas_v5.j1t1_assembler import assemble_j1t1_spec
from agents.atlas_v5.j1t1_types import FunderBreakdownRow, J1T1CorpusStats
from agents.atlas_v5.keyed_figures import build_keyed_index
from agents.atlas_v5.visual.attach import attach_visuals
from agents.atlas_v5.visual.data_profile import build_data_profile
from agents.atlas_v5.visual.opportunity import select_opportunities
from agents.atlas_v5.visual.suppress import assess_data_strength
from agents.atlas_v5.wide_pass import WidePassResult
from agents.contracts.answer_spec import Verdict, SoWhat


def _rich_stats() -> J1T1CorpusStats:
    return J1T1CorpusStats(
        project_count=55,
        funding_sum=8_170_000,
        null_funding_count=10,
        funded_row_count=45,
        org_count=30,
        live_since_2024=27,
        funders=[
            FunderBreakdownRow("Innovate UK", 40, 2, 7_000_000),
            FunderBreakdownRow("EPSRC", 5, 5, 0),
            FunderBreakdownRow("DfT", 10, 3, 1_170_000),
        ],
    )


def _wide(stats: J1T1CorpusStats | None = None, *, citations: list | None = None) -> WidePassResult:
    return WidePassResult(
        outcome="orient",
        query="state of play on rail decarbonisation funding breakdown",
        stats=stats or _rich_stats(),
        corpus_hits=citations or [],
        retrieval_meta={"lane_mode": "corpus_only", "external_skipped": True},
    )


def test_weak_data_suppresses_all():
    stats = J1T1CorpusStats(
        project_count=1,
        funding_sum=100_000,
        null_funding_count=0,
        funded_row_count=1,
        org_count=1,
        live_since_2024=0,
        funders=[FunderBreakdownRow("Innovate UK", 1, 0, 100_000)],
    )
    profile = build_data_profile(_wide(stats), assemble_j1t1_spec(stats), query="q")
    decision = assess_data_strength(profile)
    assert decision.allow_any is False
    plan = select_opportunities(profile)
    assert plan.opportunities == []


def test_rich_stats_attach_multiple_charts():
    stats = _rich_stats()
    skeleton = assemble_j1t1_spec(stats)
    wide = _wide(stats)
    index = build_keyed_index(wide, skeleton)
    result = attach_visuals(skeleton, wide, index, wide.query)
    assert result.meta["visual_suppressed"] is False
    assert result.meta["charts_attached"] >= 2
    assert len(result.spec.charts) >= 2
    assert result.spec.chart is not None
    roles = {c.role for c in result.spec.charts}
    assert "ranking" in roles
    assert result.spec.charts[0].story


def test_no_keyword_gate_swot_query_still_gets_charts():
    stats = _rich_stats()
    skeleton = assemble_j1t1_spec(stats)
    wide = _wide(stats)
    wide.query = "SWOT analysis for rail decarbonisation"
    index = build_keyed_index(wide, skeleton)
    result = attach_visuals(skeleton, wide, index, wide.query)
    assert result.meta["charts_attached"] >= 1


def test_heatmap_when_citations_rich():
    stats = _rich_stats()
    skeleton = assemble_j1t1_spec(stats)
    citations = [
        {"source_type": "project", "organisation": f"Org {i}", "score": 0.9 - i * 0.05}
        for i in range(6)
    ]
    wide = _wide(stats, citations=citations)
    index = build_keyed_index(wide, skeleton)
    result = attach_visuals(skeleton, wide, index, "where is evidence thin")
    kinds = [c.kind for c in result.spec.charts]
    assert "heatmap" in kinds


def test_sankey_on_connect_outcome():
    stats = _rich_stats()
    skeleton = assemble_j1t1_spec(stats)
    citations = [
        {"source_type": "project", "organisation": "Org A", "score": 0.9},
        {"source_type": "project", "organisation": "Org B", "score": 0.8},
        {"source_type": "project", "organisation": "Org C", "score": 0.7},
        {"source_type": "live_call", "funder": "IUK", "score": 0.6},
    ]
    wide = WidePassResult(
        outcome="connect",
        query="network ecosystem funding flow",
        stats=stats,
        corpus_hits=citations,
        retrieval_meta={"lane_mode": "corpus_only"},
    )
    index = build_keyed_index(wide, skeleton)
    result = attach_visuals(skeleton, wide, index, wide.query)
    kinds = [c.kind for c in result.spec.charts]
    assert "sankey" in kinds


def test_ranking_bar_has_interaction_hook():
    stats = _rich_stats()
    skeleton = assemble_j1t1_spec(stats)
    wide = _wide(stats)
    index = build_keyed_index(wide, skeleton)
    result = attach_visuals(skeleton, wide, index, wide.query)
    ranking = next(c for c in result.spec.charts if c.role == "ranking")
    assert ranking.interaction_spec is not None
    assert ranking.interaction_spec.type == "floor_adjust"


def test_temporal_line_when_start_years_present():
    from agents.atlas_v5.j1t1_types import StartYearRow

    stats = _rich_stats()
    stats = stats.__class__(
        project_count=stats.project_count,
        funding_sum=stats.funding_sum,
        null_funding_count=stats.null_funding_count,
        funded_row_count=stats.funded_row_count,
        org_count=stats.org_count,
        live_since_2024=stats.live_since_2024,
        funders=stats.funders,
        start_years=[
            StartYearRow(2018, 4),
            StartYearRow(2019, 6),
            StartYearRow(2020, 8),
            StartYearRow(2021, 5),
        ],
    )
    skeleton = assemble_j1t1_spec(stats)
    wide = _wide(stats)
    wide.query = "project starts over time rail decarbonisation"
    index = build_keyed_index(wide, skeleton)
    result = attach_visuals(skeleton, wide, index, wide.query)
    roles = [c.role for c in result.spec.charts]
    assert "temporal" in roles


def test_theme_stack_when_mode_themes_present():
    from agents.atlas_v5.j1t1_types import ModeThemeRow

    stats = _rich_stats()
    stats = stats.__class__(
        project_count=stats.project_count,
        funding_sum=stats.funding_sum,
        null_funding_count=stats.null_funding_count,
        funded_row_count=stats.funded_row_count,
        org_count=stats.org_count,
        live_since_2024=stats.live_since_2024,
        funders=stats.funders,
        mode_themes=[
            ModeThemeRow("rail", "decarbonisation", 30),
            ModeThemeRow("rail", "hydrogen", 8),
            ModeThemeRow("freight", "decarbonisation", 5),
            ModeThemeRow("aviation", "decarbonisation", 3),
        ],
    )
    skeleton = assemble_j1t1_spec(stats)
    wide = _wide(stats)
    wide.query = "break down by transport mode and theme"
    index = build_keyed_index(wide, skeleton)
    result = attach_visuals(skeleton, wide, index, wide.query)
    roles = [c.role for c in result.spec.charts]
    assert "theme_stack" in roles


def test_speculative_tier_caps_at_one_chart():
    stats = _rich_stats()
    skeleton = assemble_j1t1_spec(stats).model_copy(update={"tier": "Speculative"})
    skeleton = skeleton.model_copy(
        update={
            "verdict": Verdict(sentence="Thin slice.", tail=""),
            "soWhat": SoWhat(
                lookingAt="x",
                oneDecision="y",
                gate="z",
                primaryAction="a",
                turn="1/4",
            ),
        }
    )
    stats = stats.__class__(
        project_count=4,
        funding_sum=stats.funding_sum,
        null_funding_count=stats.null_funding_count,
        funded_row_count=stats.funded_row_count,
        org_count=stats.org_count,
        live_since_2024=stats.live_since_2024,
        funders=stats.funders,
    )
    wide = _wide(stats)
    index = build_keyed_index(wide, skeleton)
    result = attach_visuals(skeleton, wide, index, wide.query)
    assert result.meta["charts_attached"] <= 1
