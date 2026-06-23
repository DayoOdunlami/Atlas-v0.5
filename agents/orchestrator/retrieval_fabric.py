"""
Parallel retrieval fabric — corpus ‖ external (Phase F PR1).

Returns an EvidenceBag with timings and honest partial-failure metadata.
"""
from __future__ import annotations

import concurrent.futures
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

from agents.orchestrator.retrieval_planner import RetrievalPlan

logger = logging.getLogger(__name__)


@dataclass
class EvidenceBag:
    corpus_raw: list[dict[str, Any]] = field(default_factory=list)
    external: list[dict[str, Any]] = field(default_factory=list)
    candidates: list[dict[str, Any]] = field(default_factory=list)
    lane_mode: str = "corpus_primary"
    corpus_ms: float = 0.0
    external_ms: float = 0.0
    errors: list[str] = field(default_factory=list)
    external_skipped: bool = False
    govuk_count: int = 0
    exa_count: int = 0

    def as_meta(self) -> dict[str, Any]:
        return {
            "lane_mode": self.lane_mode,
            "corpus_count": len(self.corpus_raw),
            "external_count": len(self.external),
            "candidate_count": len(self.candidates),
            "corpus_ms": round(self.corpus_ms, 1),
            "external_ms": round(self.external_ms, 1),
            "errors": self.errors,
            "external_skipped": self.external_skipped,
            "govuk_count": self.govuk_count,
            "exa_count": self.exa_count,
        }

    @property
    def corpus_thin(self) -> bool:
        return len(self.corpus_raw) < 2

    @property
    def has_external(self) -> bool:
        return bool(self.external or self.candidates)

    @property
    def conflict_count(self) -> int:
        return 0  # filled after reconcile on model


def _fetch_corpus(query: str, k: int) -> list[dict[str, Any]]:
    try:
        from mcps.cpc_corpus import queries as cq
        return cq.search_projects(query, limit=k) or []
    except Exception as exc:
        logger.debug("corpus fetch failed: %s", exc)
        return []


def _fetch_external_bundle(
    query: str,
    outcome: str,
    lane_mode: str,
    scope: str | None,
    exa_queries: list[str],
    limit: int = 5,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    """GovUK and Exa queries in parallel inside the external bundle."""
    from agents.external_search import search_exa, search_govuk
    from agents.orchestrator.external_lane import (
        _load_corpus_call_titles,
        _normalize_title,
        _sense_check,
    )
    from agents.orchestrator.evidence_schema import make_opportunity_candidate

    errors: list[str] = []
    external: list[dict[str, Any]] = []
    candidates: list[dict[str, Any]] = []
    corpus_titles = _load_corpus_call_titles(scope)
    _CALL_RE = re.compile(r"\b(call|challenge|competition|fund|grant|tender)\b", re.I)

    def _govuk() -> list[dict[str, Any]]:
        try:
            return search_govuk(query, limit=min(limit, 5))
        except Exception as exc:
            errors.append(f"govuk: {exc}")
            return []

    def _exa_all() -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for eq in exa_queries or [query]:
            try:
                scoped = f"{eq} site:gov.uk OR innovate uk funding"
                rows.extend(search_exa(scoped, limit=min(limit, 4)))
            except Exception as exc:
                errors.append(f"exa: {exc}")
        return rows

    run_govuk = lane_mode in ("dual", "external_primary", "corpus_primary")
    run_exa = lane_mode in ("dual", "external_primary") or outcome in ("connect", "act")

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futs: dict[str, concurrent.futures.Future] = {}
        if run_govuk:
            futs["govuk"] = pool.submit(_govuk)
        if run_exa:
            futs["exa"] = pool.submit(_exa_all)
        govuk_raw: list[dict[str, Any]] = []
        exa_raw: list[dict[str, Any]] = []
        for name, fut in futs.items():
            try:
                result = fut.result(timeout=6.0)
                if name == "govuk":
                    govuk_raw = result
                else:
                    exa_raw = result
            except concurrent.futures.TimeoutError:
                errors.append(f"{name}: timeout")
            except Exception as exc:
                errors.append(f"{name}: {exc}")

    for raw in govuk_raw:
        item = _sense_check(raw, query)
        if item:
            external.append(item)

    for raw in exa_raw:
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

    return deduped_ext[:limit], deduped_c[:3], errors


def run_retrieval_fabric(
    query: str,
    outcome: str,
    plan: RetrievalPlan,
    *,
    scope: str | None = None,
) -> EvidenceBag:
    """Fetch corpus and external lanes in parallel within plan timeout."""
    bag = EvidenceBag(lane_mode=plan.lane_mode)

    if not plan.external_enabled:
        bag.external_skipped = True
        t0 = time.monotonic()
        bag.corpus_raw = _fetch_corpus(query, plan.corpus_k)
        bag.corpus_ms = (time.monotonic() - t0) * 1000
        return bag

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        corpus_fut = pool.submit(_fetch_corpus, query, plan.corpus_k)
        ext_fut = pool.submit(
            _fetch_external_bundle,
            plan.govuk_query or query,
            outcome,
            plan.lane_mode,
            scope,
            plan.exa_queries,
        )
        t0 = time.monotonic()
        try:
            bag.corpus_raw = corpus_fut.result(timeout=plan.external_timeout_s)
            bag.corpus_ms = (time.monotonic() - t0) * 1000
        except concurrent.futures.TimeoutError:
            bag.errors.append("corpus: timeout")
            bag.corpus_raw = []

        t1 = time.monotonic()
        try:
            ext, cand, errs = ext_fut.result(timeout=plan.external_timeout_s)
            bag.external = ext
            bag.candidates = cand
            bag.errors.extend(errs)
            bag.govuk_count = sum(1 for e in ext if "gov" in (e.get("retrieval_tool") or ""))
            bag.exa_count = len(ext) - bag.govuk_count
        except concurrent.futures.TimeoutError:
            bag.errors.append("external: timeout")
        bag.external_ms = (time.monotonic() - t1) * 1000

    return bag
