"""
Turn lanes — clarify | refine | analyze (Sprint 4 port → orchestrator v1).

Runs after intent_router when route=pipeline. Requires prior render_model for
clarify/refine; otherwise falls through to analyze (full pipeline).
"""
from __future__ import annotations

import re
from typing import Any, Literal

TurnLane = Literal["clarify", "refine", "analyze"]

_CLARIFY_PATTERNS: tuple[str, ...] = (
    r"^what('s| is| are| am)\b",
    r"^explain\b",
    r"^how (does|do|is|are|can|was|were)\b",
    r"^why (?:is|are|does|do|isn't|aren't|won't|not)\b",
    r"^define\b",
    r"\bwhat('s| is) (npv|stpr|green book|the score|the fit|the verdict|the gap)\b",
    r"\bhow (was|is) .*(calculated|computed|derived)\b",
    r"^can you explain\b",
    r"^tell me (more )?about\b",
    r"^what does .+ mean\b",
    r"^which (?:gap|opportunity|project|claim|criterion|one|is|are) (?:is|are|biggest|best)\b",
    r"\bcompare .+ (vs|versus|or)\b",
    r"what(?:'s| is| am)?\s+(?:on(?:\s+the)?\s+screen|am\s+i\s+looking\s+at|this(?:\s+about)?|here)\b",
    r"what(?:\s+just)?\s+happen(?:ed)?",
    r"are\s+you\s+(?:broken|stuck|ok|okay)",
    r"is\s+this\s+(?:real|right|correct|true|a\s+sample|a\s+demo|fake)\b",
    r"why\s+(?:isn't|is\s+not|won't|doesn't)\s+(?:the\s+)?(?:artifact|canvas|screen|panel)\b",
    r"artifact\s+not\s+updat",
    r"summari[sz]e\s+(?:this|that|the\s+artifact)",
    r"in\s+one\s+(?:line|sentence)",
    r"did\s+(?:the\s+)?(?:external|web)\s+search",
)

_REFINE_PATTERNS: tuple[str, ...] = (
    r"\badd\b",
    r"\binclude\b",
    r"\bupdate\b",
    r"\bsharpen\b",
    r"\bexpand\b",
    r"\bfocus on\b",
    r"\bstrengthen\b",
    r"\bimprove\b",
    r"\bmake the headline\b",
    r"\badd key players\b",
    r"\brefine\b",
    r"\bpatch\b",
    r"\bintegrate\b",
    r"\bemphasize\b",
    r"\bde-emphasize\b",
    r"\bdrill into\b",
    r"\bnarrow (?:to|down)\b",
)

_NEW_ANALYSIS_PATTERNS: tuple[str, ...] = (
    r"\bfive case\b",
    r"\bbusiness case\b",
    r"\binvestment (?:case|brief)\b",
    r"\bswot\b",
    r"\bgive me a\b",
    r"\bbuild a\b",
    r"\brun a\b",
    r"\bnew analysis\b",
    r"\bstart over\b",
    r"\bfrom scratch\b",
    r"\bwhat should we do\b",
    r"\bnext 90 days\b",
    r"\bwhat should we collect\b",
)


def has_prior_artifact(state: dict[str, Any]) -> bool:
    prior = state.get("_prior_render_model") or state.get("render_model")
    if not isinstance(prior, dict):
        return False
    return bool(
        prior.get("headline")
        or prior.get("blocks_data")
        or prior.get("render_blocks")
    )


def classify_turn_lane(query: str, *, has_prior: bool) -> TurnLane:
    """Fast turn-lane classifier — no LLM."""
    if not has_prior:
        return "analyze"
    q = (query or "").strip().lower()
    if not q:
        return "analyze"
    if any(re.search(p, q) for p in _NEW_ANALYSIS_PATTERNS):
        return "analyze"
    if any(re.search(p, q) for p in _REFINE_PATTERNS):
        return "refine"
    if any(re.search(p, q) for p in _CLARIFY_PATTERNS):
        return "clarify"
    if len(q.split()) <= 16 and "?" in q:
        return "clarify"
    return "analyze"


def node_classify_turn_lane(state: dict[str, Any]) -> dict[str, Any]:
    query = (state.get("query") or "").strip()
    has_prior = has_prior_artifact(state)
    lane = classify_turn_lane(query, has_prior=has_prior)
    if lane in ("clarify", "refine") and not has_prior:
        lane = "analyze"
    return {
        "turn_lane": lane,
        "_turn_lane_notes": (
            f"Turn lane: {lane}. "
            + ("Prior artifact present." if has_prior else "Cold session — full pipeline.")
        ),
    }


def route_after_turn_lane(state: dict[str, Any]) -> str:
    lane = state.get("turn_lane", "analyze")
    if lane == "clarify":
        return "clarify_artifact"
    if lane == "refine":
        return "refine_artifact"
    return "triage"
