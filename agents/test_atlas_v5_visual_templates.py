"""Unit tests for visual intent + deterministic templates."""

from __future__ import annotations

from agents.atlas_v5.judgement_models import JudgementFieldsOutput, SwotQuadrants
from agents.atlas_v5.keyed_figures import KeyedFigure, KeyedFigureIndex
from agents.atlas_v5.visual_intent import detect_visual_form, is_swot_query
from agents.atlas_v5.visual_templates import build_swot_markup, build_template_markup
from agents.contracts.answer_spec import Verdict, SoWhat


def _minimal_judgement(**kwargs) -> JudgementFieldsOutput:
    base = dict(
        mode="Orient",
        tier="Indicative",
        verdict=Verdict(sentence="CPC holds a broad innovation portfolio.", tail="Corpus thin on national spend."),
        soWhat=SoWhat(
            lookingAt="CPC strategic position",
            oneDecision="Prioritise cross-mode bridges",
            gate="Indicative tier",
            primaryAction="Review weaknesses quadrant",
            turn="1 / 4",
        ),
        instrument_recipe="IncommensurableMagnitudes",
        chat_complement="SWOT on canvas.",
        claims=[],
    )
    base.update(kwargs)
    return JudgementFieldsOutput(**base)


def test_detect_swot_query():
    assert detect_visual_form("Perform a SWOT on CPC") == "swot"
    assert is_swot_query("strengths weaknesses opportunities threats for rail")
    assert detect_visual_form("decarbonisation journey map") == "none"


def _test_index() -> KeyedFigureIndex:
    return KeyedFigureIndex(
        figures={
            "stats.project_count": KeyedFigure(
                key="stats.project_count",
                value=55,
                unit="count",
                material="owned",
                provenance="test",
            ),
            "stats.funding_floor_gbp": KeyedFigure(
                key="stats.funding_floor_gbp",
                value=8_170_000,
                unit="gbp",
                material="owned",
                provenance="test",
                floor=True,
            ),
        }
    )


def test_swot_template_has_four_quadrants():
    j = _minimal_judgement(
        swot=SwotQuadrants(
            strengths=["Deep mode expertise"],
            weaknesses=["Funding visibility gaps"],
            opportunities=["Cross-sector bridges"],
            threats=["Policy volatility"],
        ),
    )
    index = _test_index()
    markup = build_swot_markup(j, index)
    assert 'data-testid="swot-quadrant"' in markup
    for label in ("STRENGTHS", "WEAKNESSES", "OPPORTUNITIES", "THREATS"):
        assert label in markup
    assert "Deep mode expertise" in markup


def test_template_fallback_from_query():
    j = _minimal_judgement()
    index = _test_index()
    markup = build_template_markup("SWOT analysis for CPC please", j, index)
    assert markup is not None
    assert "swot-quadrant" in markup


def test_recipe_lock_disabled_by_default(monkeypatch):
    monkeypatch.delenv("ATLAS_V5_RECIPE_LOCK", raising=False)
    from importlib import reload

    import agents.atlas_v5.composition_policy as policy

    reload(policy)
    assert policy.RECIPE_LOCK_ENABLED is False
    assert policy.should_use_recipe(
        policy.RecipeRecommendation("NetworkMap", "test"),
        free_compose_enabled=True,
    ) is False
