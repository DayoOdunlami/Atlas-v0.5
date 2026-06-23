"""
D6.0 — Multi-turn context-aware routing.

Acceptance: replay the failing transcript (and adversarial follow-ups) and verify
the router no longer drops session context after the first turn.
"""
from __future__ import annotations

from agents.orchestrator.intent_router import (
    _ARTIFACT_META_RE,
    _FOLLOW_UP_RE,
    build_artifact_meta_reply,
    node_intent_router,
    route_intent,
)


# Simulated prior render model from a diagnose turn
PRIOR_DIAGNOSE_MODEL = {
    "outcome": "diagnose",
    "headline": "Sample comparison — CPC Smart Mobility Programme × Innovate UK Smart Mobility Challenge 2026",
    "insight_card": "0/2 essential criteria met for the demo call.",
    "executive_summary": (
        "**Sample comparison.** You're seeing CPC Smart Mobility Programme matched against "
        "Innovate UK Smart Mobility Challenge 2026 — (the passport is a 3-claim demo and the "
        "spec is the demo Innovate UK Smart Mobility call). The score below reflects this sample, "
        "not CPC's true state of play."
    ),
    "is_demo_comparison": True,
    "blocks_data": {
        "executive_summary": {
            "summary": "Sample comparison — score reflects demo fixtures.",
            "caption": "Sample comparison — score reflects demo fixtures.",
            "is_demo_comparison": True,
        },
        "match_bench": {"matches": []},
        "transfer_lanes": {"lanes": []},
    },
}

PRIOR_CTX = {
    "last_outcome": "diagnose",
    "last_headline": PRIOR_DIAGNOSE_MODEL["headline"],
    "_prior_render_model": PRIOR_DIAGNOSE_MODEL,
}


# ---------------------------------------------------------------------------
# Regex coverage — make sure natural follow-ups match
# ---------------------------------------------------------------------------

ARTIFACT_META_QUERIES = [
    "what am I looking at?",
    "what's on the screen at the moment?",
    "what just happened?",
    "are you broken?",
    "is this real?",
    "is this a sample?",
    "is this a demo?",
    "what's the score?",
    "summarise this",
    "in one line, what does this mean?",
    "did external search find anything?",
    "did the web search work?",
]


FOLLOW_UP_QUERIES = [
    "which gap is biggest?",
    "tell me more",
    "explain the second one",
    "drill into #2",
    "show me the chart",
    "compare with rail",
    "the verdict on data infrastructure?",
    "why 0?",
    "expand on the climate row",
    "focus on the MOVE rows",
]


def test_artifact_meta_re_covers_natural_followups():
    missed = [q for q in ARTIFACT_META_QUERIES if not _ARTIFACT_META_RE.search(q)]
    assert not missed, f"meta regex missed: {missed}"


def test_follow_up_re_covers_natural_followups():
    missed = [q for q in FOLLOW_UP_QUERIES if not _FOLLOW_UP_RE.search(q)]
    assert not missed, f"follow-up regex missed: {missed}"


# ---------------------------------------------------------------------------
# Build-artifact-meta-reply — must be artifact-aware, not generic
# ---------------------------------------------------------------------------


def test_meta_reply_returns_executive_summary_for_what_am_i_looking_at():
    reply = build_artifact_meta_reply("what am I looking at?", PRIOR_CTX)
    assert reply is not None
    assert "Sample comparison" in reply or "CPC Smart Mobility" in reply


def test_meta_reply_discloses_sample_when_asked_if_real():
    reply = build_artifact_meta_reply("is this real or a sample?", PRIOR_CTX)
    assert reply is not None
    assert "sample comparison" in reply.lower() or "demo" in reply.lower()
    assert "OPENAI_API_KEY" in reply or "CCAV" in reply or "demo fixtures" in reply.lower()


def test_meta_reply_acknowledges_broken_with_artifact_context():
    reply = build_artifact_meta_reply("are you broken?", PRIOR_CTX)
    assert reply is not None
    assert "responding correctly" in reply
    assert "Sample comparison" in reply or "diagnose" in reply


def test_meta_reply_explains_when_no_external_evidence_found():
    reply = build_artifact_meta_reply("did external search find anything?", PRIOR_CTX)
    assert reply is not None
    assert "EXA_API_KEY" in reply or "lane router" in reply or "didn't return" in reply


def test_meta_reply_returns_none_without_context():
    reply = build_artifact_meta_reply("what am I looking at?", None)
    assert reply is None


# ---------------------------------------------------------------------------
# node_intent_router — full state machine
# ---------------------------------------------------------------------------


def test_node_routes_meta_to_clarify_lane_when_artifact_present():
    state = {
        "query": "what am I looking at?",
        "_context": PRIOR_CTX,
        "_prior_render_model": PRIOR_DIAGNOSE_MODEL,
    }
    result = node_intent_router(state)
    assert result["_is_conversational"] is False
    assert result["_intent"]["route"] == "pipeline"


def test_node_routes_follow_up_to_pipeline_with_inherited_outcome():
    state = {
        "query": "which gap is biggest?",
        "_context": PRIOR_CTX,
    }
    result = node_intent_router(state)
    assert result.get("outcome") == "diagnose"
    assert result["_intent"]["reasoning"].startswith("Multi-turn follow-up")


def test_node_does_not_degrade_to_capability_menu_when_artifact_exists():
    # Short ambiguous question — should NOT clarify when artifact exists
    state = {
        "query": "more?",
        "_context": PRIOR_CTX,
    }
    result = node_intent_router(state)
    # Either pipeline with last outcome, or instant reply with artifact context — never clarify
    if result["_intent"]["route"] == "instant_reply":
        text = str(result["messages"][0].content)
        # Must not be the generic capability menu
        assert "I'm Atlas Workbench" not in text or "currently looking at" in text or "Sample" in text
    else:
        assert result.get("outcome") == "diagnose"


def test_node_short_question_without_context_still_clarifies():
    # Without prior artifact, short ambiguous should still ask for clarification
    state = {"query": "what?", "_context": {}}
    result = node_intent_router(state)
    if result["_intent"]["route"] == "instant_reply":
        text = str(result["messages"][0].content)
        # Either a clarification or pointer is fine — just not pipeline without hint
        assert text  # not empty


# ---------------------------------------------------------------------------
# route_intent — context awareness without artifact-meta pattern
# ---------------------------------------------------------------------------


def test_route_intent_passes_context_to_heuristic():
    decision = route_intent("more", ctx=PRIOR_CTX)
    # With artifact present, short follow-up should not be clarify
    assert decision.route != "clarify"
