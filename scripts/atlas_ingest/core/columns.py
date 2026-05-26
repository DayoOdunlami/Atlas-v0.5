"""Ensure atlas.live_calls has all columns expected by the ingest engine.

Extracted from scripts/live_calls_columns.py (which remains as a legacy
import shim for the old scripts).
"""

from __future__ import annotations

DDL_STATEMENTS = [
    "ALTER TABLE atlas.live_calls ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'horizon_europe'",
    "ALTER TABLE atlas.live_calls ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ",
    "ALTER TABLE atlas.live_calls ADD COLUMN IF NOT EXISTS relevance_tag TEXT",
    "ALTER TABLE atlas.live_calls ADD COLUMN IF NOT EXISTS relevance_reason TEXT",
]


def ensure_live_calls_columns(conn) -> None:
    """Idempotently add any missing columns to atlas.live_calls."""
    with conn.cursor() as cur:
        for stmt in DDL_STATEMENTS:
            cur.execute(stmt)
    conn.commit()


def ensure_live_calls_table(conn) -> None:
    """Create atlas.live_calls if it doesn't exist, then ensure columns."""
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS atlas.live_calls (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title TEXT,
                funder TEXT,
                deadline DATE,
                funding_amount TEXT,
                description TEXT,
                source_url TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'open',
                embedding vector(1536),
                viz_x NUMERIC,
                viz_y NUMERIC,
                scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS live_calls_source_url_key
            ON atlas.live_calls (source_url)
            """
        )
    conn.commit()
    ensure_live_calls_columns(conn)
