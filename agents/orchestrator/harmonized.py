"""
D4.6 — Harmonized evidence orchestration entry point.
"""
from __future__ import annotations

import concurrent.futures
from typing import Any

from agents.feature_flags import flags
from agents.orchestrator.evidence_router import (
    count_corpus_opportunities,
    detect_evidence_gaps,
    select_lane_mode,
)
from agents.orchestrator.external_lane import fetch_external_evidence
from agents.orchestrator.reconcile import apply_reconciliation

_EXTERNAL_FETCH_TIMEOUT_S = 5.0


def _fetch_bounded(
    query: str,
    outcome: str,
    lane: str,
    scope: str | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        fut = pool.submit(fetch_external_evidence, query, outcome, lane, scope=scope)
        try:
            return fut.result(timeout=_EXTERNAL_FETCH_TIMEOUT_S)
        except concurrent.futures.TimeoutError:
            return [], []


def enrich_with_harmonized_evidence(
    model: dict[str, Any],
    *,
    query: str,
    outcome: str,
    intent: dict[str, Any] | None = None,
    scope: str | None = None,
) -> dict[str, Any]:
    """Apply dual-lane enrichment when ATLAS5_HARMONIZED_EVIDENCE_V1 is on."""
    if not flags.harmonized_evidence_v1:
        return model

    has_gaps = detect_evidence_gaps(model)
    corp_opps = count_corpus_opportunities(model)
    lane = select_lane_mode(
        query,
        outcome,
        intent,
        has_gaps=has_gaps,
        corpus_opportunity_count=corp_opps,
    )

    if lane == "corpus_only":
        return model

    external, candidates = _fetch_bounded(query, outcome, lane, scope)

    return apply_reconciliation(model, external, candidates, query=query)
