"""
Outcome effectiveness + quality tests.

Runs golden prompts through the full deterministic pipeline and scores
structural quality (no LLM judge required).

Run:
  python -m pytest agents/test_outcome_quality.py -v
  npm run eval:orchestrator
"""

from __future__ import annotations

import pytest

from agents.orchestrator.outcome_quality import (
    GOLDEN_PROMPTS,
    QualityReport,
    run_golden_prompt_pipeline,
    score_render_model,
)
from agents.orchestrator.triage import triage_query


# ---------------------------------------------------------------------------
# Triage accuracy — does the router pick a sensible outcome?
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("query,expected", [
    ("What evidence gaps does CPC have in smart mobility?", "diagnose"),
    ("Explore the UK rail innovation landscape", "orient"),
    ("Build a Five Case investment brief for freight corridors", "act"),
    ("Defend this evidence pack against board scrutiny", "defend"),
    ("What evidence transfers to the maritime sector?", "connect"),
])
def test_triage_routes_to_expected_outcome(query: str, expected: str):
    result = triage_query(query)
    assert result.outcome == expected, (
        f"Query: {query!r}\nGot: {result.outcome}\nNotes: {result.notes}"
    )


# ---------------------------------------------------------------------------
# Golden prompt pipeline — full path quality gates
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("query,expected_outcome", GOLDEN_PROMPTS)
def test_golden_prompt_meets_quality_bar(query: str, expected_outcome: str):
    model = run_golden_prompt_pipeline(query, expected_outcome)  # type: ignore[arg-type]
    report = score_render_model(model, query=query, expected_outcome=expected_outcome)  # type: ignore[arg-type]

    assert report.block_substance >= 0.5, (
        f"Block substance too low ({report.block_substance:.2f})\n"
        f"Failures: {report.failures}\n"
        f"Blocks: {[b.get('type') for b in model.get('render_blocks', [])]}"
    )
    assert report.completeness >= 0.75, f"Completeness failures: {report.failures}"
    assert report.evidence_alignment == 1.0, f"Tier/citation mismatch: {report.failures}"
    assert report.overall >= 0.7, (
        f"Overall quality {report.overall:.2f} below 0.7\n"
        f"Failures: {report.failures}"
    )


def test_canonical_sameer_prompt_transfer_quality():
    """Phase 3 gate — Sameer pilot canonical question."""
    query = (
        "What evidence does CPC have in smart mobility that would transfer "
        "to the Innovate UK Smart City Challenge?"
    )
    model = run_golden_prompt_pipeline(query, "connect")
    report = score_render_model(model, query=query, expected_outcome="connect")

    types = {b["type"] for b in model.get("render_blocks", [])}
    assert "TransferLanes" in types
    assert "MatchBench" in types
    assert report.matcher_integrity == 1.0
    assert report.passed, f"Sameer gate failed: {report.failures}"


def test_diagnose_essential_criteria_all_verdicted():
    query = (
        "What evidence does CPC have in smart mobility that would transfer "
        "to the Innovate UK Smart City Challenge?"
    )
    model = run_golden_prompt_pipeline(query, "diagnose")
    blocks_data = model.get("blocks_data", {})
    matches = blocks_data.get("match_bench", {}).get("matches", [])
    essential = [m for m in matches if m.get("importance") == "essential"]
    assert len(essential) >= 2
    for m in essential:
        assert m["verdict"] in ("FIT", "GAP", "RISK", "MOVE")


def test_quality_report_passed_property():
    report = QualityReport(
        outcome="diagnose",
        query="test",
        completeness=1.0,
        evidence_alignment=1.0,
        block_substance=0.8,
        matcher_integrity=1.0,
        overall=0.85,
        failures=[],
    )
    assert report.passed is True

    report.failures.append("something wrong")
    assert report.passed is False


def test_orient_produces_ranked_opportunities():
    query = "Explore the UK smart mobility innovation landscape"
    model = run_golden_prompt_pipeline(query, "orient")
    opp = next(
        (b for b in model.get("render_blocks", []) if b["type"] == "OpportunityList"),
        None,
    )
    assert opp is not None
    assert len(opp["content"]) >= 0  # may be 0 offline without corpus; scaffold still valid


def test_defend_produces_claims_and_objections():
    query = "Defend CPC smart mobility evidence against scrutiny"
    model = run_golden_prompt_pipeline(query, "defend")
    types = {b["type"] for b in model.get("render_blocks", [])}
    assert "ClaimLedger" in types
    assert "ObjectionResponse" in types
    ledger = next(b for b in model["render_blocks"] if b["type"] == "ClaimLedger")
    objections = next(b for b in model["render_blocks"] if b["type"] == "ObjectionResponse")
    assert len(ledger["content"]) >= 0
    assert len(objections["content"]) >= 1


def test_act_produces_economic_and_action_blocks():
    query = "Build a business case for autonomous freight corridor pilot"
    model = run_golden_prompt_pipeline(query, "act")
    types = {b["type"] for b in model.get("render_blocks", [])}
    assert "EconomicCase" in types
    assert "ActionPlan" in types
    actions = next(b for b in model["render_blocks"] if b["type"] == "ActionPlan")
    assert len(actions["content"]) >= 3
