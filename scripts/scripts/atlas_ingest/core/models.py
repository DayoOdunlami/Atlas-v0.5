"""Data models shared across the ingest engine."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Optional
from uuid import UUID


@dataclass
class NormalizedRow:
    """Normalised representation of a single ingest candidate.

    Every source adapter produces this shape; the core pipeline operates
    on NormalizedRow instances without needing to know about source-specific
    fields beyond raw_metadata.
    """

    title: str
    source_url: str
    source: str  # 'horizon_europe' | 'find_a_tender' | 'innovate_uk' | 'govuk'
    status: str  # 'open' | 'closed'
    doc_type: str  # 'live_call' | 'knowledge_document'
    description: Optional[str] = None
    funder: Optional[str] = None
    deadline: Optional[date] = None
    funding_amount: Optional[str] = None
    # For knowledge_documents (populated by classify.infer_modes_themes)
    modes: list[str] = field(default_factory=list)
    themes: list[str] = field(default_factory=list)
    # For knowledge_documents: tier ('primary' | 'secondary') and auto-approval flag.
    # Adapters set tier='primary' and auto_approve=True for trusted primary-source content
    # (e.g. gov.uk policy papers) so the row lands in status='approved' immediately.
    tier: str = "secondary"
    auto_approve: bool = False
    # Source-specific fields preserved for audit
    raw_metadata: dict = field(default_factory=dict)


@dataclass
class RunCounters:
    """Per-source counters written to atlas.ingest_runs at the end of a run."""

    fetched: int = 0
    l1_passed: int = 0
    classified_relevant: int = 0
    classified_borderline: int = 0
    classified_irrelevant: int = 0
    inserted: int = 0
    updated: int = 0
    skipped_existing: int = 0
    failed: int = 0
    embedded: int = 0
    routed_live_call: int = 0
    routed_knowledge_doc: int = 0
    cost_estimate_usd: float = 0.0

    def as_dict(self) -> dict:
        return {
            "fetched": self.fetched,
            "l1_passed": self.l1_passed,
            "classified_relevant": self.classified_relevant,
            "classified_borderline": self.classified_borderline,
            "classified_irrelevant": self.classified_irrelevant,
            "inserted": self.inserted,
            "updated": self.updated,
            "skipped_existing": self.skipped_existing,
            "failed": self.failed,
            "embedded": self.embedded,
            "routed_live_call": self.routed_live_call,
            "routed_knowledge_doc": self.routed_knowledge_doc,
            "cost_estimate_usd": self.cost_estimate_usd,
        }
