"""Validation tier constants and assignment rules for atlas.knowledge_documents."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ValidationTier = Literal[
    "T1_anchor",
    "T2_embedded",
    "T3_thin",
    "T4_candidate",
    "T0_retired",
]

SEARCHABLE_TIERS: frozenset[str] = frozenset({"T1_anchor", "T2_embedded", "T3_thin"})

TIER_LABELS: dict[str, str] = {
    "T1_anchor": "Anchor (tier-1 manifest)",
    "T2_embedded": "Embedded (full PDF)",
    "T3_thin": "Thin (review)",
    "T4_candidate": "Candidate (not in search)",
    "T0_retired": "Retired",
}

EMBED_CHUNK_THRESHOLD = 6


@dataclass
class DocShape:
    doc_id: str
    status: str
    chunk_count: int
    embedded_count: int
    source_url: str | None
    title: str
    is_manifest: bool = False


def infer_validation_tier(doc: DocShape) -> tuple[str, str]:
    """Return (validation_tier, validation_note)."""
    if doc.is_manifest:
        return "T1_anchor", "tier-1 manifest anchor"
    if doc.status == "retired":
        return "T0_retired", "status retired"
    if doc.status == "proposed":
        return "T4_candidate", "awaiting promotion from proposed"
    if doc.embedded_count >= EMBED_CHUNK_THRESHOLD:
        return "T2_embedded", f"{doc.embedded_count} embedded chunks"
    if doc.embedded_count >= 1:
        return "T3_thin", f"{doc.embedded_count} chunk(s) — flagged for PDF backfill review"
    return "T3_thin", "approved but no chunks — pending embed"
