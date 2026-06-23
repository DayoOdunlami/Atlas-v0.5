"""Online-only mode — when CPC corpus DB is unreachable, offer web-only continuation."""

from __future__ import annotations

import asyncio
import re
from typing import Any

from agents.atlas_v5.corpus_scope import corpus_scope_for_query
from agents.atlas_v5.j1t1_corpus import fetch_corpus_stats
from agents.atlas_v5.turn_classifier import OutcomeHint, TurnDecision
from mcps.cpc_corpus import transport

_CONSENT_RE = re.compile(
    r"\b("
    r"yes|yeah|yep|ok|okay|sure|continue|proceed|go ahead"
    r")\b.*\b("
    r"online|web|without corpus|no corpus|online only|online-only"
    r")\b",
    re.I,
)

_SHORT_CONSENT_RE = re.compile(
    r"^\s*(yes|yeah|yep|ok|okay|sure|continue|proceed|go ahead)\s*[.!]?\s*$",
    re.I,
)


def get_online_only_state(meta: dict[str, Any] | None) -> dict[str, Any]:
    if not meta:
        return {}
    block = meta.get("online_only")
    return block if isinstance(block, dict) else {}


def is_online_only_pending(meta: dict[str, Any] | None) -> bool:
    return bool(get_online_only_state(meta).get("pending"))


def is_online_only_active(meta: dict[str, Any] | None) -> bool:
    return bool(get_online_only_state(meta).get("active"))


def pending_substantive_query(meta: dict[str, Any] | None) -> str | None:
    q = get_online_only_state(meta).get("query")
    return str(q).strip() if q else None


def pending_outcome_hint(meta: dict[str, Any] | None) -> OutcomeHint | None:
    hint = get_online_only_state(meta).get("outcome_hint")
    if hint in ("orient", "connect", "act", "diagnose", "defend"):
        return hint  # type: ignore[return-value]
    return None


def user_accepts_online_only(query: str, meta: dict[str, Any] | None) -> bool:
    q = query.strip()
    if not q:
        return False
    if _CONSENT_RE.search(q):
        return True
    return is_online_only_pending(meta) and bool(_SHORT_CONSENT_RE.match(q))


def build_online_only_offer(
    query: str,
    decision: TurnDecision,
    *,
    corpus_note: str = "",
) -> dict[str, Any]:
    note = corpus_note.strip() or (
        "The CPC corpus database is unreachable from this environment "
        "(Postgres pooler timeout or network block)."
    )
    reply = (
        f"{note}\n\n"
        "I can still work in **online-only mode** — web search (Exa/GovUK where configured) "
        "plus structured synthesis. You will **not** get verified `atlas.projects` UUID "
        "citations this session.\n\n"
        f"Your question: *{query[:200]}{'…' if len(query) > 200 else ''}*\n\n"
        'Reply **"yes, continue online"** to proceed, or stay in chat-only if you prefer.'
    )
    return {
        "reply": reply,
        "update_canvas": False,
        "route": "clarify",
        "route_source": "heuristic",
        "dev_meta": {
            "route": "clarify",
            "route_source": "heuristic",
            "corpus_status": "unavailable",
            "lane_mode": "online_only_pending",
            "online_only": {
                "pending": True,
                "active": False,
                "query": query,
                "outcome_hint": decision.outcome_hint,
            },
            "disposition": {
                "primary_surface": "chat_only",
                "canvas_action": "none",
                "composition_mode": "online_only_offer",
                "reasoning": "Corpus unavailable — awaiting user consent for web-only mode",
            },
        },
    }


def build_online_only_active_meta(query: str, outcome_hint: OutcomeHint | None) -> dict[str, Any]:
    return {
        "corpus_status": "unavailable",
        "lane_mode": "online_only",
        "online_only": {
            "pending": False,
            "active": True,
            "query": query,
            "outcome_hint": outcome_hint,
        },
    }


async def probe_corpus_available(query: str) -> bool:
    """Fast check — False when Postgres pooler is unreachable."""
    where_sql, _, _ = corpus_scope_for_query(query)
    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, fetch_corpus_stats, where_sql)
        return True
    except transport.PostgresUnavailable:
        return False
