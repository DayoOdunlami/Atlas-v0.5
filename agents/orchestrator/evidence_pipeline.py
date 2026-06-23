"""
Unified evidence pipeline — parallel fetch → build → reconcile (Phase F PR2).
"""
from __future__ import annotations

from typing import Any, Callable

from agents.feature_flags import flags
from agents.orchestrator.evidence_router import detect_evidence_gaps, select_lane_mode
from agents.orchestrator.reconcile import apply_reconciliation
from agents.orchestrator.retrieval_fabric import EvidenceBag, run_retrieval_fabric
from agents.orchestrator.retrieval_planner import plan_retrieval


def run_harmonized_turn(
    *,
    query: str,
    outcome: str,
    scope: str | None,
    intent: dict[str, Any] | None,
    effort: str,
    build_model: Callable[[EvidenceBag], dict[str, Any]],
    pre_built: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Phase F entry: plan → parallel retrieval → build → reconcile → attach meta.

    When harmonized flag is off, only corpus prefetch is used (no external).
    """
    plan = plan_retrieval(query, outcome, intent, scope=scope, effort=effort)

    if not flags.harmonized_evidence_v1:
        plan.lane_mode = "corpus_only"  # type: ignore[assignment]
        plan.external_enabled = False

    bag = run_retrieval_fabric(query, outcome, plan, scope=scope)

    if pre_built is not None:
        model = dict(pre_built)
        if bag.corpus_raw and not model.get("corpus_citations"):
            from agents.orchestrator.outcome_builders import _normalize_citations
            model["corpus_citations"] = _normalize_citations(bag.corpus_raw)
    else:
        model = build_model(bag)

    if plan.lane_mode != "corpus_only" and (bag.external or bag.candidates):
        model = apply_reconciliation(model, bag.external, bag.candidates, query=query)

    meta = bag.as_meta()
    notes = model.get("reconciliation_notes") or []
    meta["conflict_count"] = sum(1 for n in notes if n.get("type") == "conflict")
    meta["corpus_thin"] = bag.corpus_thin
    meta["external_led"] = bag.corpus_thin and bag.has_external
    model["retrieval_meta"] = meta
    return model


def enrich_with_harmonized_evidence(
    model: dict[str, Any],
    *,
    query: str,
    outcome: str,
    intent: dict[str, Any] | None = None,
    scope: str | None = None,
) -> dict[str, Any]:
    """
    Back-compat shim — re-runs lane selection with gap detection and reconciles.
    Prefer run_harmonized_turn for new code paths.
    """
    if not flags.harmonized_evidence_v1:
        return model

    has_gaps = detect_evidence_gaps(model)
    from agents.orchestrator.evidence_router import count_corpus_opportunities
    corp_opps = count_corpus_opportunities(model)
    lane = select_lane_mode(
        query,
        outcome,
        intent,
        has_gaps=has_gaps,
        corpus_opportunity_count=corp_opps,
    )
    plan = plan_retrieval(query, outcome, intent, scope=scope)
    plan.lane_mode = lane  # type: ignore[assignment]
    plan.external_enabled = lane != "corpus_only"

    bag = run_retrieval_fabric(query, outcome, plan, scope=scope)
    if lane == "corpus_only":
        return model

    updated = apply_reconciliation(model, bag.external, bag.candidates, query=query)
    meta = bag.as_meta()
    notes = updated.get("reconciliation_notes") or []
    meta["conflict_count"] = sum(1 for n in notes if n.get("type") == "conflict")
    meta["corpus_thin"] = len(updated.get("corpus_citations") or []) < 2
    meta["external_led"] = meta["corpus_thin"] and bool(bag.external or bag.candidates)
    updated["retrieval_meta"] = meta
    return updated
