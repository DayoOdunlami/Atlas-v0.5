"""
Atlas v5 — wide pass (parallel evidence gather before deep synthesis).

Corpus SQL aggregates + retrieval fabric (corpus ‖ web); no heavy model here.
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass, field
from typing import Any

from agents.atlas_v5.corpus_scope import corpus_scope_for_query
from agents.atlas_v5.intent import has_declared_uncertainty_cue, is_connect_network_query
from agents.atlas_v5.j1t1_corpus import fetch_corpus_stats
from agents.atlas_v5.j1t1_types import J1T1CorpusStats
from agents.atlas_v5.network_corpus import NetworkGraphData, fetch_connect_network_graph
from agents.atlas_v5.case_file import load_case_file
from agents.atlas_v5.source_shopper import build_shopping_list
from agents.atlas_v5.turn_classifier import OutcomeHint
from agents.orchestrator.retrieval_fabric import EvidenceBag, run_retrieval_fabric
from agents.atlas_v5.web_lane import atlas_retrieval_plan, web_lane_enabled
from agents.atlas_v5.web_orient_patch import patch_orient_web_tier
from agents.orchestrator.retrieval_planner import RetrievalPlan, plan_retrieval
from mcps.cpc_corpus import transport

logger = logging.getLogger(__name__)


def _reconcile_corpus_unavailable(
    corpus_unavailable: bool,
    stats: J1T1CorpusStats | None,
    bag: EvidenceBag,
) -> bool:
    """Postgres aggregate stats may fail while REST search still returns corpus hits."""
    if not corpus_unavailable:
        return False
    if stats is not None:
        return False
    if bag.corpus_raw:
        return False
    tier = transport.get_last_transport()
    if tier in ("rest_vector", "rest_keyword", "postgres"):
        return False
    return True


def needs_online_only_consent(wide: WidePassResult) -> bool:
    """True only when all corpus tiers failed — not when REST worked with zero hits."""
    from agents.atlas_v5.rest_fallback_assembler import _corpus_hits

    if wide.stats is not None or _corpus_hits(wide):
        return False
    meta = wide.retrieval_meta or {}
    if not meta.get("corpus_unavailable"):
        return False
    return transport.get_last_transport() == "unavailable"


@dataclass
class WidePassResult:
    outcome: OutcomeHint
    query: str
    stats: J1T1CorpusStats | None = None
    graph: NetworkGraphData | None = None
    corpus_hits: list[dict[str, Any]] = field(default_factory=list)
    candidates: list[dict[str, Any]] = field(default_factory=list)
    evidence_bag: EvidenceBag | None = None
    retrieval_meta: dict[str, Any] = field(default_factory=dict)
    session_claims: list[Any] = field(default_factory=list)
    shopping_list: Any | None = None
    object_label: str = "Rail decarbonisation"
    scope_mode: str = "rail"


def _web_lane_enabled() -> bool:
    return web_lane_enabled()


def _run_fabric_sync(query: str, outcome: str, shopping) -> EvidenceBag:
    plan = plan_retrieval(query, outcome, effort="analyze")
    plan = atlas_retrieval_plan(
        query, outcome, plan, web_enabled=_web_lane_enabled(), shopping=shopping
    )
    return run_retrieval_fabric(query, outcome, plan, shopping=shopping)


async def run_wide_pass(
    query: str,
    outcome_hint: OutcomeHint | None = None,
    *,
    online_only: bool = False,
    thread_id: str | None = None,
) -> WidePassResult:
    session_claims = load_case_file(thread_id)
    if not session_claims and has_declared_uncertainty_cue(query):
        from agents.atlas_v5.case_file import bootstrap_declared_claims_heuristic

        session_claims = bootstrap_declared_claims_heuristic(query)
    where_sql, object_label, scope_mode = corpus_scope_for_query(query)
    hint: OutcomeHint = outcome_hint or (
        "find_path"
        if has_declared_uncertainty_cue(query)
        else "connect"
        if is_connect_network_query(query)
        else "orient"
    )
    outcome = hint if hint in ("orient", "connect", "act", "diagnose", "defend", "find_path") else "orient"

    loop = asyncio.get_running_loop()
    corpus_unavailable = online_only
    stats: J1T1CorpusStats | None = None

    import time

    t0 = time.perf_counter()
    shopping_task = asyncio.create_task(
        asyncio.to_thread(build_shopping_list, query, outcome)
    )
    stats_task: asyncio.Task[J1T1CorpusStats] | None = None
    if not online_only:
        stats_task = asyncio.create_task(
            asyncio.to_thread(fetch_corpus_stats, where_sql)
        )

    shopping = await shopping_task
    shopper_ms = round((time.perf_counter() - t0) * 1000, 0)

    fabric_future = loop.run_in_executor(None, _run_fabric_sync, query, outcome, shopping)

    stats_ms = 0.0
    if stats_task is not None:
        t_stats = time.perf_counter()
        try:
            stats = await stats_task
        except transport.PostgresUnavailable as exc:
            stats = None
            corpus_unavailable = True
            logger.warning("Corpus stats unavailable: %s", exc)
        stats_ms = round((time.perf_counter() - t_stats) * 1000, 0)
    else:
        stats = None

    async def _await_bag() -> EvidenceBag:
        try:
            return await asyncio.wait_for(fabric_future, timeout=45.0)
        except asyncio.TimeoutError:
            logger.warning("Retrieval fabric timed out — continuing online-only")
            return EvidenceBag(
                errors=["retrieval_fabric_timeout"],
                external_skipped=not _web_lane_enabled(),
                lane_mode="corpus_only" if not _web_lane_enabled() else "dual",
            )

    if hint == "connect" and not online_only and not corpus_unavailable:
        graph_future = loop.run_in_executor(None, fetch_connect_network_graph)
        try:
            bag, graph = await asyncio.gather(_await_bag(), graph_future)
        except transport.PostgresUnavailable as exc:
            logger.warning("Connect graph unavailable: %s", exc)
            bag = await _await_bag()
            graph = None
            corpus_unavailable = True
        if stats is None:
            try:
                stats = await loop.run_in_executor(None, fetch_corpus_stats, where_sql)
            except transport.PostgresUnavailable:
                corpus_unavailable = True
        meta = bag.as_meta()
        meta["shopper_ms"] = shopper_ms
        meta["corpus_stats_ms"] = stats_ms
        corpus_unavailable = _reconcile_corpus_unavailable(corpus_unavailable, stats, bag)
        if corpus_unavailable:
            meta = {**meta, "corpus_unavailable": True, "online_only": True}
        elif stats is None and bag.corpus_raw:
            meta = {**meta, "corpus_status": "rest_or_search", "corpus_stats_skipped": True}
        meta["shopping_list"] = shopping.to_dict()
        return WidePassResult(
            outcome="connect",
            query=query,
            stats=stats,
            graph=graph,
            corpus_hits=bag.corpus_raw,
            candidates=bag.candidates,
            evidence_bag=bag,
            retrieval_meta=meta,
            object_label=object_label,
            scope_mode=scope_mode,
            session_claims=session_claims,
            shopping_list=shopping,
        )

    bag = await _await_bag()
    meta = bag.as_meta()
    meta["shopper_ms"] = shopper_ms
    meta["corpus_stats_ms"] = stats_ms
    corpus_unavailable = _reconcile_corpus_unavailable(corpus_unavailable, stats, bag)
    if corpus_unavailable:
        meta = {
            **meta,
            "corpus_unavailable": True,
            "online_only": True,
            "corpus_status": "unavailable",
        }
    elif stats is None and bag.corpus_raw:
        meta = {**meta, "corpus_status": "rest_or_search", "corpus_stats_skipped": True}
    meta["shopping_list"] = shopping.to_dict()
    resolved_outcome = outcome if outcome in ("orient", "act", "diagnose", "defend", "find_path") else "orient"
    return WidePassResult(
        outcome=resolved_outcome,
        query=query,
        stats=stats,
        corpus_hits=bag.corpus_raw,
        candidates=bag.candidates,
        evidence_bag=bag,
        retrieval_meta=meta,
        object_label=object_label,
        scope_mode=scope_mode,
        session_claims=session_claims,
        shopping_list=shopping,
    )


def assemble_spec_from_wide_pass(wide: WidePassResult, *, online_only: bool = False):
    from agents.atlas_v5.reconcile_spec import reconcile_answer_spec
    from agents.atlas_v5.rest_fallback_assembler import _corpus_hits

    meta = wide.retrieval_meta or {}
    has_hits = bool(_corpus_hits(wide))
    tier = transport.get_last_transport()
    fully_unavailable = bool(
        (online_only or meta.get("online_only"))
        or (
            meta.get("corpus_unavailable")
            and not has_hits
            and tier == "unavailable"
        )
    )

    if wide.stats is None and not has_hits and fully_unavailable:
        from agents.atlas_v5.online_only_assembler import assemble_online_only_spec

        spec = assemble_online_only_spec(wide)
        if wide.evidence_bag is not None:
            spec = reconcile_answer_spec(
                spec,
                wide.evidence_bag,
                query=wide.query,
                shopping=wide.shopping_list,
                has_sql_stats=False,
            )
        return spec

    if wide.outcome == "connect" and wide.stats and wide.graph:
        from agents.atlas_v5.connect_assembler import assemble_connect_spec

        summary = (
            f"Orient: {wide.stats.project_count} projects, "
            f"{wide.stats.funding_sum:,.0f} floor"
        )
        spec = assemble_connect_spec(
            wide.stats,
            wide.graph,
            query=wide.query,
            carried_summary=summary,
        )
    elif wide.outcome == "diagnose" and wide.stats:
        from agents.atlas_v5.diagnose_assembler import assemble_diagnose_spec

        spec = assemble_diagnose_spec(
            wide.stats,
            query=wide.query,
            object_label=wide.object_label,
        )
    elif wide.outcome == "act" and wide.stats:
        from agents.atlas_v5.act_assembler import assemble_act_spec

        spec = assemble_act_spec(wide.stats, wide, query=wide.query)
    elif wide.outcome == "find_path":
        from agents.atlas_v5.find_path_assembler import assemble_find_path_spec

        spec = assemble_find_path_spec(wide)
    elif wide.stats:
        from agents.atlas_v5.j1t1_assembler import assemble_j1t1_spec

        spec = assemble_j1t1_spec(wide.stats)
        if wide.query:
            updates: dict = {"query": wide.query}
            if wide.object_label != "Rail decarbonisation":
                updates["object"] = wide.object_label
            spec = spec.model_copy(update=updates)
    elif wide.stats is None:
        from agents.atlas_v5.rest_fallback_assembler import assemble_rest_fallback_spec

        spec = assemble_rest_fallback_spec(wide)

    if wide.evidence_bag is not None:
        spec = reconcile_answer_spec(
            spec,
            wide.evidence_bag,
            query=wide.query,
            shopping=wide.shopping_list,
            has_sql_stats=wide.stats is not None,
        )
        spec = patch_orient_web_tier(spec, wide.evidence_bag, wide.stats)
    return spec
