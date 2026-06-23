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
- **pipeline** — CPC / transport / innovation / evidence / funding / investment / SWOT / strategy questions. Includes mixed messages ("hi, what evidence…") — extract the substantive part and pipeline. Also: short follow-ups that reference the artifact already shown ("which gap?", "tell me more", "drill into #2").
- **instant_reply** — Pure greeting, thanks, or meta ("who are you", "how do you work", "limits"). Also clearly off-topic trivia (Haribo, random companies with NO CPC angle). ALSO: artifact-aware meta ("what am I looking at?", "is this real or a sample?", "are you broken?") when an artifact is present — return a summary that references the current artifact, NOT the generic capability menu.
- **clarify** — Ambiguous but potentially in-scope AND no prior artifact; ask ONE focused follow-up (not a generic menu). If an artifact already exists, prefer pipeline with same outcome over clarify.

## Multi-turn context awareness
- An artifact may already be on the screen — context block below tells you which one.
- If user message is short, vague, or pronoun-heavy AND artifact_present is true: treat as follow-up on that artifact. Route pipeline with last_outcome as the hint, OR instant_reply that quotes the artifact's executive summary.
- NEVER degrade to the generic capability menu when an artifact exists — that confuses the user.

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


def _haiku_route(query: str, ctx: dict[str, Any] | None = None) -> IntentRouterOutput | None:
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
        ctx_block = _format_context_block(ctx)
        user = (
            f"{ctx_block}\nUser message:\n{query}"
            if ctx_block
            else f"User message:\n{query}"
        )
        return structured.invoke(
            [
                SystemMessage(content=_INTENT_SYSTEM),
                HumanMessage(content=user),
            ],
        )
    except Exception as exc:
        logger.warning("Haiku intent router failed, falling back: %s", exc)
        return None


def _format_context_block(ctx: dict[str, Any] | None) -> str:
    if not ctx:
        return ""
    bits: list[str] = []
    last_outcome = ctx.get("last_outcome")
    last_headline = ctx.get("last_headline")
    artifact_present = bool(last_outcome or last_headline)
    if artifact_present:
        bits.append(f"artifact_present: true")
        if last_outcome:
            bits.append(f"last_outcome: {last_outcome}")
        if last_headline:
            bits.append(f"last_headline: {str(last_headline)[:140]}")
    if not bits:
        return ""
    return "## Session context\n" + "\n".join(bits) + "\n"


def _heuristic_route(query: str, ctx: dict[str, Any] | None = None) -> IntentDecision:
    """Strict fallback — only blocks pure conversational; never blocks SWOT/CPC."""
    artifact_present = bool(ctx and (ctx.get("last_outcome") or ctx.get("last_headline")))

    if _ARTIFACT_META_RE.search(query) and artifact_present:
        return IntentDecision(
            route="pipeline",
            outcome_hint=ctx.get("last_outcome") if ctx else None,
            reasoning="Artifact meta — clarify lane will answer from prior artifact",
            source="heuristic",
        )

    if should_reply_conversationally_strict(query):
        # Don't degrade to generic capability menu when artifact exists — point user to it
        if artifact_present and not _is_pure_greeting(query):
            return IntentDecision(
                route="instant_reply",
                instant_reply=build_artifact_meta_reply(query, ctx) or build_conversational_reply(query),
                reasoning="Artifact present — meta reply over generic menu",
                source="heuristic",
            )
        return IntentDecision(
            route="instant_reply",
            instant_reply=build_conversational_reply(query),
            reasoning="Strict heuristic: greeting or meta-only",
            source="heuristic",
        )
    if len(query.split()) <= 4 and "?" in query:
        # Short ambiguous with artifact → treat as follow-up, keep last outcome
        if artifact_present:
            return IntentDecision(
                route="pipeline",
                outcome_hint=ctx.get("last_outcome") if ctx else None,
                reasoning="Short follow-up with artifact — same outcome lane",
                source="heuristic",
            )
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


def _is_pure_greeting(query: str) -> bool:
    ql = query.lower().strip().strip("?!.,")
    return ql in {"hi", "hello", "hey", "howdy", "thanks", "thank you", "cheers"}


