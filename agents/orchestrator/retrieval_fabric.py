"""
Parallel retrieval fabric — corpus ‖ external (Phase F PR1).

Increment 1A: shaped by ShoppingList — both markets always run; weights scale limits.
"""
from __future__ import annotations

import concurrent.futures
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

from agents.atlas_v5.source_shopper import (
    ShoppingList,
    corpus_fetch_limits,
    materialize_exa_queries,
    research_fetch_limit,
    web_fetch_limits,
)
from agents.orchestrator.retrieval_planner import RetrievalPlan

logger = logging.getLogger(__name__)


@dataclass
class EvidenceBag:
    corpus_raw: list[dict[str, Any]] = field(default_factory=list)
    corpus_documents: list[dict[str, Any]] = field(default_factory=list)
    external: list[dict[str, Any]] = field(default_factory=list)
    candidates: list[dict[str, Any]] = field(default_factory=list)
    lane_mode: str = "corpus_primary"
    corpus_ms: float = 0.0
    external_ms: float = 0.0
    errors: list[str] = field(default_factory=list)
    external_skipped: bool = False
    govuk_count: int = 0
    exa_count: int = 0
    project_hit_count: int = 0
    document_hit_count: int = 0
    research_snapshot: dict[str, Any] | None = None
    research_ms: float = 0.0
    research_skipped: bool = False

    def as_meta(self) -> dict[str, Any]:
        return {
            "lane_mode": self.lane_mode,
            "corpus_count": len(self.corpus_raw),
            "corpus_document_count": len(self.corpus_documents),
            "external_count": len(self.external),
            "candidate_count": len(self.candidates),
            "research_count": int((self.research_snapshot or {}).get("sample_size") or 0),
            "research_total": int((self.research_snapshot or {}).get("total_count") or 0),
            "corpus_ms": round(self.corpus_ms, 1),
            "external_ms": round(self.external_ms, 1),
            "research_ms": round(self.research_ms, 1),
            "errors": self.errors,
            "external_skipped": self.external_skipped,
            "research_skipped": self.research_skipped,
            "govuk_count": self.govuk_count,
            "exa_count": self.exa_count,
            "project_hit_count": self.project_hit_count,
            "document_hit_count": self.document_hit_count,
        }

    @property
    def corpus_thin(self) -> bool:
        return self.project_hit_count < 2 and self.document_hit_count < 2

    @property
    def has_external(self) -> bool:
        return bool(self.external or self.candidates)

    @property
    def conflict_count(self) -> int:
        return 0


def _fetch_projects(query: str, k: int) -> list[dict[str, Any]]:
    try:
        from mcps.cpc_corpus import queries as cq

        rows = cq.search_projects(query, limit=k) or []
        for row in rows:
            row.setdefault("source_type", "project")
        return rows
    except Exception as exc:
        logger.debug("corpus project fetch failed: %s", exc)
        return []


def _fetch_documents(query: str, k: int, sub_queries: list[str] | None = None) -> list[dict[str, Any]]:
    try:
        from mcps.cpc_corpus import queries as cq

        claim = (sub_queries[0] if sub_queries else query)[:400]
        rows = cq.evidence_for_claim(claim, limit=k) or []
        for row in rows:
            row["source_type"] = "knowledge_doc"
        return rows
    except Exception as exc:
        logger.debug("corpus document fetch failed: %s", exc)
        return []


def _fetch_corpus_shaped(query: str, shopping: ShoppingList) -> tuple[list[dict], list[dict], list[str]]:
    proj_k, doc_k = corpus_fetch_limits(shopping.corpus)
    errors: list[str] = []
    sub_q = shopping.corpus.sub_queries or [query]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        pf = pool.submit(_fetch_projects, query, proj_k)
        df = pool.submit(_fetch_documents, query, doc_k, sub_q)
        try:
            projects = pf.result(timeout=12.0)
        except Exception as exc:
            errors.append(f"projects: {exc}")
            projects = []
        try:
            documents = df.result(timeout=12.0)
        except Exception as exc:
            errors.append(f"documents: {exc}")
            documents = []
    return projects, documents, errors


def _fetch_corpus_legacy(query: str, k: int) -> list[dict[str, Any]]:
    return _fetch_projects(query, k)


