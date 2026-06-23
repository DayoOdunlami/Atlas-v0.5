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

_NAMED_CALL_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\binnovate\s+uk\s+smart\s+(mobility|city)\b", re.I),
    re.compile(r"\bccav\s+(challenge|competition|fund)", re.I),
    re.compile(r"\bukri\s+(call|fund|competition)\b", re.I),
]


_OPPORTUNITY_ONLY_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\b(?:top|closest|best|which).*(?:opportunit|funding\s+call|live\s+call)\b", re.I),
    re.compile(r"\bopportunit.*(?:route|match|fit|for\s+cpc)\b", re.I),
    re.compile(r"\bwhat are the top\b.*\b(?:opportunit|route)\b", re.I),
]


def _is_opportunity_only(query: str) -> bool:
    return any(p.search(query) for p in _OPPORTUNITY_ONLY_PATTERNS)


def _requires_transfer_analysis(query: str) -> bool:
    """True when VT matcher vertical is the right tool."""
    if re.search(r"\bevidence\b.*\btransfer\b|\btransfer\b.*\bevidence\b", query, re.I):
        return True
    if _names_specific_call(query):
        return True
    if re.search(r"\bcompare\b.*\b(?:passport|capabilit|cpc|evidence)\b", query, re.I):
        return True
    if re.search(r"\bsmart\s+mobility\b.*\btransfer\b|\btransfer\b.*\bsmart\s+mobility\b", query, re.I):
        return True
    return False


def should_run_value_translation(outcome: str, query: str) -> bool:
    """True when the matcher VT vertical should run — not generic corpus search."""
    if outcome == "connect":
        if _is_opportunity_only(query) and not _requires_transfer_analysis(query):
            return False
        return _requires_transfer_analysis(query) or any(
            pat.search(query) for pat in _TRANSFER_PATTERNS
        )
    if outcome == "diagnose":
        return _requires_transfer_analysis(query) or bool(
            re.search(
                r"\btransfer\b.*\b(?:fit|gap|lane|match)\b|\bgaps?\b.*\b(?:transfer|target|call)\b",
                query,
                re.I,
            )
        )
    return False


def _names_specific_call(query: str) -> bool:
    return any(p.search(query) for p in _NAMED_CALL_PATTERNS)


def _resolve_passport(query: str) -> tuple[Passport, bool]:
    """
    Load canonical CPC passport from Supabase. Returns (passport, used_fixture).
    Fixture only used when real passport unavailable or invalid.
    """
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
            return passport, False

    return cpc_smart_mobility_passport(), True


def _resolve_spec(query: str) -> tuple[RequirementSpec, bool]:
    """
    Returns (spec, used_fixture). Real extraction preferred — fixture only when
    heuristic extraction fails to produce a substantively valid spec.
    """
    from agents.matcher.requirement_spec import validate_requirement_spec

    extracted = extract_requirement_spec(query)
    if not validate_requirement_spec(extracted):
        return extracted, False
    return innovate_uk_smart_mobility_spec(), True


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
    Honestly labels fixture-driven comparisons so the UI/chat can disclose them.
    """
    if not should_run_value_translation(outcome, query):
        return None

    passport, passport_is_fixture = _resolve_passport(query)
    spec, spec_is_fixture = _resolve_spec(query)
    is_demo_comparison = passport_is_fixture or spec_is_fixture

    citations = _fetch_corpus_citations(query)

    cq_id = "cq.match.workbench" if outcome in ("diagnose", "connect") else None

    model = build_value_translation_report(
        passport=passport,
        spec=spec,
        corpus_citations=citations,
        thread_id=thread_id,
        canonical_question_id=cq_id,
        is_demo_comparison=is_demo_comparison,
        passport_is_fixture=passport_is_fixture,
        spec_is_fixture=spec_is_fixture,
        original_query=query,
    )
    return model
