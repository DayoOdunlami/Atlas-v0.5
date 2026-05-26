"""Upsert logic for atlas.live_calls, atlas.knowledge_documents, and atlas.classifications.

live_calls / knowledge_documents: COALESCE to protect existing classification and
embeddings from being overwritten on re-run, while refreshing status/deadline/description.

classifications: ON CONFLICT DO NOTHING on the unique (entity_type, entity_id,
taxonomy_id, label) key so existing Day-1 classifications are never overwritten.
New entities and new labels are always inserted.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

import psycopg2.extras

from .models import NormalizedRow

# Provenance mapping: source → authority_tier
# primary: government-mandated or first-party official sources
# secondary: aggregated or scraped (not first-party API)
_AUTHORITY_TIER: dict[str, str] = {
    "find_a_tender": "primary",
    "govuk": "primary",
    "horizon_europe": "secondary",
    "innovate_uk": "secondary",
}


def _live_call_authority_tier(source: str) -> str:
    """Return authority_tier for a live_call based on its source."""
    return _AUTHORITY_TIER.get(source, "tertiary")


# COALESCE pattern: preserve existing relevance_tag/embedding/viz unless new.
# Refresh: status, last_synced_at, title, funder, deadline, funding_amount, description.
# Provenance columns (authority_tier, status_confidence) written on INSERT and UPDATE.
_LIVE_CALL_UPSERT = """
INSERT INTO atlas.live_calls (
    title, funder, deadline, funding_amount, description,
    source_url, status, source, relevance_tag, relevance_reason,
    embedding, viz_x, viz_y, scraped_at, last_synced_at,
    authority_tier, status_confidence
) VALUES (
    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::vector, %s, %s, NOW(), NOW(),
    %s, 'confirmed'
)
ON CONFLICT (source_url) DO UPDATE SET
    status            = EXCLUDED.status,
    last_synced_at    = NOW(),
    title             = EXCLUDED.title,
    funder            = EXCLUDED.funder,
    deadline          = EXCLUDED.deadline,
    funding_amount    = EXCLUDED.funding_amount,
    description       = EXCLUDED.description,
    relevance_tag     = COALESCE(atlas.live_calls.relevance_tag,   EXCLUDED.relevance_tag),
    relevance_reason  = COALESCE(atlas.live_calls.relevance_reason, EXCLUDED.relevance_reason),
    embedding         = COALESCE(atlas.live_calls.embedding,        EXCLUDED.embedding),
    viz_x             = COALESCE(atlas.live_calls.viz_x,            EXCLUDED.viz_x),
    viz_y             = COALESCE(atlas.live_calls.viz_y,            EXCLUDED.viz_y),
    authority_tier    = EXCLUDED.authority_tier,
    status_confidence = 'confirmed'
"""

_KNOWLEDGE_DOC_INSERT = """
INSERT INTO atlas.knowledge_documents (
    title, source_type, source_url, publisher, published_on,
    modes, themes, summary, status, tier, added_at, updated_at,
    authority_tier, status_confidence
) VALUES (
    %s, %s, %s, %s, %s,
    %s::text[], %s::text[], %s, %s, %s, NOW(), NOW(),
    %s, 'confirmed'
)
RETURNING id
"""

_KNOWLEDGE_DOC_UPDATE = """
UPDATE atlas.knowledge_documents SET
    title             = %s,
    publisher         = %s,
    published_on      = %s,
    modes             = %s::text[],
    themes            = %s::text[],
    summary           = %s,
    updated_at        = NOW(),
    authority_tier    = %s,
    status_confidence = 'confirmed'
