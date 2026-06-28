"""
Corpus DB transport tier — Postgres (TCP) with HTTPS REST fallback.

Tier 1: postgres + pgvector
Tier 2: rest_vector (Supabase semantic RPC over 443)
Tier 3: rest_keyword (legacy ILIKE — live_calls/hive only, not project search)
Tier 4: unavailable (explicit — no silent empty results)
"""
from __future__ import annotations

import os
import re
from contextvars import ContextVar
from typing import Literal, Optional

CorpusTransport = Literal["postgres", "rest_vector", "rest_keyword", "unavailable"]

_current: ContextVar[CorpusTransport] = ContextVar("corpus_transport", default="postgres")
_last_error: ContextVar[Optional[str]] = ContextVar("corpus_transport_error", default=None)
_operation: ContextVar[str] = ContextVar("corpus_transport_operation", default="")


class PostgresUnavailable(Exception):
    """Raised when direct Postgres cannot be reached (firewall, timeout, bad URL)."""


def rest_configured() -> bool:
    return bool(
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        and os.environ.get("SUPABASE_SERVICE_KEY")
    )


def set_transport(tier: CorpusTransport, *, error: Optional[str] = None) -> None:
    _current.set(tier)
    if error is not None:
        _last_error.set(error)


def set_operation(name: str) -> None:
    _operation.set(name)


def get_last_transport() -> CorpusTransport:
    return _current.get()


def get_last_error() -> Optional[str]:
    return _last_error.get()


def get_operation() -> str:
    return _operation.get()


def human_transport_note(tier: Optional[CorpusTransport] = None) -> str:
    t = tier or get_last_transport()
    if t == "postgres":
        return ""
    if t == "rest_vector":
        return (
            "Corpus search used semantic mode over HTTPS (Postgres pooler unreachable)."
        )
    if t == "rest_keyword":
        return (
            "Legacy keyword lookup over HTTPS (not used for atlas.projects semantic search)."
        )
    return "Corpus database unreachable on all transport tiers."


def sanitize_ilike_term(query: str) -> str:
    """Strip characters that break PostgREST filter strings."""
    q = (query or "").strip()
    q = re.sub(r"[,()\\]", " ", q)
    return q[:120] if q else "transport"