def _fetch_external_bundle(
    query: str,
    outcome: str,
    lane_mode: str,
    scope: str | None,
    exa_queries: list[str],
    *,
    shopping: ShoppingList | None = None,
    limit: int = 5,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
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

    if shopping is not None:
        gov_limit, exa_limit = web_fetch_limits(shopping.web)
        exa_queries = materialize_exa_queries(query, shopping.web)
        govuk_q = (shopping.web.sub_queries[0] if shopping.web.sub_queries else query)[:160]
    else:
        gov_limit = min(limit, 5)
        exa_limit = min(limit, 4)
        govuk_q = query

    def _govuk() -> list[dict[str, Any]]:
        try:
            return search_govuk(govuk_q, limit=gov_limit)
        except Exception as exc:
            errors.append(f"govuk: {exc}")
            return []

    def _exa_all() -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        per_q = max(1, exa_limit // max(len(exa_queries or [query]), 1))
        for eq in exa_queries or [query]:
            try:
                if shopping is not None:
                    scoped = eq
                else:
                    scoped = f"{eq} site:gov.uk OR innovate uk funding"
                rows.extend(search_exa(scoped, limit=min(per_q + 1, 4)))
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
                result = fut.result(timeout=8.0)
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

    return deduped_ext[:limit * 2], deduped_c[:3], errors


def _fetch_research_snapshot(query: str, shopping: ShoppingList) -> tuple[dict[str, Any] | None, list[str]]:
    from agents.atlas_v5.trust.validate_research import fetch_openalex_snapshot

    errors: list[str] = []
    sub_q = (shopping.research.sub_queries[0] if shopping.research.sub_queries else query)[:200]
    limit = research_fetch_limit(shopping.research)
    try:
        snapshot = fetch_openalex_snapshot(sub_q, limit=limit)
        if snapshot is None:
            errors.append("research: openalex returned no snapshot")
        return snapshot, errors
    except Exception as exc:
        errors.append(f"research: {exc}")
        return None, errors


def _research_enabled() -> bool:
    from agents.atlas_v5.web_lane import research_lane_enabled

    return research_lane_enabled()


def run_retrieval_fabric(
    query: str,
    outcome: str,
    plan: RetrievalPlan,
    *,
    scope: str | None = None,
    shopping: ShoppingList | None = None,
) -> EvidenceBag:
    """Fetch corpus, external, and research lanes in parallel when enabled."""
    bag = EvidenceBag(lane_mode=plan.lane_mode)
    research_on = _research_enabled() and shopping is not None

    if not plan.external_enabled:
        bag.external_skipped = True
        t0 = time.monotonic()
        if shopping is not None:
            projects, documents, errs = _fetch_corpus_shaped(query, shopping)
            bag.corpus_raw = projects
            bag.corpus_documents = documents
            bag.errors.extend(errs)
            bag.project_hit_count = len(projects)
            bag.document_hit_count = len(documents)
        else:
            bag.corpus_raw = _fetch_corpus_legacy(query, plan.corpus_k)
            bag.project_hit_count = len(bag.corpus_raw)
        bag.corpus_ms = (time.monotonic() - t0) * 1000

        if research_on and shopping is not None:
            t1 = time.monotonic()
            snapshot, r_errs = _fetch_research_snapshot(query, shopping)
            bag.research_snapshot = snapshot
            bag.errors.extend(r_errs)
            bag.research_ms = (time.monotonic() - t1) * 1000
        else:
            bag.research_skipped = True
        return bag

    workers = 3 if research_on else 2
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        if shopping is not None:
            corpus_fut = pool.submit(_fetch_corpus_shaped, query, shopping)
        else:
            corpus_fut = pool.submit(_fetch_corpus_legacy, query, plan.corpus_k)
        ext_fut = pool.submit(
            _fetch_external_bundle,
            plan.govuk_query or query,
            outcome,
            plan.lane_mode,
            scope,
            plan.exa_queries,
            shopping=shopping,
        )
        research_fut = None
        if research_on and shopping is not None:
            research_fut = pool.submit(_fetch_research_snapshot, query, shopping)

        t0 = time.monotonic()
        try:
            if shopping is not None:
                projects, documents, errs = corpus_fut.result(timeout=plan.external_timeout_s)
                bag.corpus_raw = projects
                bag.corpus_documents = documents
                bag.errors.extend(errs)
                bag.project_hit_count = len(projects)
                bag.document_hit_count = len(documents)
            else:
                bag.corpus_raw = corpus_fut.result(timeout=plan.external_timeout_s)
                bag.project_hit_count = len(bag.corpus_raw)
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

        if research_fut is not None:
            t2 = time.monotonic()
            try:
                snapshot, r_errs = research_fut.result(timeout=plan.external_timeout_s)
                bag.research_snapshot = snapshot
                bag.errors.extend(r_errs)
            except concurrent.futures.TimeoutError:
                bag.errors.append("research: timeout")
            bag.research_ms = (time.monotonic() - t2) * 1000
        else:
            bag.research_skipped = True

    return bag
