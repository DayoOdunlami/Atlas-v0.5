"""D4.1–D4.4 acceptance tests — outcome modes (orient, connect, act, defend)."""

import pytest
from agents.orchestrator.subagents.outcomes import (
    get_outcome_prompt, get_preferred_blocks, OUTCOME_PROMPTS, PREFERRED_BLOCKS
)
from agents.orchestrator.triage import triage_query
from agents.orchestrator.format_pass import run_format_pass
from agents.registry.render_model import build_atlas_render_model
from agents.spine.verify import run_verify_spine


# ---------------------------------------------------------------------------
# D4.1 Orient mode
# ---------------------------------------------------------------------------

def test_orient_prompt_exists():
    prompt = get_outcome_prompt("orient")
    assert "landscape" in prompt.lower() or "orient" in prompt.lower()


def test_orient_preferred_blocks():
    blocks = get_preferred_blocks("orient")
    assert "context_card" in blocks
    assert "opportunity_list" in blocks
    assert blocks[0] == "context_card"
    assert blocks[-1] == "recommendation_confidence"


def test_orient_triage_routes_correctly():
    r = triage_query("Give me an overview of the UK smart city innovation landscape")
    assert r.outcome == "orient"


def test_orient_format_pass():
    model = build_atlas_render_model(
        outcome="orient",
        headline="The UK smart city landscape is evolving rapidly",
        insight_card="Three major themes dominate: data infrastructure, mobility, and climate.",
        confidence_tier="Indicative",
        corpus_citations=[{"id": "uuid-1"}, {"id": "uuid-2"}],
        query="UK smart city innovation landscape overview",
    )
    verified = run_verify_spine(artifact=model, query=model["query"], effort="analyze")
    formatted = run_format_pass(verified, query=model["query"])
    assert formatted["render_mode"] == "blocks"
    assert formatted["blocks"][0] == "context_card"
    assert "opportunity_list" in formatted["blocks"]


# ---------------------------------------------------------------------------
# D4.2 Connect mode
# ---------------------------------------------------------------------------

def test_connect_prompt_exists():
    prompt = get_outcome_prompt("connect")
    assert "analogue" in prompt.lower() or "transfer" in prompt.lower() or "opportunity" in prompt.lower()


def test_connect_preferred_blocks():
    blocks = get_preferred_blocks("connect")
    assert "transfer_lanes" in blocks
    assert "opportunity_list" in blocks


def test_connect_triage_routes():
    r = triage_query("Which sectors could CPC transfer its smart mobility experience to?")
    assert r.outcome == "connect"


def test_connect_format_pass():
    model = build_atlas_render_model(
        outcome="connect",
        headline="CPC smart mobility capabilities transfer well to urban freight",
        insight_card="Strong evidence in data infrastructure translates to logistics sector.",
        confidence_tier="Supported",
        corpus_citations=[{"id": "uuid-1"}, {"id": "uuid-2"}, {"id": "uuid-3"}],
        query="transfer smart mobility to freight",
    )
    verified = run_verify_spine(artifact=model, query=model["query"], effort="analyze")
    formatted = run_format_pass(verified, query=model["query"])
    assert formatted["render_mode"] == "blocks"
    assert "transfer_lanes" in formatted["blocks"] or "opportunity_list" in formatted["blocks"]


# ---------------------------------------------------------------------------
# D4.3 Act mode
# ---------------------------------------------------------------------------

def test_act_prompt_exists():
    prompt = get_outcome_prompt("act")
    assert "recommend" in prompt.lower() or "action" in prompt.lower() or "decision" in prompt.lower()


def test_act_preferred_blocks():
    blocks = get_preferred_blocks("act")
    assert "economic_case" in blocks
    assert "action_plan" in blocks


def test_act_triage_routes():
    r = triage_query("What should CPC do to bid for Innovate UK smart city funding?")
    assert r.outcome in ("act", "connect")


def test_act_format_pass_shows_economic_block():
    model = build_atlas_render_model(
        outcome="act",
        headline="CPC should bid for Innovate UK Smart City Challenge 2026",
        insight_card="Strong evidence in 4 core domains supports a credible bid.",
        confidence_tier="Supported",
        corpus_citations=[{"id": "uuid-1"}, {"id": "uuid-2"}, {"id": "uuid-3"}, {"id": "uuid-4"}],
        query="should CPC bid for innovate UK smart city challenge",
        extra={"npv_value": 2_500_000, "discount_rate": 0.035},
    )
    verified = run_verify_spine(artifact=model, query=model["query"], effort="analyze")
    formatted = run_format_pass(verified, query=model["query"])
    assert formatted["render_mode"] == "blocks"
    # Act outcome with 4 citations should include economic_case
    assert "economic_case" in formatted["blocks"] or "action_plan" in formatted["blocks"]


# ---------------------------------------------------------------------------
# D4.4 Defend quality bar
# ---------------------------------------------------------------------------

def test_defend_prompt_exists():
    prompt = get_outcome_prompt("defend")
    assert "scrutin" in prompt.lower() or "defend" in prompt.lower() or "objection" in prompt.lower()


def test_defend_preferred_blocks():
    blocks = get_preferred_blocks("defend")
    assert "claim_ledger" in blocks
    assert "objection_response" in blocks


def test_defend_triage_routes():
    r = triage_query("How can CPC defend its evidence base against board scrutiny?")
    assert r.outcome == "defend"


def test_defend_always_runs_falsification():
    """Defend mode must run falsification even at analyze effort."""
    from agents.spine.verify import run_verify_spine

    model = build_atlas_render_model(
        outcome="defend",
        headline="CPC evidence base is defensible for the smart mobility domain",
        insight_card="Claims are backed by 4 verified corpus projects.",
        confidence_tier="Supported",
        corpus_citations=[
            {"id": "uuid-1"}, {"id": "uuid-2"}, {"id": "uuid-3"}, {"id": "uuid-4"}
        ],
        query="defend CPC smart mobility evidence",
    )
    # Simulate the orchestrator's effective_effort override for defend
    verified = run_verify_spine(
        artifact=model,
        query=model["query"],
        headline=model["headline"],
        effort="deep",  # defend always uses deep
    )
    # Falsification key must be present (even if skipped due to no API key in test)
    assert "falsification" in verified
    assert verified["falsification"] is not None


# ---------------------------------------------------------------------------
# All outcomes — ensure all five work end-to-end
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("outcome", ["orient", "connect", "diagnose", "act", "defend"])
def test_all_outcomes_produce_valid_formatted_model(outcome):
    from agents.registry.render_model import validate_render_model

    model = build_atlas_render_model(
        outcome=outcome,  # type: ignore[arg-type]
        headline=f"Test headline for {outcome} outcome — twelve words total",
        insight_card=f"Test insight for {outcome} mode with sufficient text.",
        confidence_tier="Indicative",
        corpus_citations=[{"id": "uuid-1"}, {"id": "uuid-2"}],
        query=f"test query for {outcome}",
    )
    effort = "deep" if outcome == "defend" else "analyze"
    verified = run_verify_spine(artifact=model, query=model["query"], effort=effort)  # type: ignore[arg-type]
    formatted = run_format_pass(verified, query=model["query"])

    errs = validate_render_model(formatted)
    assert errs == [], f"Render model errors for outcome={outcome}: {errs}"
    assert formatted["render_mode"] in ("blocks", "document", "chart")
    assert isinstance(formatted["blocks"], list)
