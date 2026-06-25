"""Atlas v5 retrieval — parallel corpus ‖ web shaped by source shopper (1A)."""

from __future__ import annotations

import os

from agents.atlas_v5.source_shopper import ShoppingList, materialize_exa_queries
from agents.orchestrator.retrieval_planner import RetrievalPlan


def parallel_evidence_enabled() -> bool:
    return os.getenv("ATLAS_V5_PARALLEL_EVIDENCE", "1").strip().lower() not in (
        "0",
        "false",
        "off",
        "no",
    )


def web_lane_enabled() -> bool:
    return os.getenv("ATLAS_V5_WEB_LANE", "1").strip().lower() not in (
        "0",
        "false",
        "off",
        "no",
    )


def research_lane_enabled() -> bool:
    return os.getenv("ATLAS_V5_RESEARCH_LANE", "1").strip().lower() not in (
        "0",
        "false",
        "off",
        "no",
    )


def plan_from_shopping_list(
    query: str,
    shopping: ShoppingList,
    *,
    web_enabled: bool | None = None,
) -> RetrievalPlan:
    """
    Build RetrievalPlan from shopping list — both markets always enabled when web on.
    Weights live on ShoppingList; plan carries sub-queries for fabric execution.
    """
    web_on = web_lane_enabled() if web_enabled is None else web_enabled
    q = query.strip()
    if not web_on or not parallel_evidence_enabled():
        return RetrievalPlan(
            lane_mode="corpus_only",
            corpus_k=10,
            external_enabled=False,
            external_timeout_s=14.0,
            govuk_query=q[:160],
            exa_queries=[],
            rationale=f"shopping_list={shopping.source}; web_lane=disabled",
        )

    exa = materialize_exa_queries(q, shopping.web)
    govuk_q = (shopping.web.sub_queries[0] if shopping.web.sub_queries else q)[:160]

    return RetrievalPlan(
        lane_mode="dual",
        corpus_k=10,
        external_enabled=True,
        external_timeout_s=14.0,
        govuk_query=govuk_q,
        exa_queries=exa[:6],
        rationale=(
            f"shopping_list={shopping.source}; lead={shopping.reconcile_lead}; "
            f"corpus=p{shopping.corpus.projects_weight:.2f}/d{shopping.corpus.documents_weight:.2f}; "
            f"web=gov{shopping.web.govuk_weight:.2f}"
        ),
    )


def atlas_retrieval_plan(
    query: str,
    outcome: str,
    plan: RetrievalPlan,
    *,
    web_enabled: bool | None = None,
    shopping: ShoppingList | None = None,
) -> RetrievalPlan:
    """When shopping list present, use shaped plan; else legacy dual-lane enrich."""
    if shopping is not None:
        return plan_from_shopping_list(query, shopping, web_enabled=web_enabled)

    web_on = web_lane_enabled() if web_enabled is None else web_enabled
    if not web_on or not parallel_evidence_enabled():
        if not web_on:
            return RetrievalPlan(
                lane_mode="corpus_only",
                corpus_k=plan.corpus_k,
                external_enabled=False,
                external_timeout_s=plan.external_timeout_s,
                govuk_query=plan.govuk_query,
                exa_queries=[],
                rationale=f"{plan.rationale}; web_lane=disabled",
            )
        return plan

    exa = list(plan.exa_queries or [])
    q = query.strip()
    if q and q not in exa:
        exa.insert(0, q)
    if f"{q} UK transport innovation" not in exa and q:
        exa.append(f"{q} UK transport innovation")

    seen: set[str] = set()
    deduped: list[str] = []
    for item in exa:
        key = item.strip().lower()
        if key and key not in seen:
            seen.add(key)
            deduped.append(item.strip())

    return RetrievalPlan(
        lane_mode="dual",
        corpus_k=max(plan.corpus_k, 10),
        external_enabled=True,
        external_timeout_s=max(plan.external_timeout_s, 14.0),
        govuk_query=plan.govuk_query or q[:160],
        exa_queries=deduped[:4],
        rationale=f"{plan.rationale}; atlas_v5 parallel dual (corpus ‖ web)",
    )


enrich_retrieval_plan = atlas_retrieval_plan
