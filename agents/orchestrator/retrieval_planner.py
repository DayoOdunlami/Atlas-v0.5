"""
Retrieval planner — bounded query expansion and lane selection (Phase F).

The LLM does not invent data sources; the planner picks from the allowlisted
corpus + GovUK + Exa bundle and optional scoped Exa expansions.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from agents.orchestrator.evidence_router import select_lane_mode
from agents.orchestrator.evidence_schema import LaneMode

_OPPORTUNITY_RE = re.compile(
    r"\bopportunit|funding|call|grant|tender|deadline|live call|bid\b",
    re.I,
)
_POLICY_RE = re.compile(
    r"\bpolicy|government|gov\.?uk|dft|innovate uk|ukri|regulation|strategy|guidance\b",
    re.I,
)


@dataclass
class RetrievalPlan:
    lane_mode: LaneMode
    corpus_k: int = 8
    external_enabled: bool = True
    external_timeout_s: float = 25.0
    govuk_query: str = ""
    exa_queries: list[str] = field(default_factory=list)
    rationale: str = ""


def _base_exa_queries(query: str, scope: str | None, outcome: str) -> list[str]:
    queries = [query]
    if scope:
        queries.append(f"{query} {scope} funding UK transport")
    if outcome in ("connect", "act") or _OPPORTUNITY_RE.search(query):
        queries.append(f"{query} innovate uk funding call UK")
    if _POLICY_RE.search(query):
        queries.append(f"{query} UK government transport policy")
    # Dedupe preserve order
    seen: set[str] = set()
    out: list[str] = []
    for q in queries:
        key = q.strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(q.strip())
    return out[:3]


def plan_retrieval(
    query: str,
    outcome: str,
    intent: dict[str, Any] | None = None,
    *,
    scope: str | None = None,
    effort: str = "analyze",
) -> RetrievalPlan:
    """Choose lanes and scoped search strings before parallel fetch."""
    intent = intent or {}
    if intent.get("external_search"):
        lane: LaneMode = "dual"
    else:
        lane = select_lane_mode(
            query,
            outcome,
            intent,
            has_gaps=False,
            corpus_opportunity_count=0,
        )

    # Connect / opportunity / policy queries benefit from external even on orient
    if outcome == "connect" or _OPPORTUNITY_RE.search(query):
        if lane == "corpus_only":
            lane = "dual"
    if _POLICY_RE.search(query) and lane == "corpus_only":
        lane = "dual"

    external_enabled = lane != "corpus_only"
    timeout = 25.0 if effort != "deep" else 30.0

    return RetrievalPlan(
        lane_mode=lane,
        corpus_k=10 if effort == "deep" else 8,
        external_enabled=external_enabled,
        external_timeout_s=timeout,
        govuk_query=query,
        exa_queries=_base_exa_queries(query, scope, outcome) if external_enabled else [],
        rationale=f"outcome={outcome} lane={lane} effort={effort}",
    )
