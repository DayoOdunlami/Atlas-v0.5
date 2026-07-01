"""Promote GovUK policy_doc candidates from proposed → approved T3_thin."""

from __future__ import annotations

import psycopg2.extras


def promote_policy_candidates(conn, *, limit: int = 200, dry_run: bool = False) -> int:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id::text
            FROM atlas.knowledge_documents
            WHERE status = 'proposed'
              AND validation_tier = 'T4_candidate'
              AND source_type IN ('policy_doc', 'guidance', 'research')
              AND (
                publisher ILIKE '%%Department for Transport%%'
                OR publisher ILIKE '%%GOV.UK%%'
                OR publisher ILIKE '%%DfT%%'
                OR source_url ILIKE '%%gov.uk%%'
              )
            ORDER BY added_at DESC NULLS LAST
            LIMIT %s
            """,
            (limit,),
        )
        ids = [r["id"] for r in cur.fetchall()]

    if dry_run or not ids:
        return len(ids)

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE atlas.knowledge_documents
            SET status = 'approved',
                validation_tier = 'T3_thin',
                validation_note = 'auto-promoted GovUK policy candidate — review for T2 or T0',
                tier = COALESCE(tier, 'primary'),
                updated_at = NOW()
            WHERE id = ANY(%s::uuid[])
            """,
            (ids,),
        )
    conn.commit()
    return len(ids)
