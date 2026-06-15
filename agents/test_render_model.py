"""D0.6 acceptance test — buildAtlasRenderModel keystone."""

from agents.registry.render_model import build_atlas_render_model, validate_render_model


def test_builds_valid_model():
    m = build_atlas_render_model(
        outcome="diagnose",
        headline="CPC has strong evidence in smart mobility",
        insight_card="Based on five verified corpus projects.",
        confidence_tier="Indicative",
        query="what evidence does CPC have in smart mobility",
        effort="analyze",
    )
    assert m["outcome"] == "diagnose"
    assert m["confidence_tier"] == "Indicative"
    assert m["blocks"] == []
    assert m["citation_guard"] is None
    assert m["falsification"] is None
    assert m["artifact_qa"] is None
    assert validate_render_model(m) == []


def test_all_five_outcomes_valid():
    for outcome in ("orient", "connect", "diagnose", "act", "defend"):
        m = build_atlas_render_model(
            outcome=outcome,  # type: ignore[arg-type]
            headline="Test headline for outcome",
            insight_card="Test insight card content.",
        )
        errs = validate_render_model(m)
        assert errs == [], f"Unexpected errors for outcome={outcome}: {errs}"


def test_invalid_tier_flagged():
    m = build_atlas_render_model(
        outcome="orient",
        headline="Test headline",
        insight_card="Test insight",
        confidence_tier="Unknown",  # type: ignore[arg-type]
    )
    errs = validate_render_model(m)
    assert any("confidence_tier" in e for e in errs)


def test_extra_keys_merged():
    m = build_atlas_render_model(
        outcome="diagnose",
        headline="Test headline",
        insight_card="Test insight",
        extra={"npv_value": 1_200_000, "discount_rate": 0.035},
    )
    assert m["npv_value"] == 1_200_000
    assert m["discount_rate"] == 0.035


def test_corpus_citations_default_empty():
    m = build_atlas_render_model(
        outcome="connect",
        headline="Test headline",
        insight_card="Test insight",
    )
    assert m["corpus_citations"] == []
    assert m["hive_citations"] == []
