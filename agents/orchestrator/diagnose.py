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


def _resolve_passport(query: str) -> Passport:
    """Load canonical CPC passport from Supabase; fixture only as last resort."""
    from agents.cpc_passport.loader import load_cpc_passport_for_query
    from agents.matcher.passport import PassportClaim, validate_passport

    data = load_cpc_passport_for_query(query)
    if data.get("passport_id") and data.get("claims"):
        claims = [
            PassportClaim(
                domain=c.get("domain") or "general",
                text=c.get("text") or "",
                confidence_tier=c.get("confidence_tier") or "Indicative",
                role=c.get("role") or "asserts",
            )
            for c in data["claims"]
        ]
        passport = Passport(
            entity_name=data.get("title") or "Connected Places Catapult",
            owner_org=data.get("owner_org") or "Connected Places Catapult",
            sector_origin=",".join(data.get("sector_origin") or []),
            sector_target=",".join(data.get("sector_target") or []),
            summary=data.get("summary") or "",
            claims=claims,
            passport_id=data.get("passport_id"),
        )
        if not validate_passport(passport):
            return passport

    if _uses_pilot_fixtures(query):
        return cpc_smart_mobility_passport()

    return cpc_smart_mobility_passport()


def _resolve_spec(query: str) -> RequirementSpec:
    if _uses_pilot_fixtures(query):
        return innovate_uk_smart_mobility_spec()
    return extract_requirement_spec(query)


def _fetch_corpus_citations(query: str, k: int = 5) -> list[dict[str, Any]]:
    try:
        from mcps.cpc_corpus import queries as cq

        from agents.orchestrator.outcome_builders import _citation_score

        results = cq.search_projects(query, limit=k)
        if not results:
            return []
        return [
            {
                "id": r.get("id", ""),
                "title": r.get("title", r.get("project_title", "")),
                "organisation": r.get("organisation", r.get("lead_organisation", "")),
                "score": _citation_score(r),
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

    from agents.matcher.passport import validate_passport
    from agents.matcher.requirement_spec import validate_requirement_spec

    # Pilot fixtures only when spec extraction fails AND query matches pilot language
    if validate_requirement_spec(spec) and _uses_pilot_fixtures(query):
        passport = cpc_smart_mobility_passport()
        spec = innovate_uk_smart_mobility_spec()

    citations = _fetch_corpus_citations(query)

    cq_id = "cq.match.workbench" if outcome in ("diagnose", "connect") else None

    return build_value_translation_report(
        passport=passport,
        spec=spec,
        corpus_citations=citations,
        thread_id=thread_id,
        canonical_question_id=cq_id,
    )
