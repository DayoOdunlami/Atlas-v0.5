"""Shared database connection utilities."""

from __future__ import annotations

import os

import psycopg2
import psycopg2.extras


def get_connection():
    """Return a psycopg2 connection using DATABASE_URL from environment."""
    url = os.environ["DATABASE_URL"]
    return psycopg2.connect(url, sslmode="require")


def load_existing_urls(conn, source: str) -> set[str]:
    """Load all source_urls already in atlas.live_calls for this source.

    Used by adapters to skip known URLs before any API cost is incurred.
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT source_url FROM atlas.live_calls WHERE source = %s AND source_url IS NOT NULL",
            (source,),
        )
        return {row[0] for row in cur.fetchall()}


def load_existing_knowledge_doc_urls(conn) -> set[str]:
    """Load all source_urls already in atlas.knowledge_documents."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT source_url FROM atlas.knowledge_documents WHERE source_url IS NOT NULL"
        )
        return {row[0] for row in cur.fetchall()}


def load_taxonomies(conn) -> list[dict]:
    """Load all rows from atlas.taxonomies ordered by id.

    Returns a list of dicts with keys: id, name, labels, classifier_prompt.
    Returns [] if the table doesn't exist (pre-Day1 environments).
    """
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, labels, classifier_prompt FROM atlas.taxonomies ORDER BY id"
            )
            rows = cur.fetchall()
        return [
            {
                "id": r[0],
                "name": r[1],
                "labels": r[2] or [],
                "classifier_prompt": r[3] or "",
            }
            for r in rows
        ]
    except Exception as exc:
        try:
            conn.rollback()
        except Exception:
            pass
        print(
            f"  [db] WARNING: could not load atlas.taxonomies: {exc}. "
            "Taxonomy classification will be skipped.",
            flush=True,
        )
        return []
