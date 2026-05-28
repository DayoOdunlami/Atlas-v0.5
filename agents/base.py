"""
Atlas 5 — Shared agent base utilities.
======================================

EVERY ATLAS 5 AGENT MUST USE THESE UTILITIES.
Do not re-implement query extraction or intent classification inside individual
agent graphs.  One implementation here; all agents inherit the fix for free.

Why this exists
---------------
Each agent in Atlas 5 has its own LangGraph StateGraph compiled with MemorySaver.
MemorySaver persists the full state dict between conversation turns on the same
thread_id.  This means a field like ``state["query"]`` carries the value from
the *previous* turn's checkpoint into the next invocation.  If any agent reads
``state["query"]`` directly — or guards extraction with ``if state.get("query"):
return {}`` — it will respond to turn-2+ messages with turn-1's query.

The fix: ALWAYS extract the query fresh from the messages list at the start of
every graph invocation.  Never rely on a cached ``query`` field for routing.

Concretely, the pattern every agent follows is:

    messages (AG-UI path)
        ↓
    extract_query node        ← extract_latest_query() from this module
        ↓
    classify_intent node      ← is_conversational() from this module
        ↓ (domain query)              ↓ (greeting / meta / off-topic)
    search / pipeline         END  ← instant reply, no tools called
        ↓
    reason / analyse
        ↓
    verify_citations
        ↓
    END

New agent checklist
-------------------
When adding a new agent (e.g. FUTURA, ATLAS-X):

1.  Add ``messages: Annotated[list, add_messages]`` to your state TypedDict.
    Import ``Annotated`` from ``typing`` and ``add_messages`` from
    ``langgraph.graph.message``.

2.  Add ``_is_conversational: bool`` to your state TypedDict.

3.  Create an ``extract_query`` node using the factory::

        from agents.base import make_extract_query_node

        extract_query = make_extract_query_node({
            # reset every per-turn working field to a clean value
            "raw_search_results": [],
            "corpus_citations": [],
            "confidence_tier": "Speculative",
            "analysis": "",
            "_is_conversational": False,
            "error": None,
        })

4.  Create a ``classify_intent`` node + router using the factory::

        from agents.base import make_classify_intent_node

        classify_intent, route_after_intent = make_classify_intent_node(
            agent_name="FUTURA",
            agent_description="CPC's futures and foresight agent.",
            pipeline_start_node="search_corpus",   # first real work node
        )

5.  Wire them as the first two nodes of your graph::

        graph.set_entry_point("extract_query")
        graph.add_edge("extract_query", "classify_intent")
        graph.add_conditional_edges(
            "classify_intent",
            route_after_intent,
            {END: END, "search_corpus": "search_corpus"},
        )

6.  Compile with ``MemorySaver`` so AG-UI state snapshots work::

        from langgraph.checkpoint.memory import MemorySaver
        return graph.compile(checkpointer=MemorySaver())

7.  In your ``run_*()`` public API, initialise state with::

        "messages": [],           # empty on REST path; AG-UI sets via input
        "_is_conversational": False,

8.  Register the new agent in ``agents/server.py`` (add endpoint + health check).

9.  If the agent gets its own AG-UI endpoint, update ``dashboard.tsx``
    ``COAGENT_NAME`` to map the new AgentId to the correct coagent name.
"""
from __future__ import annotations

import uuid
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import END


# ---------------------------------------------------------------------------
# Domain keyword set
# Queries containing any of these always go through the full pipeline.
# Off-topic messages that contain NO domain keyword are handled as
# conversational (greeting / meta / complaint) and return instantly.
# ---------------------------------------------------------------------------
DOMAIN_KW: frozenset[str] = frozenset({
    # CPC / programme terms
    "cpc", "catapult", "connected places",
    # Business case / investment
    "case", "brief", "invest", "appraisal", "bcr", "npv", "stpr", "green book",
    "five case", "sobc", "obc", "fbc",
    # Evidence / corpus
    "evidence", "corpus", "project", "citation", "finding",
    # Funding / procurement
    "fund", "grant", "innovate", "ukri", "horizon", "tender", "procurement",
    # Transport / infrastructure
    "transport", "freight", "rail", "road", "active travel", "travel", "corridor",
    "infrastr", "highway", "network", "maas", "mobility",
    # Technology domains
    "ev", "electric vehicle", "autonomous", "cav", "connected", "digital",
    "data", "sensor", "smart", "carbon", "climate", "adaptation", "resilience",
    "hive", "hyve",
    # Strategy / analysis
    "strategy", "strategic", "economic", "commercial", "financial",
    "management", "analogue", "transfer", "sector", "gap", "risk",
})

_GREETING_WORDS: frozenset[str] = frozenset({
    "hello", "hi", "hey", "howdy", "greetings", "hiya", "yo",
})
_THANKS_WORDS: frozenset[str] = frozenset({
    "thanks", "thank", "cheers", "ta", "thx", "ty",
})
_META_PHRASES: frozenset[str] = frozenset({
    "who are you", "what are you", "what can you do", "what do you do",
    "help", "help me", "whats your name", "what's your name",
    "tell me about yourself", "how do you work", "how does this work",
    "what is this", "what is atlas",
})


# ---------------------------------------------------------------------------
# Core utilities — use these, never re-implement them
# ---------------------------------------------------------------------------

