"""Atlas v5 retrieval — parallel corpus ‖ web (peer lanes, not corpus-first)."""

from __future__ import annotations

import os

from agents.orchestrator.retrieval_planner import RetrievalPlan


def parallel_evidence_enabled() -> bool:
    """Default on — set ATLAS_V5_PARALLEL_EVIDENCE=0 to revert to legacy router."""
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


def atlas_retrieval_plan(
    query: str,
    outcome: str,
    plan: RetrievalPlan,
    *,
    web_enabled: bool | None = None,
) -> RetrievalPlan:
    """
    Atlas v5 default: always fetch corpus and web in parallel (dual lane).

    Neither source is default authority — both run every substantive turn unless
    explicitly disabled via ATLAS_V5_WEB_LANE=0.
    """
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


# Back-compat alias used by tests
enrich_retrieval_plan = atlas_retrieval_plan
