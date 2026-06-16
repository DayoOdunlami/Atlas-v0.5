"""
Lane router — selects corpus vs external retrieval mix by intent and gaps.
"""
from __future__ import annotations

import re
from typing import Any

from agents.orchestrator.evidence_schema import LaneMode

_POLICY_RE = re.compile(
    r"\bpolicy|government|gov\.?uk|dft|innovate uk|ukri|regulation|strategy|guidance\b",
    re.I,
)
_OPPORTUNITY_RE = re.compile(
    r"\bopportunit|funding|call|grant|tender|deadline|live call|bid\b",
    re.I,
)
_FRESHNESS_RE = re.compile(r"\bcurrent|latest|now|open|202[4-9]|recent\b", re.I)


def _intent_external(intent: dict[str, Any] | None) -> bool:
    if not intent:
        return False
    return bool(intent.get("external_search"))


def select_lane_mode(
    query: str,
    outcome: str,
    intent: dict[str, Any] | None = None,
    *,
    has_gaps: bool = False,
    corpus_opportunity_count: int = 0,
) -> LaneMode:
    """Return the evidence lane mix for this turn."""
    q = query.lower()
    intent = intent or {}

    if outcome == "defend":
        return "dual"

    if outcome == "connect" and _OPPORTUNITY_RE.search(query):
        return "dual"

    # Diagnose with gaps OR all-MOVE verdicts is the strongest signal that the
    # corpus is incomplete on this topic — fire the external lane to enrich.
    if outcome == "diagnose" and has_gaps:
        return "dual"

    if outcome == "orient" and not has_gaps and not _intent_external(intent):
        if not _POLICY_RE.search(query) and not _OPPORTUNITY_RE.search(query):
            return "corpus_only"

    if _POLICY_RE.search(query) and outcome in ("orient", "act", "defend", "diagnose"):
        return "dual"

    if outcome == "connect" or _OPPORTUNITY_RE.search(query):
        if corpus_opportunity_count == 0 or has_gaps or _FRESHNESS_RE.search(query):
            return "dual"
        return "corpus_primary"

    if _intent_external(intent) or has_gaps:
        return "corpus_primary"

    return "corpus_primary"


def detect_evidence_gaps(model: dict[str, Any]) -> bool:
    """True when matcher or builders signal missing/stale evidence."""
    blocks = model.get("blocks_data") or {}
    for m in blocks.get("match_bench", {}).get("matches", []):
        if m.get("verdict") in ("GAP", "MOVE", "RISK"):
            return True
    for d in blocks.get("dimension_gap", {}).get("dimensions", []):
        if d.get("verdict") in ("GAP", "MOVE"):
            return True
    opps = blocks.get("opportunity_list", {}).get("items", [])
    if not opps and model.get("outcome") in ("connect", "act"):
        return True
    return False


def count_corpus_opportunities(model: dict[str, Any]) -> int:
    items = (model.get("blocks_data") or {}).get("opportunity_list", {}).get("items", [])
    return len([i for i in items if i.get("source") != "external"])