def route_intent(query: str, ctx: dict[str, Any] | None = None) -> IntentDecision:
    """Main entry — Haiku when available, else strict heuristics + corpus probe."""
    q = (query or "").strip()
    if not q:
        return IntentDecision(
            route="instant_reply",
            instant_reply="Send a message when you're ready — ask about CPC evidence, funding fit, or strategy.",
            source="heuristic",
        )

    if re.match(r"^\s*(hi|hello|hey)[\s,—-]+", q, re.I) and len(q.split()) > 6:
        substantive = re.sub(r"^\s*(hi|hello|hey)[\s,—-]+", "", q, flags=re.I).strip()
        if substantive and not should_reply_conversationally_strict(substantive):
            return IntentDecision(
                route="pipeline",
                reasoning="Mixed greeting + strategic question — pipeline substantive part",
                source="heuristic",
            )

    parsed = _haiku_route(q, ctx=ctx)
    if parsed is None:
        return _heuristic_route(q, ctx=ctx)

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


_FORCE_PIPELINE_RE = re.compile(
    r"\bfive\s+case\b|\bbusiness\s+case\b|\binvestment\s+brief\b|"
    r"\btop\b.*\bopportunit|\bopportunit.*\broute\b|"
    r"\bcompare\b.*\bproject|\bproject\b.*\bcompare\b|"
    r"\bfind\b.*\bcorpus\b.*\bevidence\b|\bcorpus\b.*\bevidence\b.*\bproject",
    re.I,
)


def _forced_pipeline_decision(query: str) -> IntentDecision | None:
    """Never clarify-loop substantive analysis requests."""
    q = query.strip()
    if not q or not _FORCE_PIPELINE_RE.search(q):
        return None
    from agents.orchestrator.triage import triage_query

    triage = triage_query(q)
    return IntentDecision(
        route="pipeline",
        outcome_hint=triage.outcome,
        effort_hint=triage.effort if triage.effort != "clarify" else "analyze",
        reasoning="Forced pipeline — substantive analysis request",
        source="heuristic",
    )


_FOLLOW_UP_RE = re.compile(
    r"\b("
    r"compare|versus|vs\.?|that|this|those|these|drill|second|first|#2|number two|the other|"
    r"the\s+(?:gap|score|result|verdict|fit|chart|table|list|opportunity|claim|criterion|dimension|lane)|"
    r"which\s+(?:gap|opportunity|project|claim|criterion|one|of\s+(?:these|those))|"
    r"tell\s+me\s+more|more\s+on|explain|expand|deeper|why\s+(?:0|zero|is|does|not)|"
    r"show\s+me\s+(?:the|more)|focus\s+on|zoom\s+in|narrow"
    r")\b",
    re.I,
)

_ARTIFACT_META_RE = re.compile(
    r"("
    r"what(?:'s| is| am)?\s+(?:on(?:\s+the)?\s+screen|am\s+i\s+looking\s+at|i\s+looking\s+at|this(?:\s+about)?|that|here)|"
    r"what(?:\s+just)?\s+happen(?:ed)?|"
    r"are\s+you\s+(?:broken|stuck|ok|okay|alright)|"
    r"is\s+this\s+(?:real|right|correct|true|a\s+sample|a\s+demo|fake|made\s+up)|"
    r"why\s+(?:isn't|is\s+not|won't|doesn't)\s+(?:the\s+)?(?:artifact|canvas|screen|panel)\b|"
    r"artifact\s+not\s+updat|"
    r"isn't\s+this\s+chang|"
    r"why\s+(?:is\s+)?(?:0|zero|the\s+score)|"
    r"what(?:'s| is)\s+(?:the\s+)?(?:fit|score|verdict|gap|takeaway|bottom\s+line)|"
    r"summari[sz]e\s+(?:this|that|the\s+artifact)|"
    r"in\s+one\s+(?:line|sentence)|"
    r"did\s+(?:the\s+)?(?:external|web)\s+search\s+(?:find|return|work)"
    r")",
    re.I,
)