def extract_latest_query(state: dict) -> str | None:
    """
    Extract the latest human message content from state["messages"].

    This is the AUTHORITATIVE implementation.  It:
    - iterates in reverse so the most recent message wins
    - handles both LangChain HumanMessage objects and raw AG-UI dicts
    - NEVER reads state["query"] — that field can hold a stale checkpoint value

    Returns the content string, or None if no human message is found.
    """
    for msg in reversed(state.get("messages", [])):
        if isinstance(msg, HumanMessage):
            content = getattr(msg, "content", "")
        elif isinstance(msg, dict) and msg.get("role") in ("user", "human"):
            content = msg.get("content", "") or ""
        else:
            continue
        if content:
            return str(content)
    return None


def is_conversational(query: str) -> bool:
    """
    Return True when the query should skip the pipeline and get an instant reply.

    Rules (in priority order):
    1. Any domain keyword present → False (always run pipeline).
    2. Empty / whitespace-only query → True.
    3. Greeting word as first token (≤ 6 words total) → True.
    4. Thanks word as first token (≤ 5 words total) → True.
    5. Matches a known meta phrase (substring) → True.
    6. Short message ≤ 3 words with no domain keyword → True.
    7. Everything else → False (pipeline runs, possibly producing a
       low-relevance brief; acceptable trade-off vs a false-negative guard).
    """
    if not query or not query.strip():
        return True

    ql = query.lower().strip()

    # Rule 1 — domain keyword overrides everything
    if any(kw in ql for kw in DOMAIN_KW):
        return False

    words = ql.split()
    n = len(words)
    first = words[0].strip(",.!?") if words else ""

    is_greeting = n == 0 or (n <= 6 and first in _GREETING_WORDS)
    is_thanks   = n <= 5 and first in _THANKS_WORDS
    is_meta     = any(phrase in ql for phrase in _META_PHRASES)
    is_trivial  = n <= 3

    return is_greeting or is_thanks or is_meta or is_trivial


def _make_reply(query: str, agent_name: str, agent_description: str) -> str:
    """Build the instant conversational reply, personalised per agent."""
    ql = (query or "").lower().strip()
    words = ql.split()
    first = words[0].strip(",.!?") if words else ""

    if not words or (len(words) <= 6 and first in _GREETING_WORDS):
        return (
            f"👋 Hi! I'm **{agent_name}** — {agent_description}\n\n"
            "Ask me a substantive question and I'll get to work with verified evidence."
        )
    if len(words) <= 5 and first in _THANKS_WORDS:
        return "You're welcome! Ask me anything. 🙂"
    # meta / off-topic fallback
    return (
        f"I'm **{agent_name}** — {agent_description} "
        "Ask me a substantive question and I'll return a full response with "
        "verified corpus citations."
    )


# ---------------------------------------------------------------------------
# Node factories — call these in your graph.py, don't write the nodes by hand
# ---------------------------------------------------------------------------

def make_extract_query_node(per_turn_reset: dict[str, Any]):
    """
    Return a LangGraph node function that:

    1. On the AG-UI path (messages present): extracts the latest human message
       and resets all per-turn working state to clean values.
    2. On the REST path (messages absent): no-op — the caller already set
       ``state["query"]`` directly in ``run_*()``.

    ``per_turn_reset`` must include every field that should be cleared at the
    start of a new turn.  Always include at minimum::

        {
            "_is_conversational": False,
            "error": None,
        }

    Example::

        extract_query = make_extract_query_node({
            "raw_search_results": [],
            "corpus_citations": [],
            "confidence_tier": "Speculative",
            "analysis": "",
            "_is_conversational": False,
            "error": None,
        })
    """
    def _extract_query_node(state: dict) -> dict:
        if not state.get("messages"):
            # REST path — query already injected by run_*(); nothing to do
            return {}
        query = extract_latest_query(state)
        if not query:
            return {}
        return {"query": query, **per_turn_reset}

    _extract_query_node.__name__ = "extract_query"
    return _extract_query_node


def make_classify_intent_node(
    agent_name: str,
    agent_description: str,
    pipeline_start_node: str = "search_corpus",
    extra_conversational_overrides: dict[str, Any] | None = None,
):
    """
    Return a (classify_intent_node, route_after_intent_fn) pair.

    ``classify_intent_node``:
        Checks whether the current query is conversational.  If yes, appends a
        friendly AIMessage to state["messages"] and sets _is_conversational=True.
        If no, sets _is_conversational=False and falls through to the pipeline.

    ``route_after_intent_fn``:
        Conditional edge function.  Returns END for conversational queries,
        or ``pipeline_start_node`` for domain queries.

    ``extra_conversational_overrides``:
        Additional state fields to reset when routing to END (e.g. clearing
        artifact_block, decision_spine for agents that have those fields).

    Wire them into the graph like this::

        classify_intent, route_after_intent = make_classify_intent_node(
            agent_name="JARVIS",
            agent_description="CPC's corpus explorer.",
            pipeline_start_node="search_corpus",
        )
        graph.add_node("classify_intent", classify_intent)
        graph.add_conditional_edges(
            "classify_intent",
            route_after_intent,
            {END: END, "search_corpus": "search_corpus"},
        )
    """
    overrides: dict[str, Any] = extra_conversational_overrides or {}

    def _classify_intent_node(state: dict) -> dict:
        query = (state.get("query") or "").strip()
        if is_conversational(query):
            reply = _make_reply(query, agent_name, agent_description)
            return {
                # add_messages reducer appends — return only the new message
                "messages": [AIMessage(content=reply, id=str(uuid.uuid4()))],
                "_is_conversational": True,
                **overrides,
            }
        return {"_is_conversational": False}

    def _route_after_intent(state: dict) -> str:
        return END if state.get("_is_conversational") else pipeline_start_node

    _classify_intent_node.__name__ = "classify_intent"
    _route_after_intent.__name__ = "route_after_intent"
    return _classify_intent_node, _route_after_intent
