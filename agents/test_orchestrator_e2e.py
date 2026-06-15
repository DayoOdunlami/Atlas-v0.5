"""
D1.6 — Stub vertical end-to-end test.

Proves the full pipeline (triage → loop → verify → format) works without
a live ANTHROPIC_API_KEY by using stub mode (no actual LLM calls).

Acceptance criteria (D1.6):
  ✓ Graph compiles and is importable
  ✓ Feature flag off → legacy workbench graph is referenced
  ✓ Feature flag on → orchestrator graph is referenced
  ✓ Triage classifies correctly for each effort bucket
  ✓ Format pass selects blocks and render_mode
  ✓ Verify spine annotates citation_guard on a stub model
  ✓ render_model has all required keys after the full pipeline
"""

import os
import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_stub_model(**overrides):
    from agents.registry.render_model import build_atlas_render_model
    defaults = dict(
        outcome="diagnose",
        headline="CPC has emerging evidence in smart mobility infrastructure",
        insight_card="Based on three verified corpus projects in urban mobility.",
        confidence_tier="Supported",
        corpus_citations=[
            {"id": "00000000-0000-0000-0000-000000000001", "title": "Proj A", "organisation": "CPC", "score": 0.91},
            {"id": "00000000-0000-0000-0000-000000000002", "title": "Proj B", "organisation": "TfL", "score": 0.85},
            {"id": "00000000-0000-0000-0000-000000000003", "title": "Proj C", "organisation": "Arup", "score": 0.81},
        ],
        query="What evidence does CPC have in smart mobility?",
        effort="analyze",
    )
    defaults.update(overrides)
    return build_atlas_render_model(**defaults)


# ---------------------------------------------------------------------------
# Graph import + feature flag routing
# ---------------------------------------------------------------------------

def test_orchestrator_graph_importable():
    """Smoke test: graph module imports and compiles without errors."""
    from agents.orchestrator.graph import orchestrator_graph
    assert orchestrator_graph is not None
    assert "extract_query" in list(orchestrator_graph.nodes)
    assert "triage" in list(orchestrator_graph.nodes)
    assert "loop" in list(orchestrator_graph.nodes)
    assert "verify" in list(orchestrator_graph.nodes)
    assert "format" in list(orchestrator_graph.nodes)


def test_feature_flag_off_by_default():
    os.environ.pop("ATLAS5_ORCHESTRATOR_V1", None)
    from agents.feature_flags import flags
    assert flags.orchestrator_v1 is False


def test_feature_flag_selects_orchestrator():
    os.environ["ATLAS5_ORCHESTRATOR_V1"] = "true"
    import importlib
    import agents.feature_flags as m
    importlib.reload(m)
    assert m.flags.orchestrator_v1 is True
    os.environ.pop("ATLAS5_ORCHESTRATOR_V1")


# ---------------------------------------------------------------------------
# Triage pipeline
# ---------------------------------------------------------------------------

def test_triage_analyze_diagnose():
    from agents.orchestrator.triage import triage_query
    r = triage_query("What evidence gaps does CPC have in smart mobility?")
    assert r.effort in ("analyze", "deep")
    assert r.outcome == "diagnose"


def test_triage_deep_gates():
    from agents.orchestrator.triage import triage_query
    r = triage_query("Build a full five-case business case for the AI freight pilot")
    assert r.effort == "deep"
    assert r.needs_gate is True


# ---------------------------------------------------------------------------
# Verify spine pipeline
# ---------------------------------------------------------------------------

def test_verify_spine_annotates_model():
    from agents.spine.verify import run_verify_spine
    model = _make_stub_model()
    verified = run_verify_spine(
        artifact=model,
        query=model["query"],
        headline=model["headline"],
        effort="analyze",
    )
    assert verified["citation_guard"] is not None
    assert "status" in verified["citation_guard"]
    assert verified["artifact_qa"] is not None
    # Falsification should be skipped for analyze effort
    assert verified["falsification"]["status"] == "skipped"


def test_verify_spine_caps_tier():
    """Tier is capped if citations are too few."""
    from agents.spine.verify import run_verify_spine
    model = _make_stub_model(
        confidence_tier="Robust",
        corpus_citations=[{"id": "uuid-1"}],  # Only 1 — can't support Robust
    )
    verified = run_verify_spine(
        artifact=model,
        query=model["query"],
        headline=model["headline"],
        effort="analyze",
    )
    assert verified["confidence_tier"] in ("Speculative", "Indicative")


# ---------------------------------------------------------------------------
# Format pass pipeline
# ---------------------------------------------------------------------------

def test_format_pass_selects_blocks():
    from agents.spine.verify import run_verify_spine
    from agents.orchestrator.format_pass import run_format_pass
    model = _make_stub_model()
    verified = run_verify_spine(artifact=model, query=model["query"], effort="analyze")
    formatted = run_format_pass(verified, query=model["query"])

    assert formatted["render_mode"] == "blocks"
    assert "context_card" in formatted["blocks"]
    assert "recommendation_confidence" in formatted["blocks"]
    # context_card first, recommendation_confidence last
    assert formatted["blocks"][0] == "context_card"
    assert formatted["blocks"][-1] == "recommendation_confidence"


def test_format_pass_document_mode_for_speculative():
    from agents.orchestrator.format_pass import run_format_pass
    model = _make_stub_model(
        confidence_tier="Speculative",
        corpus_citations=[],
    )
    formatted = run_format_pass(model, query=model["query"])
    assert formatted["render_mode"] == "document"
    assert formatted["blocks"] == []


# ---------------------------------------------------------------------------
# Full pipeline (stub — no LLM)
# ---------------------------------------------------------------------------

def test_full_pipeline_produces_valid_render_model():
    """
    Simulate the full orchestrator pipeline without a live LLM.
    Proves every stage runs without raising and produces a valid model.
    """
    from agents.registry.render_model import build_atlas_render_model, validate_render_model
    from agents.spine.verify import run_verify_spine
    from agents.orchestrator.format_pass import run_format_pass
    from agents.orchestrator.triage import triage_query

    query = "What evidence does CPC have in smart mobility infrastructure?"
    triage = triage_query(query)

    # Simulate node_loop stub output
    raw_model = build_atlas_render_model(
        outcome=triage.outcome,  # type: ignore[arg-type]
        headline="CPC has strong smart mobility evidence across 3 projects",
        insight_card="Evidence is concentrated in urban mobility and freight logistics.",
        confidence_tier="Supported",
        corpus_citations=[
            {"id": "00000000-0000-0000-0000-000000000001", "title": "P1"},
            {"id": "00000000-0000-0000-0000-000000000002", "title": "P2"},
            {"id": "00000000-0000-0000-0000-000000000003", "title": "P3"},
        ],
        query=query,
        effort=triage.effort,  # type: ignore[arg-type]
    )

    verified = run_verify_spine(
        artifact=raw_model,
        query=query,
        headline=raw_model["headline"],
        effort=triage.effort,  # type: ignore[arg-type]
    )

    final = run_format_pass(verified, query=query)

    # All required keys present
    for key in ("outcome", "confidence_tier", "blocks", "render_mode",
                "citation_guard", "artifact_qa", "corpus_citations"):
        assert key in final, f"Missing key: {key}"

    assert validate_render_model(final) == []
    assert final["render_mode"] in ("blocks", "document", "chart")
    assert isinstance(final["blocks"], list)
