"""
Orchestrator conversational layer — instant replies without running the pipeline.

Handles greetings, meta questions (help / limits / how it works), and off-topic
queries (Haribo, random companies) with clear redirect to CPC scope.

Strategic queries with domain keywords always pass through to triage.
"""
from __future__ import annotations

import re
import uuid
from typing import Any

from langchain_core.messages import AIMessage

from agents.base import DOMAIN_KW, is_conversational

# Prefixes that signal general knowledge / out-of-corpus questions
_OFF_TOPIC_PREFIXES: tuple[str, ...] = (
    "tell me about",
    "what is ",
    "what's ",
    "who is ",
    "who's ",
    "what are ",
    "describe ",
    "explain ",
)

_OFF_TOPIC_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"what(?:'s| is) innovative about", re.I),
    re.compile(r"\bcompany\b", re.I),
    re.compile(r"\bharibo\b|\bnestle\b|\btesco\b|\bmicrosoft\b|\bgoogle\b", re.I),
)


def should_reply_conversationally(query: str) -> bool:
    """Legacy alias — prefer should_reply_conversationally_strict + Haiku router."""
    return should_reply_conversationally_strict(query)


def should_reply_conversationally_strict(query: str) -> bool:
    """
    Strict instant-reply gate for no-API-key fallback only.
    Never match 'help me with …' or substantive questions.
    """
    from agents.base import is_conversational

    if is_conversational(query):
        return True
    return is_off_topic_strict(query)


def is_off_topic(query: str) -> bool:
    return is_off_topic_strict(query)


def is_off_topic_strict(query: str) -> bool:
    """Off-topic only when clearly general knowledge AND no domain keywords."""
    ql = query.lower().strip()
    if any(kw in ql for kw in DOMAIN_KW):
        return False
    # Whole-query patterns only — avoid blocking "explain the evidence plan"
    if ql in {"tell me about yourself", "tell me about you"}:
        return True
    if any(ql.startswith(p) for p in _OFF_TOPIC_PREFIXES) and len(ql.split()) <= 8:
        return True
    return any(p.search(query) for p in _OFF_TOPIC_PATTERNS)


def build_conversational_reply(query: str) -> str:
    """Build a contextual instant reply (no LLM call)."""
    ql = (query or "").lower().strip()

    if any(p in ql for p in ("limit", "boundary", "boundaries", "can't you", "cannot")):
        return _LIMITS_REPLY

    if any(
        p in ql
        for p in (
            "how do you work",
            "how does this work",
            "how it work",
            "what is atlas",
            "what is this",
        )
    ):
        return _HOW_IT_WORKS_REPLY

    if any(
        p in ql
        for p in (
            "how can you help",
            "what can you do",
            "what do you do",
            "help me",
            "who are you",
            "what are you",
            "capabilities",
        )
    ):
        return _HELP_REPLY

    if is_off_topic(query):
        return _OFF_TOPIC_REPLY

    words = ql.split()
    first = words[0].strip(",.!?") if words else ""
    if not words or (len(words) <= 6 and first in {
        "hello", "hi", "hey", "howdy", "greetings", "hiya", "yo",
    }):
        return _GREETING_REPLY

    if len(words) <= 5 and first in {"thanks", "thank", "cheers", "ta", "thx", "ty"}:
        return "You're welcome! Ask me a CPC or transport-innovation question when you're ready."

    return _HELP_REPLY


_GREETING_REPLY = """Hello! I'm **Atlas Workbench** — CPC's strategic intelligence surface.

I search the **live CPC corpus** (verified project IDs), route your question through five outcome modes (orient, connect, diagnose, act, defend), and render evidence-backed blocks on the canvas.

**Try asking:**
• What evidence does CPC have in smart mobility that would transfer to the Innovate UK Smart City Challenge?
• What are our biggest evidence gaps in rail decarbonisation?
• How should we pursue the next 90 days on this funding call?

Or ask *how can you help?* or *what are your limits?*"""

_HELP_REPLY = """I'm **Atlas Workbench** — built for Connected Places Catapult strategists, not general chat.

**I can help with:**
• **Orient** — landscape and portfolio views over CPC evidence
• **Connect** — funding-call fit, transfer, and analogue matching
• **Diagnose** — evidence gaps and capability coverage
• **Act** — investment cases, pursuit plans, next steps
• **Defend** — scrutiny, objections, evidence trails

**I work by:** triaging your question → searching Supabase corpus → building structured blocks with real citations → showing confidence tier.

Ask a **specific strategic question** with a topic (e.g. smart mobility, rail, climate adaptation) and I'll run the full pipeline."""

_HOW_IT_WORKS_REPLY = """**How Atlas Workbench works**

1. **Triage** — classifies effort (quick vs deep) and outcome (orient / connect / diagnose / act / defend). No free-form chit-chat on the research path.
2. **Corpus search** — pgvector semantic search over `atlas.projects` (falls back to keyword search if embeddings unavailable).
3. **Outcome builder** — assembles blocks (TransferLanes, MatchBench, evidence cards, etc.) with verified UUID citations.
4. **Trust spine** — citation guard, artifact QA, confidence tier (Speculative → Robust).
5. **Canvas** — structured answer renders beside chat; deep research may pause at a **gate** for your approval.

This is **not** a general-purpose ChatGPT clone — it's an evidence pipeline with conversational shortcuts for greetings and meta questions only."""

_LIMITS_REPLY = """**What I can and can't do**

**In scope**
• CPC / transport / innovation corpus questions with verifiable project citations
• Funding-call fit, evidence gaps, investment framing, transfer analogues
• Structured briefs with confidence tiers — not invented UUIDs

**Out of scope**
• General knowledge (companies, consumer brands, trivia) — I'll redirect you
• Real-time web unless deep mode + gate confirms external scout
• Legal, HR, or personal advice

**Quality depends on**
• `OPENAI_API_KEY` — semantic corpus search (without it: keyword fallback, weaker matching)
• `ANTHROPIC_API_KEY` — LLM synthesis on deep / diagnose paths (without it: deterministic builders still run for most Sameer-gate questions)

**Be specific** — "smart mobility evidence for Innovate UK transfer" beats "tell me about company X"."""

_OFF_TOPIC_REPLY = """That's outside my CPC corpus scope — I'm not a general web assistant.

I'm built to answer **Connected Places Catapult** strategic questions using verified project evidence from Supabase.

**Reframe it for Atlas**, for example:
• Instead of a random company → *What CPC projects are closest to [sector/theme]?*
• Instead of general innovation trivia → *What evidence do we have in [mode/technology]?*

If you need open-domain research, say so explicitly and I can route to **deep mode** (with your approval at the gate) when Anthropic + external tools are configured."""


def node_conversational_intent(state: dict[str, Any]) -> dict[str, Any]:
    query = (state.get("query") or "").strip()
    if not query or not should_reply_conversationally(query):
        return {"_is_conversational": False}
    reply = build_conversational_reply(query)
    return {
        "messages": [AIMessage(content=reply, id=str(uuid.uuid4()))],
        "_is_conversational": True,
    }


def route_after_conversational_intent(state: dict[str, Any]) -> str:
    from langgraph.graph import END

    return END if state.get("_is_conversational") else "triage"
