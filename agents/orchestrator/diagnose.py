"""
agents.orchestrator.diagnose
============================

Deterministic Value Translation pipeline for Diagnose / Connect+transfer queries.

When the orchestrator triage classifies a query as diagnose (or connect with
transfer language), this module runs the Phase 3 matcher vertical instead of
relying on LLM-only synthesis:

  Passport + Requirement Spec → Matcher → Value Translation → Report
"""
from __future__ import annotations

import re
from typing import Any

from agents.matcher.fixtures import cpc_smart_mobility_passport, innovate_uk_smart_mobility_spec
from agents.matcher.passport import Passport, dict_to_passport
from agents.matcher.report import build_value_translation_report
from agents.matcher.requirement_spec import RequirementSpec, extract_requirement_spec

_TRANSFER_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\btransfer\b", re.I),
    re.compile(r"\bevidence\b.*\b(have|does)\b", re.I),
    re.compile(r"\bsmart\s+mobility\b", re.I),
    re.compile(r"\binnovate\s+uk\b", re.I),
    re.compile(r"\bsmart\s+city\b", re.I),
]


def should_run_value_translation(outcome: str, query: str) -> bool:
    """True when the matcher vertical should run deterministically."""
    if outcome == "diagnose":
        return True
    if outcome == "connect":
        return any(pat.search(query) for pat in _TRANSFER_PATTERNS)
    return False


def _uses_pilot_fixtures(query: str) -> bool:
    q = query.lower()
    return (
        "smart mobility" in q
        or "innovate uk" in q
        or "smart city" in q
    )


def _resolve_passport(query: str) -> Passport | None:
    if _uses_pilot_fixtures(query):
        return cpc_smart_mobility_passport()

    try:
        from agents.passport_loader import load_entity_passport

        raw = load_entity_passport("CPC")
        if isinstance(raw, dict) and raw.get("passport"):
            return dict_to_passport(raw["passport"])
        if isinstance(raw, dict) and raw.get("entity_name"):
            return dict_to_passport(raw)
    except Exception:
        pass

    return cpc_smart_mobility_passport()


def _resolve_spec(query: str) -> RequirementSpec:
    if _uses_pilot_fixtures(query):
        return innovate_uk_smart_mobility_spec()
    return extract_requirement_spec(query)


def _fetch_corpus_citations(query: str, k: int = 5) -> list[dict[str, Any]]:
    try:
        from mcps.cpc_corpus import queries as cq

        results = cq.search_projects(query, limit=k)
        if not results:
            return []
        return [
            {
                "id": r.get("id", ""),
                "title": r.get("title", r.get("project_title", "")),
                "organisation": r.get("organisation", r.get("lead_organisation", "")),
                "score": float(r.get("score", r.get("similarity", 0))),
            }
            for r in results
            if r.get("id")
        ]
    except Exception:
        return []


def run_value_translation_pipeline(
    *,
    query: str,
    outcome: str = "diagnose",
    thread_id: str | None = None,
) -> dict[str, Any] | None:
    """
    Run the full Value Translation report builder for a user query.

    Returns None when the query is not eligible for this path.
    """
    if not should_run_value_translation(outcome, query):
        return None

    passport = _resolve_passport(query)
    spec = _resolve_spec(query)
    citations = _fetch_corpus_citations(query)

    cq_id = "cq.match.workbench" if outcome in ("diagnose", "connect") else None

    return build_value_translation_report(
        passport=passport,
        spec=spec,
        corpus_citations=citations,
        thread_id=thread_id,
        canonical_question_id=cq_id,
    )
