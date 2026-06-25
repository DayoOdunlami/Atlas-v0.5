"""Serialize wide pass between gather → synthesise (avoid duplicate retrieval)."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from agents.atlas_v5.j1t1_types import FunderBreakdownRow, J1T1CorpusStats
from agents.atlas_v5.wide_pass import WidePassResult
from agents.orchestrator.retrieval_fabric import EvidenceBag


def _stats_to_dict(stats: J1T1CorpusStats | None) -> dict[str, Any] | None:
    if stats is None:
        return None
    d = asdict(stats)
    d["funders"] = [asdict(f) for f in stats.funders]
    return d


def _stats_from_dict(raw: dict[str, Any] | None) -> J1T1CorpusStats | None:
    if not raw:
        return None
    funders = [FunderBreakdownRow(**f) for f in raw.get("funders") or []]
    return J1T1CorpusStats(
        project_count=int(raw["project_count"]),
        funding_sum=float(raw["funding_sum"]),
        null_funding_count=int(raw["null_funding_count"]),
        funded_row_count=int(raw["funded_row_count"]),
        org_count=int(raw["org_count"]),
        live_since_2024=int(raw["live_since_2024"]),
        funders=funders,
        top_citations=list(raw.get("top_citations") or []),
        queried_at=str(raw.get("queried_at") or ""),
    )


def _bag_to_dict(bag: EvidenceBag | None) -> dict[str, Any] | None:
    if bag is None:
        return None
    return {
        "corpus_raw": bag.corpus_raw,
        "corpus_documents": bag.corpus_documents,
        "external": bag.external,
        "candidates": bag.candidates,
        "lane_mode": bag.lane_mode,
        "corpus_ms": bag.corpus_ms,
        "external_ms": bag.external_ms,
        "errors": bag.errors,
        "external_skipped": bag.external_skipped,
        "govuk_count": bag.govuk_count,
        "exa_count": bag.exa_count,
        "project_hit_count": bag.project_hit_count,
        "document_hit_count": bag.document_hit_count,
    }


def _bag_from_dict(raw: dict[str, Any] | None) -> EvidenceBag | None:
    if not raw:
        return None
    return EvidenceBag(
        corpus_raw=list(raw.get("corpus_raw") or []),
        corpus_documents=list(raw.get("corpus_documents") or []),
        external=list(raw.get("external") or []),
        candidates=list(raw.get("candidates") or []),
        lane_mode=str(raw.get("lane_mode") or "corpus_primary"),
        corpus_ms=float(raw.get("corpus_ms") or 0),
        external_ms=float(raw.get("external_ms") or 0),
        errors=list(raw.get("errors") or []),
        external_skipped=bool(raw.get("external_skipped")),
        govuk_count=int(raw.get("govuk_count") or 0),
        exa_count=int(raw.get("exa_count") or 0),
        project_hit_count=int(raw.get("project_hit_count") or 0),
        document_hit_count=int(raw.get("document_hit_count") or 0),
    )


def snapshot_wide_pass(wide: WidePassResult) -> dict[str, Any]:
    return {
        "outcome": wide.outcome,
        "query": wide.query,
        "object_label": wide.object_label,
        "scope_mode": wide.scope_mode,
        "retrieval_meta": wide.retrieval_meta,
        "stats": _stats_to_dict(wide.stats),
        "corpus_hits": wide.corpus_hits,
        "candidates": wide.candidates,
        "evidence_bag": _bag_to_dict(wide.evidence_bag),
        "graph": asdict(wide.graph) if wide.graph else None,
    }


def restore_wide_pass(raw: dict[str, Any]) -> WidePassResult:
    graph = raw.get("graph")
    return WidePassResult(
        outcome=raw["outcome"],
        query=raw["query"],
        stats=_stats_from_dict(raw.get("stats")),
        graph=None if graph is None else _restore_graph(graph),
        corpus_hits=list(raw.get("corpus_hits") or []),
        candidates=list(raw.get("candidates") or []),
        evidence_bag=_bag_from_dict(raw.get("evidence_bag")),
        retrieval_meta=dict(raw.get("retrieval_meta") or {}),
        object_label=str(raw.get("object_label") or "Rail decarbonisation"),
        scope_mode=str(raw.get("scope_mode") or "rail"),
    )


def _restore_graph(raw: dict[str, Any]):
    from agents.atlas_v5.network_corpus import NetworkGraphData

    return NetworkGraphData(**raw)
