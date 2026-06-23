"""D1.1 acceptance tests — triage + gate nodes."""

from agents.orchestrator.triage import triage_query
from agents.orchestrator.gate import build_gate_payload, interpret_gate_response


# ---------------------------------------------------------------------------
# triage_query
# ---------------------------------------------------------------------------

def test_clarify_for_greeting():
    r = triage_query("hi")
    assert r.effort == "clarify"


def test_clarify_for_very_short():
    r = triage_query("ok")
    assert r.effort == "clarify"


def test_deep_for_business_case():
    r = triage_query("Build a full business case for CPC's smart mobility investment")
    # Five Case act brief uses deterministic builder — analyze, no HITL gate
    assert r.effort == "analyze"
    assert r.outcome == "act"
    assert r.needs_gate is False


def test_deep_for_npv():
    r = triage_query("What is the NPV of the proposed freight innovation programme?")
    assert r.effort == "deep"


def test_analyze_outcome_diagnose():
    r = triage_query("What evidence gaps does CPC have in urban mobility?")
    assert r.effort in ("analyze", "deep")
    assert r.outcome == "diagnose"


def test_analyze_outcome_connect():
    r = triage_query("Which sectors can we transfer our smart infrastructure experience to?")
    assert r.outcome == "connect"


def test_analyze_outcome_defend():
    r = triage_query("How can we defend our evidence base in a board scrutiny session?")
    assert r.outcome == "defend"


def test_analyze_outcome_act():
    r = triage_query("What should CPC do next to bid for Innovate UK funding?")
    assert r.outcome in ("act", "connect")


def test_orient_default():
    r = triage_query("Tell me about the smart mobility landscape")
    assert r.outcome == "orient"


# ---------------------------------------------------------------------------
# build_gate_payload
# ---------------------------------------------------------------------------

def test_gate_payload_deep_act():
    r = triage_query("Build me a five-case model for the freight AI pilot")
    payload = build_gate_payload(r)
    assert payload.effort == r.effort
    assert payload.outcome == r.outcome
    assert len(payload.research_plan) >= 1
    assert "?" in payload.question


# ---------------------------------------------------------------------------
# interpret_gate_response
# ---------------------------------------------------------------------------

def test_confirm_by_default():
    assert interpret_gate_response("yes go ahead") == "confirm"
    assert interpret_gate_response("sure") == "confirm"
    assert interpret_gate_response("") == "confirm"


def test_decline():
    assert interpret_gate_response("no") == "decline"
    assert interpret_gate_response("stop") == "decline"
    assert interpret_gate_response("cancel please") == "decline"


def test_refine():
    assert interpret_gate_response("actually focus on freight only") == "refine"
    assert interpret_gate_response("change to look at climate risk instead") == "refine"
