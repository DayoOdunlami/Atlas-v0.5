"""Backfill thin GovUK docs by resolving PDF attachments and re-embedding."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import psycopg2.extras

from scripts.kb.govuk_pdf import is_govuk_publication_url, resolve_govuk_pdf_url

ROOT = Path(__file__).resolve().parents[2]


def find_thin_backfill_candidates(conn, *, limit: int = 50) -> list[dict]:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT d.id::text AS doc_id, d.title, d.source_url,
                   COUNT(c.id) AS chunk_count
            FROM atlas.knowledge_documents d
            LEFT JOIN atlas.knowledge_chunks c ON c.document_id = d.id
            WHERE d.status = 'approved'
              AND d.validation_tier IN ('T3_thin', 'T1_anchor')
              AND (
                d.source_url ILIKE '%%gov.uk/government/publications/%%'
                OR d.source_url ILIKE '%%.pdf'
              )
            GROUP BY d.id, d.title, d.source_url
            HAVING COUNT(c.id) <= 5
            ORDER BY COUNT(c.id) ASC, d.added_at DESC NULLS LAST
            LIMIT %s
            """,
            (limit,),
        )
        return list(cur.fetchall())


def backfill_thin_pdfs(
    conn,
    *,
    limit: int = 25,
    dry_run: bool = False,
    embed: bool = True,
) -> tuple[int, int]:
    candidates = find_thin_backfill_candidates(conn, limit=limit)
    updated = 0
    embedded = 0
    embed_script = ROOT / "scripts" / "embed_knowledge_documents.py"

    for row in candidates:
        source_url = row.get("source_url") or ""
        pdf_url = source_url if source_url.lower().endswith(".pdf") else None
        if not pdf_url and is_govuk_publication_url(source_url):
            pdf_url = resolve_govuk_pdf_url(source_url)
        if not pdf_url or pdf_url == source_url:
            if source_url.lower().endswith(".pdf"):
                pdf_url = source_url
            else:
                continue

        print(f"  backfill: {row['title'][:60]} -> {pdf_url[:70]}...")
        if dry_run:
            updated += 1
            continue

        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE atlas.knowledge_documents
                SET source_url = %s,
                    validation_note = COALESCE(validation_note, '') || ' | PDF backfill applied',
                    updated_at = NOW()
                WHERE id = %s::uuid
                """,
                (pdf_url, row["doc_id"]),
            )
        conn.commit()
        updated += 1

        if embed and embed_script.exists():
            env = os.environ.copy()
            env.setdefault("PYTHONIOENCODING", "utf-8")
            subprocess.run(
                [sys.executable, str(embed_script), "--document-id", row["doc_id"]],
                cwd=str(ROOT),
                env=env,
                check=False,
            )
            embedded += 1

    return updated, embedded
