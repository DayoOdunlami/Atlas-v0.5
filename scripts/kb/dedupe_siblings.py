"""Retire duplicate sibling documents (keep richest chunk count)."""

from __future__ import annotations

import re

import psycopg2.extras

from scripts.kb.govuk_pdf import normalize_title_key

_SIBLING_PREFIXES = (
    "better connected",
    "innovate uk strategic delivery",
)


def _family_key(title: str) -> str | None:
    t = (title or "").lower()
    for prefix in _SIBLING_PREFIXES:
        if t.startswith(prefix):
            return prefix
    # Generic: first 40 chars before em dash or version suffix
    base = re.split(r"\s[-–—]\s", title or "", maxsplit=1)[0].strip()
    key = normalize_title_key(base)
    return key if len(key) >= 12 else None


def dedupe_siblings(conn, *, dry_run: bool = False) -> int:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT d.id::text AS doc_id, d.title, d.status,
                   COUNT(c.id) AS chunk_count
            FROM atlas.knowledge_documents d
            LEFT JOIN atlas.knowledge_chunks c ON c.document_id = d.id
            WHERE d.validation_tier != 'T0_retired'
              AND d.status != 'retired'
            GROUP BY d.id, d.title, d.status
            """
        )
        rows = cur.fetchall()

    families: dict[str, list[dict]] = {}
    for row in rows:
        key = _family_key(row["title"] or "")
        if not key:
            continue
        families.setdefault(key, []).append(row)

    retire_ids: list[str] = []
    for _key, members in families.items():
        if len(members) < 2:
            continue
        members.sort(key=lambda r: int(r["chunk_count"] or 0), reverse=True)
        keeper = members[0]
        for loser in members[1:]:
            if int(loser["chunk_count"] or 0) >= int(keeper["chunk_count"] or 0):
                continue
            retire_ids.append(loser["doc_id"])

    if dry_run or not retire_ids:
        return len(retire_ids)

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE atlas.knowledge_documents
            SET status = 'retired',
                validation_tier = 'T0_retired',
                validation_note = 'deduped sibling — lower chunk count than canonical row',
                retired_at = NOW(),
                retired_reason = 'duplicate sibling',
                updated_at = NOW()
            WHERE id = ANY(%s::uuid[])
            """,
            (retire_ids,),
        )
    conn.commit()
    return len(retire_ids)
