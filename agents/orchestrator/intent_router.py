"""
Orchestrator intent router — Layer 1 intelligence before triage.

World-class pattern (OpenAI/Google/Cursor-style):
  1. Normalize input (extract_query node)
  2. Fast structured classifier (Haiku) → route + hints
  3. Optional corpus probe for entity questions (company in corpus?)
  4. Pipeline triage/builders with hints

Without ANTHROPIC_API_KEY only pure greetings/meta get instant replies;
everything else enters the deterministic pipeline (no fake "chat").
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, Field, ValidationError

from agents.base import extract_latest_query
from agents.orchestrator.conversational import (
    build_conversational_reply,
    should_reply_conversationally_strict,
)

logger = logging.getLogger(__name__)

Route = Literal["pipeline", "instant_reply", "clarify"]

INTENT_MODEL = os.getenv("INTENT_MODEL_NAME", "claude-haiku-4-5")


class IntentRouterOutput(BaseModel):
    """Structured Haiku output — one decision per turn."""

    route: Route = Field(
        description=(
            "pipeline = run corpus-backed orchestrator; "
            "instant_reply = greeting/meta/off-topic without pipeline; "
            "clarify = need one follow-up question before pipeline"
        ),
    )
    instant_reply: str | None = Field(
        default=None,
        description="Markdown reply when route is instant_reply",
    )
    clarify_question: str | None = Field(
        default=None,
        description="Single follow-up when route is clarify",
    )
    outcome_hint: Literal["orient", "connect", "diagnose", "act", "defend"] | None = None
    effort_hint: Literal["clarify", "refine", "analyze", "deep"] | None = None
    corpus_probe: bool = Field(
        default=False,
        description="True if we should check atlas.projects for an entity name first",
    )
    external_search: bool = Field(
        default=False,
        description="True if user needs live web (only after gate in deep mode)",
    )
    reasoning: str = Field(default="", description="One sentence, internal audit trail")


@dataclass
class IntentDecision:
    route: Route
    instant_reply: str | None = None
    clarify_question: str | None = None
    outcome_hint: str | None = None
    effort_hint: str | None = None
    corpus_probe: bool = False
    external_search: bool = False
    reasoning: str = ""
    source: Literal["haiku", "heuristic", "corpus_probe"] = "heuristic"
    corpus_hits: list[dict[str, Any]] = field(default_factory=list)


_INTENT_SYSTEM = """You are the intent router for Atlas Workbench (Connected Places Catapult).

Decide how to handle the user's latest message BEFORE any heavy research runs.

## Routes
- **pipeline** — CPC / transport / innovation / evidence / funding / investment / SWOT / strategy questions. Includes mixed messages ("hi, what evidence…") — extract the substantive part and pipeline.
- **instant_reply** — Pure greeting, thanks, or meta ("who are you", "how do you work", "limits"). Also clearly off-topic trivia (Haribo, random companies with NO CPC angle).
- **clarify** — Ambiguous but potentially in-scope; ask ONE focused follow-up (not a generic menu).

## Rules
- Prefer **pipeline** when ANY strategic or CPC-relevant intent exists.
- "help me with SWOT for rail" → pipeline (outcome_hint orient or act), NOT instant_reply.
- "tell me about company X" → corpus_probe true; if unknown entity, clarify or instant_reply with reframe.
- Never invent corpus IDs. Do not claim you searched unless corpus_probe will run after you.
- Mixed greeting + question → pipeline with brief acknowledgment optional in reasoning only.
- output instant_reply in markdown when route is instant_reply.

