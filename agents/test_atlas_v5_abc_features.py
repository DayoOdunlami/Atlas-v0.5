"""Tests for chart spec, web lane, journey intent."""

from __future__ import annotations

from agents.atlas_v5.chart_spec import build_funder_bar_chart
from agents.atlas_v5.j1t1_types import FunderBreakdownRow, J1T1CorpusStats
from agents.atlas_v5.keyed_figures import KeyedFigure, KeyedFigureIndex
from agents.atlas_v5.progressive_stream import build_partial_envelope
from agents.atlas_v5.visual_intent import detect_visual_form, is_journey_orient_query
from agents.atlas_v5.visual_templates import build_template_markup
from agents.atlas_v5.web_lane import atlas_retrieval_plan, parallel_evidence_enabled
from agents.atlas_v5.judgement_models import JudgementFieldsOutput
from agents.contracts.answer_spec import Verdict, SoWhat
from agents.orchestrator.retrieval_planner import RetrievalPlan


def _stats() -> J1T1CorpusStats:
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
        ],
    )


def test_journey_orient_intent():
    assert detect_visual_form("State of play on rail decarbonisation", outcome="orient") == "journey_orient"
    assert is_journey_orient_query("port shore decarbonisation priority")


def test_journey_template_markup():
    j = JudgementFieldsOutput(
        mode="Orient",
        tier="Supported",
        verdict=Verdict(sentence="Two-tier field.", tail="SME layer below programme."),
        soWhat=SoWhat(
            lookingAt="x",
            oneDecision="y",
            gate="z",
            primaryAction="a",
            turn="1/4",
        ),
        instrument_recipe="IncommensurableMagnitudes",
        chat_complement="",
    )
    index = KeyedFigureIndex(
        figures={
            "stats.project_count": KeyedFigure("stats.project_count", 55, "count", "owned", "t"),
        }
    )
    markup = build_template_markup(
        "rail decarbonisation state of play",
        j,
        index,
        object_label="Rail decarbonisation",
        outcome="orient",
    )
    assert markup is not None
    assert "journey-orient" in markup


def test_funder_bar_chart():
    index = KeyedFigureIndex()
    chart = build_funder_bar_chart(_stats(), index, query="funding by funder breakdown")
    assert chart is not None
    assert chart.kind == "bar"
    assert chart.option.get("series")


def test_parallel_lane_always_dual():
    assert parallel_evidence_enabled()
    plan = RetrievalPlan(
        lane_mode="corpus_only",
        corpus_k=8,
        external_enabled=False,
        external_timeout_s=8,
        govuk_query="rail",
        exa_queries=[],
        rationale="test",
    )
    upgraded = atlas_retrieval_plan("anything at all", "orient", plan, web_enabled=True)
    assert upgraded.lane_mode == "dual"
    assert upgraded.external_enabled is True


def test_web_lane_upgrade():
    plan = RetrievalPlan(
        lane_mode="corpus_only",
        corpus_k=8,
        external_enabled=False,
        external_timeout_s=8,
        govuk_query="rail",
        exa_queries=[],
        rationale="test",
    )
    upgraded = atlas_retrieval_plan(
        "state of play on rail decarbonisation",
        "orient",
        plan,
        web_enabled=True,
    )
    assert upgraded.lane_mode == "dual"
    assert upgraded.external_enabled is True


def test_progressive_envelope_stages():
    from agents.atlas_v5.j1t1_assembler import assemble_j1t1_spec

    spec = assemble_j1t1_spec(_stats())
    stats_env = build_partial_envelope(spec, revision=2, stage="stats")
    assert stats_env.status == "partial"
    assert "verdict" not in (stats_env.spec or {})
    spine_env = build_partial_envelope(spec, revision=2, stage="spine")
    assert spine_env.spec and spine_env.spec.get("verdict")
