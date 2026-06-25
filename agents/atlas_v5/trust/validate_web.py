"""Web lane validation — GovUK / Exa hits → ledger figures."""

from __future__ import annotations

import re
from typing import Any

from agents.atlas_v5.j1t1_assembler import WEB_UPPER_GBP
from agents.atlas_v5.keyed_figures import KeyedFigure
from agents.orchestrator.retrieval_fabric import EvidenceBag

_GBP_AMOUNT = re.compile(
    r"£\s*([\d,.]+)\s*(bn|billion|m|million|k|thousand)?",
    re.I,
)
_PROGRAMME_RE = re.compile(
    r"\b(programme|program|national|billion|£[\d.]+\s*bn|TDNS|decarbonisation plan)\b",
    re.I,
)
_GOVUK_PUBLISHER = re.compile(r"gov\.uk|department for transport|innovate uk", re.I)


def _parse_gbp_amount(text: str) -> float | None:
    best: float | None = None
    for m in _GBP_AMOUNT.finditer(text):
        raw = m.group(1).replace(",", "")
        try:
            val = float(raw)
        except ValueError:
            continue
        unit = (m.group(2) or "").lower()
        if unit in ("bn", "billion"):
            val *= 1_000_000_000
        elif unit in ("m", "million"):
            val *= 1_000_000
        elif unit in ("k", "thousand"):
            val *= 1_000
        if best is None or val > best:
            best = val
    return best


def _item_text(item: dict[str, Any]) -> str:
    parts = [
        str(item.get("title") or ""),
        str(item.get("snippet") or ""),
        str(item.get("publisher") or ""),
        str(item.get("url") or ""),
    ]
    return " ".join(parts)


def _validation_for_item(item: dict[str, Any]) -> tuple[str, list[str]]:
    url = str(item.get("url") or "")
    text = _item_text(item)
    refs = [url] if url else []
    if url and _GOVUK_PUBLISHER.search(text) and _parse_gbp_amount(text):
        return "verified", refs
    if url and len(text.strip()) > 40:
        return "candidate", refs
    return "candidate", refs


def extract_programme_total_gbp(bag: EvidenceBag) -> tuple[float | None, str, str, list[str]]:
    """Best validated programme-scale GBP from external hits."""
    best: float | None = None
    best_status = "absent"
    best_prov = "no web programme figure extracted"
    refs: list[str] = []

    for item in bag.external:
        text = _item_text(item)
        amount = _parse_gbp_amount(text)
        if amount is None:
            continue
        status, item_refs = _validation_for_item(item)
        if best is None or amount > best:
            best = amount
            best_status = status
            best_prov = f"web extract: {(item.get('title') or item.get('url') or 'web')[:80]}"
            refs = item_refs

    for cand in bag.candidates:
        text = _item_text(cand)
        amount = _parse_gbp_amount(text) or _safe_float(cand.get("funding_amount"))
        if amount is None:
            continue
        if best is None or amount > best:
            best = amount
            best_status = "candidate"
            best_prov = f"web candidate: {(cand.get('title') or 'funding call')[:80]}"
            refs = [str(cand.get("url") or cand.get("id") or "candidate")]

    if best is None and bag.external and _PROGRAMME_RE.search(
        " ".join(_item_text(i) for i in bag.external[:5])
    ):
        best = WEB_UPPER_GBP
        best_status = "candidate"
        best_prov = "programme-scale context (TDNS candidate — web lane signal, not ingested)"
        refs = [str(bag.external[0].get("url") or "web-0")]

    return best, best_status, best_prov, refs


def _safe_float(v: Any) -> float | None:
    try:
        if v is None:
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


def _web_tier(external_count: int, verified_count: int) -> str:
    if verified_count >= 2 and external_count >= 3:
        return "Supported"
    if verified_count >= 1 or external_count >= 2:
        return "Indicative"
    if external_count >= 1:
        return "Speculative"
    return "Speculative"


def build_web_figures(bag: EvidenceBag | None, *, external_skipped: bool) -> dict[str, KeyedFigure]:
    if external_skipped or bag is None:
        return {}

    figures: dict[str, KeyedFigure] = {}
    ext_count = len(bag.external)
    verified_refs: list[str] = []

    for item in bag.external[:10]:
        status, refs = _validation_for_item(item)
        if status == "verified":
            verified_refs.extend(refs)

    tier = _web_tier(ext_count, len(verified_refs))

    figures["web.external_count"] = KeyedFigure(
        key="web.external_count",
        value=ext_count,
        unit="count",
        material="borrowed",
        provenance="parallel web lane (GovUK + Exa)",
        lane="web",
        validation_status="verified" if ext_count >= 2 else ("candidate" if ext_count else "absent"),
        confidence_tier=tier,
        source_refs=verified_refs[:8]
        or ([str(bag.external[0].get("url") or "web")] if bag.external else []),
    )

    programme, prog_status, prog_prov, prog_refs = extract_programme_total_gbp(bag)
    if programme is not None and prog_status != "absent":
        figures["web.programme_total_gbp"] = KeyedFigure(
            key="web.programme_total_gbp",
            value=programme,
            unit="gbp",
            material="borrowed",
            provenance=prog_prov,
            lane="web",
            validation_status=prog_status,  # type: ignore[arg-type]
            confidence_tier=tier,
            source_refs=prog_refs,
        )

    cand_count = len(bag.candidates)
    if cand_count:
        figures["web.candidate_count"] = KeyedFigure(
            key="web.candidate_count",
            value=cand_count,
            unit="count",
            material="borrowed",
            provenance="web funding/opportunity candidates",
            lane="web",
            validation_status="candidate",
            confidence_tier=tier,
            source_refs=[str(c.get("id") or c.get("url") or "cand") for c in bag.candidates[:5]],
        )

    return figures
