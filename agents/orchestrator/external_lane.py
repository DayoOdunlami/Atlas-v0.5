"""
Controlled external retrieval — GovUK + Exa, domain-scoped, sense-checked.
"""
from __future__ import annotations

import logging
import re
from typing import Any

from agents.orchestrator.evidence_schema import (
    make_external_evidence,
    make_opportunity_candidate,
)

logger = logging.getLogger(__name__)

_FUNDER_DOMAINS = ("innovateuk", "ukri.org", "gov.uk", "nationalhighways.co.uk")
_CALL_RE = re.compile(r"\b(call|challenge|competition|fund|grant|tender)\b", re.I)


def _infer_source_tier(url: str, publisher: str) -> str:
    u = (url or "").lower()
    p = (publisher or "").lower()
    if "gov.uk" in u or p in ("dft", "govuk", "innovateuk", "ukri"):
        return "primary_gov"
    if any(d in u for d in ("innovateuk", "ukri")):
        return "funder"
    return "publisher"


def _normalize_title(title: str) -> str:
    return re.sub(r"\s+", " ", (title or "").lower().strip())


def _load_corpus_call_titles(scope: str | None = None) -> set[str]:
    titles: set[str] = set()
    try:
        from agents.cpc_passport.loader import load_cpc_top_opportunities

        for o in load_cpc_top_opportunities(scope=scope, limit=80):
            t = _normalize_title(o.get("title") or "")
            if t:
                titles.add(t)
    except Exception as exc:
        logger.debug("corpus call titles unavailable: %s", exc)
    return titles


def _sense_check(raw: dict[str, Any], query: str) -> dict[str, Any] | None:
    title = (raw.get("title") or "").strip()
    url = (raw.get("url") or "").strip()
    if not title or len(title) < 8:
        return None
    if url and not url.startswith("http"):
        return None
    q_words = {w for w in query.lower().split() if len(w) > 3}
    title_words = set(title.lower().split())
    if q_words and len(q_words & title_words) == 0 and not _CALL_RE.search(title):
        if not any(d in url.lower() for d in _FUNDER_DOMAINS):
            return None
    publisher = raw.get("recommended_provider") or raw.get("publisher") or ""
    tier = _infer_source_tier(url, publisher)
    return make_external_evidence(
        title=title,
        url=url,
        snippet=raw.get("snippet") or "",
        publisher=publisher,
        retrieval_tool=raw.get("retrieval_tool") or "exa_search",
        source_tier=tier,  # type: ignore[arg-type]
    )


def fetch_external_evidence(
    query: str,
    outcome: str,
    lane_mode: str,
    *,
    scope: str | None = None,
    limit: int = 5,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Returns (external_evidence, opportunity_candidates).
    Never raises — returns empty lists when keys missing or APIs fail.
    """
    from agents.external_search import search_exa, search_govuk

    external: list[dict[str, Any]] = []
    candidates: list[dict[str, Any]] = []
    corpus_titles = _load_corpus_call_titles(scope)

    govuk_q = query
    exa_q = query
    if scope:
        exa_q = f"{query} {scope} funding UK transport"

    if lane_mode in ("dual", "external_primary", "corpus_primary"):
        for raw in search_govuk(govuk_q, limit=min(limit, 5)):
            item = _sense_check(raw, query)
            if item:
                external.append(item)

    if lane_mode in ("dual", "external_primary") or outcome in ("connect", "act"):
        scoped = f"{exa_q} site:gov.uk OR innovate uk funding"
        for raw in search_exa(scoped, limit=min(limit, 5)):
            item = _sense_check(raw, query)
            if not item:
                continue
            external.append(item)
            norm = _normalize_title(item["title"])
            if norm not in corpus_titles and _CALL_RE.search(item["title"]):
                candidates.append(
                    make_opportunity_candidate(
                        title=item["title"],
                        url=item.get("url") or "",
                        publisher=item.get("publisher") or "",
                        funder=item.get("publisher") or "",
                        snippet=item.get("snippet") or "",
                    )
                )

    # Dedupe by URL
    seen: set[str] = set()
    deduped_ext: list[dict[str, Any]] = []
    for e in external:
        key = e.get("url") or e.get("title")
        if key in seen:
            continue
        seen.add(key)
        deduped_ext.append(e)

    seen_c: set[str] = set()
    deduped_c: list[dict[str, Any]] = []
    for c in candidates:
        key = _normalize_title(c.get("title") or "")
        if not key or key in seen_c or key in corpus_titles:
            continue
        seen_c.add(key)
        deduped_c.append(c)

    return deduped_ext[:limit], deduped_c[:3]
