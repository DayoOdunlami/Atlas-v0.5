"""Assign validation_tier on all knowledge_documents from current DB shape."""

from __future__ import annotations

import json
from pathlib import Path

import psycopg2.extras

from scripts.kb.govuk_pdf import normalize_title_key
from scripts.kb.validation_tier import DocShape, infer_validation_tier

MANIFEST_PATH = Path(__file__).resolve().parent / "tier1_manifest.json"


def load_manifest_keys() -> tuple[set[str], set[str]]:
    raw = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    ids: set[str] = set()
    titles: set[str] = set()
    for row in raw:
        if row.get("id"):
            ids.add(str(row["id"]))
        title_key = normalize_title_key(row.get("title") or "")
        if title_key:
            titles.add(title_key)
    return ids, titles


def assign_all_tiers(conn, *, dry_run: bool = False) -> dict[str, int]:
    manifest_ids, manifest_titles = load_manifest_keys()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT d.id::text AS doc_id, d.status, d.title, d.source_url,
                   COUNT(c.id) AS chunk_count,
                   COUNT(c.id) FILTER (WHERE c.embedding IS NOT NULL) AS embedded_count
            FROM atlas.knowledge_documents d
            LEFT JOIN atlas.knowledge_chunks c ON c.document_id = d.id
            GROUP BY d.id, d.status, d.title, d.source_url
            """
        )
        rows = cur.fetchall()

    counts: dict[str, int] = {}
    with conn.cursor() as cur:
        for row in rows:
            title_key = normalize_title_key(row.get("title") or "")
            doc = DocShape(
                doc_id=row["doc_id"],
                status=row["status"],
                chunk_count=int(row["chunk_count"] or 0),
                embedded_count=int(row["embedded_count"] or 0),
                source_url=row.get("source_url"),
                title=row.get("title") or "",
                is_manifest=row["doc_id"] in manifest_ids or title_key in manifest_titles,
            )
            tier, note = infer_validation_tier(doc)
            counts[tier] = counts.get(tier, 0) + 1
            if dry_run:
                continue
            cur.execute(
                """
                UPDATE atlas.knowledge_documents
                SET validation_tier = %s,
                    validation_note = %s,
                    updated_at = NOW()
                WHERE id = %s::uuid
                  AND (validation_tier IS DISTINCT FROM %s OR validation_tier IS NULL)
                """,
                (tier, note, doc.doc_id, tier),
            )
    if not dry_run:
        conn.commit()
    return counts