def build_artifact_meta_reply(query: str, ctx: dict[str, Any] | None) -> str | None:
    """Artifact-aware reply for 'what am I looking at?' style follow-ups."""
    if not ctx:
        return None
    prior = ctx.get("_prior_render_model") or ctx.get("prior_render_model")
    headline = ctx.get("last_headline") or (prior.get("headline") if isinstance(prior, dict) else "the current artifact")
    last_outcome = ctx.get("last_outcome") or "analysis"
    exec_summary = None
    is_demo = False
    if isinstance(prior, dict):
        exec_summary = (
            prior.get("executive_summary")
            or (prior.get("blocks_data") or {}).get("executive_summary", {}).get("summary")
            or prior.get("insight_card")
        )
        is_demo = bool(prior.get("is_demo_comparison"))

    q = query.lower()

    if re.search(r"why.*confidence|confidence.*(?:only|tier|indicative|speculative|capped)", q):
        tier = "Indicative"
        cap = ""
        if isinstance(prior, dict):
            tier = str(prior.get("confidence_tier") or tier)
            spine = prior.get("decision_spine") or {}
            cap = str(spine.get("key_assumption") or spine.get("confidence_cap_reason") or "")
            n_cits = len(prior.get("corpus_citations") or [])
            if not cap:
                cap = (
                    f"Based on {n_cits} corpus citation(s). "
                    "Passport claims are mostly self-reported until verified in Supabase."
                )
        return (
            f"**Confidence is {tier}** on *{headline}*.\n\n"
            f"{cap}\n\n"
            "To move up a tier: add verified corpus project citations, close essential gaps, "
            "or name a specific live funding call so we can run a real match (not the sample VT demo)."
        )

    if re.search(r"are\s+you\s+(?:broken|stuck)", q):
        return (
            f"No, I'm responding correctly. You're currently looking at **{headline}** "
            f"({last_outcome} outcome).\n\n{exec_summary or 'Use the artifact panel for the full breakdown.'}"
        )
    if re.search(r"\b(sample|demo|real|fake|made\s+up)\b", q):
        if is_demo:
            return (
                f"**This is a sample comparison.** The artifact you're looking at uses demo fixtures "
                f"(passport and/or spec) because the real CPC passport couldn't be matched to a "
                f"specific call from your query. The fit scores below are illustrative, not your "
                f"true state of play.\n\nTo get a real analysis, name a specific call (e.g. 'CCAV "
                f"Connected & Automated Mobility competition') or check that `OPENAI_API_KEY` is "
                f"set so passport semantic-loading works."
            )
        return (
            f"**This is a real analysis.** Headline: {headline}.\n\n"
            f"{exec_summary or 'See the artifact panel for citations and verdicts.'}"
        )
    if re.search(r"did\s+(?:the\s+)?(?:external|web)\s+search\s+(?:find|return|work)", q):
        external_count = 0
        if isinstance(prior, dict):
            ext = (prior.get("blocks_data") or {}).get("external_evidence", {}).get("items", [])
            external_count = len(ext) if isinstance(ext, list) else 0
        if external_count:
            return f"Yes — external search returned **{external_count}** item(s). See the 'External evidence' block in the artifact."
        return (
            "External search **didn't return additional items** for this turn. Reasons: "
            "(1) the lane router decided corpus-only was sufficient for this outcome, "
            "(2) sense-checking filtered low-quality hits, or "
            "(3) `EXA_API_KEY` is not set. Ask 'rerun this with external search' to force the dual lane."
        )

    return f"**{headline}**\n\n{exec_summary or 'See the artifact panel — the executive summary at the top covers the takeaway.'}"


def node_intent_router(state: dict[str, Any]) -> dict[str, Any]:
    query = (state.get("query") or extract_latest_query(state) or "").strip()
    ctx = dict(state.get("_context") or {})
    # Make prior render model available to artifact-aware replies
    prior_rm = state.get("_prior_render_model") or state.get("render_model")
    if prior_rm is not None and "_prior_render_model" not in ctx:
        ctx["_prior_render_model"] = prior_rm

    artifact_present = bool(ctx.get("last_outcome") or ctx.get("last_headline") or prior_rm)

    forced = _forced_pipeline_decision(query)
    if forced:
        return {
            "_intent": {
                "route": "pipeline",
                "source": forced.source,
                "reasoning": forced.reasoning,
                "outcome_hint": forced.outcome_hint,
                "effort_hint": forced.effort_hint,
            },
            "_is_conversational": False,
            "outcome": forced.outcome_hint,
            "effort": forced.effort_hint,
        }

    # Artifact-aware meta → clarify lane (not instant_reply — preserves canvas)
    if query and artifact_present and _ARTIFACT_META_RE.search(query):
        from agents.orchestrator.triage import triage_query

        triage = triage_query(query)
        return {
            "_intent": {
                "route": "pipeline",
                "source": "heuristic",
                "reasoning": "Artifact meta — clarify lane",
            },
            "_is_conversational": False,
            "outcome": ctx.get("last_outcome") or triage.outcome,
        }

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
        decision = route_intent(query, ctx=ctx)

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

    return END if state.get("_is_conversational") else "classify_turn_lane"