Respond ONLY with JSON matching the schema."""


def _extract_entity_for_probe(query: str) -> str | None:
    """Best-effort entity string for corpus ILIKE probe."""
    patterns = [
        r"tell me about ([\w\s&.-]{2,60})",
        r"what (?:is|are) ([\w\s&.-]{2,60})\??",
        r"company ([\w\s&.-]{2,40})",
    ]
    ql = query.strip()
    for pat in patterns:
        m = re.search(pat, ql, re.I)
        if m:
            entity = m.group(1).strip(" ?.")
            if entity.lower() not in {"cpc", "the cpc", "connected places catapult", "atlas"}:
                return entity
    return None


def _probe_corpus(entity: str, limit: int = 3) -> list[dict[str, Any]]:
    try:
        from mcps.cpc_corpus import queries as cq

        return cq.search_projects(entity, limit=limit) or []
    except Exception as exc:
        logger.debug("corpus probe failed: %s", exc)
        return []


def _haiku_route(query: str) -> IntentRouterOutput | None:
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from langchain_anthropic import ChatAnthropic

        llm = ChatAnthropic(
            model=INTENT_MODEL,
            api_key=api_key,
            max_tokens=600,
            temperature=0,
        )
        structured = llm.with_structured_output(IntentRouterOutput)
        return structured.invoke(
            [
                SystemMessage(content=_INTENT_SYSTEM),
                HumanMessage(content=f"User message:\n{query}"),
            ],
        )
    except Exception as exc:
        logger.warning("Haiku intent router failed, falling back: %s", exc)
        return None


def _heuristic_route(query: str) -> IntentDecision:
    """Strict fallback — only blocks pure conversational; never blocks SWOT/CPC."""
    if should_reply_conversationally_strict(query):
        return IntentDecision(
            route="instant_reply",
            instant_reply=build_conversational_reply(query),
            reasoning="Strict heuristic: greeting or meta-only",
            source="heuristic",
        )
    if len(query.split()) <= 4 and "?" in query:
        return IntentDecision(
            route="clarify",
            clarify_question=(
                "Could you add the topic or outcome you need "
                "(e.g. evidence gaps, funding fit, SWOT, investment case)?"
            ),
            reasoning="Strict heuristic: short ambiguous question",
            source="heuristic",
        )
    return IntentDecision(
        route="pipeline",
        reasoning="Strict heuristic: default to pipeline",
        source="heuristic",
    )


def route_intent(query: str) -> IntentDecision:
    """Main entry — Haiku when available, else strict heuristics + corpus probe."""
    q = (query or "").strip()
    if not q:
        return IntentDecision(
            route="instant_reply",
            instant_reply="Send a message when you're ready — ask about CPC evidence, funding fit, or strategy.",
            source="heuristic",
        )

    # Mixed intent: greeting + substantive question → pipeline
    if re.match(r"^\s*(hi|hello|hey)[\s,—-]+", q, re.I) and len(q.split()) > 6:
        substantive = re.sub(r"^\s*(hi|hello|hey)[\s,—-]+", "", q, flags=re.I).strip()
        if substantive and not should_reply_conversationally_strict(substantive):
            return IntentDecision(
                route="pipeline",
                reasoning="Mixed greeting + strategic question — pipeline substantive part",
                source="heuristic",
            )

    parsed = _haiku_route(q)
    if parsed is None:
        return _heuristic_route(q)

    decision = IntentDecision(
        route=parsed.route,
        instant_reply=parsed.instant_reply,
        clarify_question=parsed.clarify_question,
        outcome_hint=parsed.outcome_hint,
        effort_hint=parsed.effort_hint,
        corpus_probe=parsed.corpus_probe,
        external_search=parsed.external_search,
        reasoning=parsed.reasoning or "Haiku classification",
        source="haiku",
    )

    if parsed.corpus_probe:
        entity = _extract_entity_for_probe(q)
        if entity:
            hits = _probe_corpus(entity)
            decision.corpus_hits = hits
            if hits and parsed.route == "instant_reply":
                decision.route = "pipeline"
                decision.instant_reply = None
                decision.reasoning = f"Corpus probe found {len(hits)} hit(s) for '{entity}' — entering pipeline"
                decision.source = "corpus_probe"
            elif not hits and parsed.route == "pipeline":
                pass  # pipeline will run with weak/no corpus
            elif not hits and parsed.route == "instant_reply":
                pass  # keep off-topic redirect

    return decision


_FOLLOW_UP_RE = re.compile(
    r"\b(compare|versus|vs\.?|that|this|those|these|drill|second|first|#2|number two|the other)\b",
    re.I,
)


def node_intent_router(state: dict[str, Any]) -> dict[str, Any]:
    query = (state.get("query") or extract_latest_query(state) or "").strip()
    ctx = state.get("_context") or {}

    # Multi-turn follow-ups that reference prior context — keep same lane unless query shifts outcome
    if query and ctx.get("last_outcome") and _FOLLOW_UP_RE.search(query):
        from agents.orchestrator.triage import triage_query

        triage = triage_query(query)
        hint = triage.outcome if triage.outcome != "orient" else ctx.get("last_outcome")
        decision = IntentDecision(
            route="pipeline",
            outcome_hint=hint,
            effort_hint=triage.effort if triage.effort != "clarify" else None,
            reasoning="Multi-turn follow-up with session context",
            source="heuristic",
        )
    else:
        decision = route_intent(query)

    base: dict[str, Any] = {
        "_intent": {
            "route": decision.route,
            "source": decision.source,
            "reasoning": decision.reasoning,
            "outcome_hint": decision.outcome_hint,
            "effort_hint": decision.effort_hint,
            "corpus_hits": decision.corpus_hits,
        },
        "_is_conversational": decision.route != "pipeline",
    }

    if decision.outcome_hint:
        base["outcome"] = decision.outcome_hint
    if decision.effort_hint:
        base["effort"] = decision.effort_hint

    if decision.route == "pipeline":
        return base

    text = decision.instant_reply or decision.clarify_question or build_conversational_reply(query)
    return {
        **base,
        "messages": [AIMessage(content=text, id=str(uuid.uuid4()))],
    }


def route_after_intent_router(state: dict[str, Any]) -> str:
    from langgraph.graph import END

    return END if state.get("_is_conversational") else "triage"
