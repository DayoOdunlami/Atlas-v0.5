"""D2.1 + D2.2 acceptance tests — gap-signal emitters + capability-gap report."""

from agents.registry.render_model import build_atlas_render_model
from agents.spine.verify import run_verify_spine
from agents.instrumentation.signals import (
    extract_signals_from_model,
    emit_tier_low,
    emit_citations_dropped,
    emit_prose_fallback,
)
from agents.instrumentation.gap_report import GapReport, build_report_from_model


def _make_speculative_model():
    return build_atlas_render_model(
        outcome="diagnose",
        headline="No evidence found for this query",
        insight_card="No corpus citations available.",
        confidence_tier="Speculative",
        corpus_citations=[],
        query="what evidence does CPC have in quantum computing",
    )


def _make_supported_model():
    return build_atlas_render_model(
        outcome="diagnose",
        headline="CPC has strong evidence in smart mobility infrastructure",
        insight_card="Based on three verified corpus projects.",
        confidence_tier="Supported",
        corpus_citations=[
            {"id": "uuid-1"}, {"id": "uuid-2"}, {"id": "uuid-3"},
        ],
        query="what evidence does CPC have in smart mobility",
    )


# ---------------------------------------------------------------------------
# Signal emitters
# ---------------------------------------------------------------------------

def test_emit_tier_low():
    sig = emit_tier_low(node="verify", tier="Speculative", citation_count=0)
    assert sig.signal_type == "tier_low"
    assert sig.severity == "warn"
    assert "Speculative" in sig.message


def test_emit_citations_dropped():
    sig = emit_citations_dropped(
        node="verify",
        original_tier="Robust",
        final_tier="Indicative",
        citation_count=2,
        reason="Only 2 citations",
    )
    assert sig.signal_type == "citations_dropped"
    assert "Robust" in sig.message
    assert "Indicative" in sig.message


def test_emit_prose_fallback():
    sig = emit_prose_fallback(node="format", reason="tier=Speculative")
    assert sig.signal_type == "prose_fallback"
    assert sig.severity == "info"


# ---------------------------------------------------------------------------
# extract_signals_from_model
# ---------------------------------------------------------------------------

def test_extract_signals_tier_low():
    model = _make_speculative_model()
    verified = run_verify_spine(artifact=model, query=model["query"], effort="analyze")
    signals = extract_signals_from_model(
        verified,
        query=verified["query"],
        format_node_render_mode="document",  # Speculative → document mode
    )
    types = [s.signal_type for s in signals]
    assert "tier_low" in types
    assert "prose_fallback" in types


def test_no_signals_for_clean_supported_model():
    model = _make_supported_model()
    verified = run_verify_spine(artifact=model, query=model["query"], effort="analyze")
    signals = extract_signals_from_model(
        verified,
        query=verified["query"],
        format_node_render_mode="blocks",
    )
    # A clean Supported model with 3 citations should have no tier_low or citations_dropped
    types = [s.signal_type for s in signals]
    assert "tier_low" not in types
    assert "citations_dropped" not in types


# ---------------------------------------------------------------------------
# GapReport
# ---------------------------------------------------------------------------

def test_gap_report_accumulates():
    report = GapReport()

    for _ in range(3):
        model = _make_speculative_model()
        verified = run_verify_spine(artifact=model, query=model["query"], effort="analyze")
        report = build_report_from_model(
            verified, query=model["query"], render_mode="document", report=report
        )

    assert report.run_count == 3
    assert report.tier_low_rate > 0
    summary = report.summarise()
    assert summary["run_count"] == 3
    assert "tier_low" in summary["by_type"]


def test_gap_report_no_signals_for_clean():
    report = GapReport()
    model = _make_supported_model()
    verified = run_verify_spine(artifact=model, query=model["query"], effort="analyze")
    report = build_report_from_model(
        verified, query=model["query"], render_mode="blocks", report=report
    )
    assert report.run_count == 1
    # No critical signals for a clean model
    assert not report.has_critical


def test_gap_report_to_json():
    report = GapReport()
    model = _make_speculative_model()
    verified = run_verify_spine(artifact=model, query=model["query"], effort="analyze")
    report = build_report_from_model(
        verified, query=model["query"], render_mode="document", report=report
    )
    import json
    data = json.loads(report.to_json())
    assert "run_count" in data
    assert "top_gaps" in data
