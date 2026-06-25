"""
Lightweight Supabase / corpus connectivity probes — no heavy aggregate queries.

Used by /health, online-only gate, and the Atlas connection status UI.
Postgres: SELECT 1 with short timeout + limited retries (slow links, not instant fail).
REST: single-row read over HTTPS 443 when service role is configured.
"""
from __future__ import annotations

import os
import re
import time
from typing import Any, Literal, TypedDict

import psycopg2

from mcps.cpc_corpus import transport

TierStatus = Literal["ok", "fail", "skip"]


class TierProbe(TypedDict, total=False):
    configured: bool
    status: TierStatus
    attempts: int
    latency_ms: float
    error: str | None


class CorpusConnectivity(TypedDict):
    postgres: TierProbe
    rest: TierProbe
    any_reachable: bool
    preferred_transport: str
    note: str


def _postgres_url() -> str:
    return (os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL") or "").strip()


def _probe_timeout_sec() -> int:
    return max(1, int(os.environ.get("CORPUS_PG_PROBE_TIMEOUT", "3")))


def _probe_attempts() -> int:
    return max(1, int(os.environ.get("CORPUS_PG_PROBE_ATTEMPTS", "2")))


def _connect_postgres(timeout_sec: int):
    raw = _postgres_url()
    if not raw:
        raise transport.PostgresUnavailable("POSTGRES_URL / DATABASE_URL not set")
    conn_str = re.sub(r"[?&]sslmode=[^&]*", "", raw)
    is_local = "localhost" in raw or "127.0.0.1" in raw
    kwargs: dict[str, Any] = {}
    if not is_local:
        kwargs["sslmode"] = "require"
        kwargs["connect_timeout"] = timeout_sec
    return psycopg2.connect(conn_str, **kwargs)


def probe_postgres(
    *,
    attempts: int | None = None,
    timeout_sec: int | None = None,
) -> TierProbe:
    """Ping Postgres pooler with SELECT 1 — retries on transient slow links."""
    configured = bool(_postgres_url())
    if not configured:
        return {
            "configured": False,
            "status": "skip",
            "attempts": 0,
            "latency_ms": 0.0,
            "error": "POSTGRES_URL not set",
        }

    max_attempts = attempts if attempts is not None else _probe_attempts()
    timeout = timeout_sec if timeout_sec is not None else _probe_timeout_sec()
    last_err: str | None = None
    t0 = time.perf_counter()

    for attempt in range(1, max_attempts + 1):
        try:
            conn = _connect_postgres(timeout)
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()
            finally:
                conn.close()
            return {
                "configured": True,
                "status": "ok",
                "attempts": attempt,
                "latency_ms": round((time.perf_counter() - t0) * 1000, 1),
                "error": None,
            }
        except (psycopg2.OperationalError, psycopg2.InterfaceError, OSError) as exc:
            last_err = str(exc)[:160]
            if attempt < max_attempts:
                time.sleep(0.2)
        except transport.PostgresUnavailable as exc:
            last_err = str(exc)[:160]
            break

    return {
        "configured": True,
        "status": "fail",
        "attempts": max_attempts,
        "latency_ms": round((time.perf_counter() - t0) * 1000, 1),
        "error": last_err or "connection failed",
    }


def probe_rest() -> TierProbe:
    """Ping Supabase REST with a one-row projects read (HTTPS 443)."""
    configured = transport.rest_configured()
    if not configured:
        return {
            "configured": False,
            "status": "skip",
            "attempts": 0,
            "latency_ms": 0.0,
            "error": "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY not set",
        }

    t0 = time.perf_counter()
    try:
        from mcps.cpc_corpus import queries_rest

        sb = queries_rest._client()
        sb.schema("atlas").from_("projects").select("id").limit(1).execute()
        return {
            "configured": True,
            "status": "ok",
            "attempts": 1,
            "latency_ms": round((time.perf_counter() - t0) * 1000, 1),
            "error": None,
        }
    except Exception as exc:
        return {
            "configured": True,
            "status": "fail",
            "attempts": 1,
            "latency_ms": round((time.perf_counter() - t0) * 1000, 1),
            "error": str(exc)[:160],
        }


def probe_corpus_connectivity(
    *,
    probe_postgres_tier: bool = True,
    probe_rest_tier: bool = True,
) -> CorpusConnectivity:
    """Run tier probes; corpus is available when any configured tier succeeds."""
    pg: TierProbe = (
        probe_postgres()
        if probe_postgres_tier
        else {"configured": bool(_postgres_url()), "status": "skip", "attempts": 0}
    )
    rest: TierProbe = (
        probe_rest()
        if probe_rest_tier
        else {"configured": transport.rest_configured(), "status": "skip", "attempts": 0}
    )

    pg_ok = pg.get("status") == "ok"
    rest_ok = rest.get("status") == "ok"
    any_reachable = pg_ok or rest_ok

    if pg_ok:
        preferred = "postgres"
        note = ""
    elif rest_ok:
        preferred = "rest_https"
        note = transport.human_transport_note("rest_keyword").strip() or (
            "Corpus reachable via Supabase REST (Postgres pooler blocked or slow)."
        )
    else:
        preferred = "unavailable"
        note = transport.human_transport_note("unavailable")

    return {
        "postgres": pg,
        "rest": rest,
        "any_reachable": any_reachable,
        "preferred_transport": preferred,
        "note": note,
    }


def corpus_reachable_for_turn() -> bool:
    """Fast gate for online-only — True when Postgres or REST tier responds."""
    return probe_corpus_connectivity()["any_reachable"]
