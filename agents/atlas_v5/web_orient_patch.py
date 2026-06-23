"""Patch orient AnswerSpec when web lane returns external evidence."""

from __future__ import annotations

from typing import Any

from agents.atlas_v5.j1t1_assembler import WEB_UPPER_GBP, format_gbp_compact, _format_ratio
from agents.atlas_v5.j1t1_types import J1T1CorpusStats
from agents.contracts.answer_spec import AnswerSpec
from agents.orchestrator.retrieval_fabric import EvidenceBag


def _web_upper_from_bag(bag: EvidenceBag) -> float | None:
    """Prefer live web signals; fall back to TDNS programme scale constant."""
    for item in bag.external[:5]:
        snippet = (item.get("snippet") or item.get("title") or "").lower()
        if "billion" in snippet or "bn" in snippet:
            return WEB_UPPER_GBP
    if bag.has_external:
        return WEB_UPPER_GBP
    return None


def patch_orient_web_tier(
    spec: AnswerSpec,
    bag: EvidenceBag | None,
    stats: J1T1CorpusStats | None,
) -> AnswerSpec:
    if stats is None:
        return spec
    if spec.instrument is None or spec.instrument.recipe != "IncommensurableMagnitudes":
        return spec

    dual = bag is not None and bag.lane_mode == "dual"
    has_web = bag is not None and bag.has_external
    if not dual and not has_web:
        return spec

    upper_gbp = _web_upper_from_bag(bag) if bag and has_web else WEB_UPPER_GBP
    data = dict(spec.instrument.data or {})
    upper = dict(data.get("upper") or {})
    upper.update(
        {
            "label": upper.get("label") or "National programme (web)",
            "display": format_gbp_compact(upper_gbp, approximate=True),
            "source": "web",
            "note": (
                f"Parallel web lane · {len(bag.external) if bag and has_web else 0} source(s) · "
                "TDNS-scale candidate"
            ),
        },
    )
    data["upper"] = upper
    data["ratioLabel"] = _format_ratio(upper_gbp, stats.funding_sum)
    data["ratioNote"] = "three orders of magnitude — web lane active"

    honesty = spec.instrument.honesty
    return spec.model_copy(
        update={
            "instrument": spec.instrument.model_copy(
                update={
                    "data": data,
                    "honesty": honesty.model_copy(
                        update={"label": "axis compressed · web tier borrowed"}
                    )
                    if honesty
                    else None,
                },
            ),
        },
    )