WHERE source_url = %s
RETURNING id
"""


def upsert_live_call(
    conn,
    row: NormalizedRow,
    tag: str,
    reason: str,
    embedding: Optional[list[float]],
    vx: Optional[float],
    vy: Optional[float],
) -> tuple[str, UUID]:
    """Upsert a single row into atlas.live_calls.

    Returns (outcome, entity_id) where outcome is 'inserted' or 'updated'
    and entity_id is the UUID of the upserted row (needed for atlas.classifications).

    Sets authority_tier from the source provenance mapping and
    status_confidence='confirmed' for every upserted row.
    source_last_modified is left NULL pending adapter-side population (future brief).
    """
    emb_str = str(embedding) if embedding is not None else None
    tier = _live_call_authority_tier(row.source)
    params = (
        row.title,
        row.funder,
        row.deadline,
        row.funding_amount,
        row.description,
        row.source_url,
        row.status,
        row.source,
        tag,
        reason[:2000] if reason else None,
        emb_str,
        vx,
        vy,
        tier,
    )
    with conn.cursor() as cur:
        cur.execute(
            _LIVE_CALL_UPSERT + " RETURNING id, (xmax = 0) AS was_inserted",
            params,
        )
        result = cur.fetchone()
    entity_id = result[0]
    outcome = "inserted" if (result and result[1]) else "updated"
    return outcome, entity_id


def upsert_live_call_batch(
    conn,
    rows: list[tuple],
) -> None:
    """Batch upsert into atlas.live_calls (no outcome tracking)."""
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, _LIVE_CALL_UPSERT, rows, page_size=50)
    conn.commit()


def upsert_knowledge_document(
    conn,
    row: NormalizedRow,
    source_type: str = "govt_report",
) -> tuple[str, UUID]:
    """Upsert a single row into atlas.knowledge_documents.

    atlas.knowledge_documents has no unique constraint on source_url, so we
    use a SELECT-first pattern instead of ON CONFLICT. Status and tier are
    read from the NormalizedRow (set by adapters); auto_approve=True rows
    land as status='approved' so they are visible to search_with_classifications.

    Sets authority_tier from source provenance: gov.uk → 'primary', others → 'tertiary'.
    Sets status_confidence='confirmed' for every upserted row.
    source_last_modified is left NULL pending adapter-side population (future brief).

    Returns (outcome, entity_id).
    """
    modes_arr = "{" + ",".join(f'"{m}"' for m in row.modes) + "}"
    themes_arr = "{" + ",".join(f'"{t}"' for t in row.themes) + "}"
    status = "approved" if row.auto_approve else "proposed"
    tier = row.tier or "secondary"
    authority_tier = "primary" if row.source == "govuk" else "tertiary"

    with conn.cursor() as cur:
        # Check for existing row by source_url
        cur.execute(
            "SELECT id FROM atlas.knowledge_documents WHERE source_url = %s LIMIT 1",
            (row.source_url,),
        )
        existing = cur.fetchone()

        if existing:
            entity_id = existing[0]
            cur.execute(
                _KNOWLEDGE_DOC_UPDATE,
                (
                    row.title,
                    row.funder,
                    row.deadline,
                    modes_arr,
                    themes_arr,
                    row.description[:2000] if row.description else None,
                    authority_tier,
                    row.source_url,
                ),
            )
            return "updated", entity_id
        else:
            cur.execute(
                _KNOWLEDGE_DOC_INSERT,
                (
                    row.title,
                    source_type,
                    row.source_url,
                    row.funder,
                    row.deadline,
                    modes_arr,
                    themes_arr,
                    row.description[:2000] if row.description else None,
                    status,
                    tier,
                    authority_tier,
                ),
            )
            entity_id = cur.fetchone()[0]
            return "inserted", entity_id


_CLASSIFICATION_INSERT = """
INSERT INTO atlas.classifications
    (entity_type, entity_id, taxonomy_id, label, confidence, classified_by, classified_at, rationale)
VALUES
    (%s, %s, %s, %s, 1.0, %s, NOW(), %s)
ON CONFLICT (entity_type, entity_id, taxonomy_id, label) DO NOTHING
"""

_CLASSIFIED_BY = "claude-haiku-4-5"


def upsert_classifications(
    conn,
    entity_type: str,
    entity_id: UUID,
    taxonomy_id: str,
    labels: list[str],
    rationale: str,
) -> int:
    """Insert per-label rows into atlas.classifications for an entity.

    Uses ON CONFLICT DO NOTHING — existing Day-1 classifications are never
    overwritten. Returns the number of rows actually inserted.

    entity_type must match the CHECK constraint: one of
      'project', 'live_call', 'knowledge_doc', 'organisation'
    """
    if not labels:
        return 0
    rows = [
        (entity_type, entity_id, taxonomy_id, label, _CLASSIFIED_BY, rationale)
        for label in labels
    ]
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, _CLASSIFICATION_INSERT, rows, page_size=50)
        # Rowcount after execute_batch is the total rows affected; ON CONFLICT DO NOTHING
        # means skipped rows aren't counted.
        inserted = cur.rowcount if cur.rowcount >= 0 else len(rows)
    return inserted
