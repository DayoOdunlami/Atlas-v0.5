"""Online-only mode — when CPC corpus DB is unreachable, offer web-only continuation."""

from __future__ import annotations

import asyncio
import re
from typing import Any

from agents.atlas_v5.turn_classifier import OutcomeHint, TurnDecision
from mcps.cpc_corpus.connectivity import corpus_reachable_for_turn, probe_corpus_connectivity

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


async def probe_corpus_available(_query: str) -> bool:
    """Fast tier probe — False only when Postgres and Supabase REST both fail."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, corpus_reachable_for_turn)


def corpus_connectivity_note() -> str:
    """Human-readable note for online-only offer when probe fails."""
    conn = probe_corpus_connectivity()
    if conn["any_reachable"]:
        return ""
    pg = conn["postgres"]
    rest = conn["rest"]
    parts: list[str] = ["CPC corpus unreachable on all transport tiers."]
    if pg.get("configured") and pg.get("status") == "fail":
        attempts = pg.get("attempts", 0)
        parts.append(
            f"Postgres pooler failed after {attempts} attempt(s)"
            + (f": {pg.get('error')}" if pg.get("error") else "")
        )
    if rest.get("configured") and rest.get("status") == "fail":
        parts.append(f"Supabase REST failed: {rest.get('error') or 'unknown'}")
    elif not rest.get("configured"):
        parts.append("Supabase REST not configured (set SUPABASE_SERVICE_KEY for HTTPS fallback).")
    return " ".join(parts)
