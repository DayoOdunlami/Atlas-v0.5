"""Lead-lane resolution and cross-lane conflict detection."""

from __future__ import annotations

import re

from agents.atlas_v5.keyed_figures import KeyedFigureIndex
from agents.atlas_v5.source_shopper import ReconcileLead, ShoppingList
from agents.orchestrator.retrieval_fabric import EvidenceBag

_PROGRAMME_RE = re.compile(
    r"\b(programme|program|national|scale|billion|TDNS|decarbonisation plan|"
    r"over time|policy|gov\.uk)\b",
    re.I,
)
_CORPUS_SLICE_RE = re.compile(
    r"\b(project|portfolio|funder|corpus|slice|floor|null|EPSRC|Innovate UK)\b",
    re.I,
)
_CONFLICT_RATIO = 50.0


_RESEARCH_RE = re.compile(
    r"\b(literature|academic|research paper|methodology|peer review|openalex|"
    r"evidence base|systematic review|journal)\b",
    re.I,
)


def _research_substantive(bag: EvidenceBag | None) -> bool:
    if bag is None or not bag.research_snapshot:
        return False
    return int(bag.research_snapshot.get("sample_size") or 0) >= 1


def resolve_lead_lane(
    query: str,
    *,
    shopping: ShoppingList | None,
    corpus_substantive: bool,
    web_substantive: bool,
    index: KeyedFigureIndex,
    research_substantive: bool = False,
) -> str:
    """Return lead_lane: corpus | web | research | balanced."""
    lead: ReconcileLead = shopping.reconcile_lead if shopping else "balanced"

    if _RESEARCH_RE.search(query) and research_substantive:
        return "research"
    if lead == "research" and research_substantive:
        return "research"
    if index.conflict_keys and _PROGRAMME_RE.search(query):
        return "web"
    if lead == "web" and web_substantive:
        return "web"
    if lead == "corpus" and corpus_substantive:
        return "corpus"
    if web_substantive and not corpus_substantive:
        return "web"
    if corpus_substantive and not web_substantive:
        return "corpus"
    if _PROGRAMME_RE.search(query) and web_substantive:
        return "web"
    if _CORPUS_SLICE_RE.search(query) and corpus_substantive:
        return "corpus"
    if web_substantive and corpus_substantive:
        return "balanced"
    return "corpus" if corpus_substantive else ("web" if web_substantive else "balanced")


def detect_conflicts(index: KeyedFigureIndex) -> list[str]:
    """Dimensions where validated lanes disagree materially."""
    conflicts: list[str] = []
    floor = index.get("stats.funding_floor_gbp")
    programme = index.get("web.programme_total_gbp") or index.get("web.programme_upper_gbp")

    if not floor or not programme:
        return conflicts

    fv = floor.value
    pv = programme.value
    if not isinstance(fv, (int, float)) or not isinstance(pv, (int, float)):
        return conflicts
    if fv <= 0 or pv <= 0:
        return conflicts

    ratio = pv / fv
    if ratio >= _CONFLICT_RATIO:
        conflicts.append("funding_scale: corpus floor vs web programme magnitude")
        if floor.validation_status == "verified" and programme.validation_status in (
            "verified",
            "candidate",
        ):
            floor.validation_status = "contested"
            programme.validation_status = "contested"
            floor.reconciles_with = list(set((floor.reconciles_with or []) + ["web.programme_total_gbp"]))
            programme.reconciles_with = list(
                set((programme.reconciles_with or []) + ["stats.funding_floor_gbp"])
            )

    return conflicts


def apply_lead_flags(index: KeyedFigureIndex, lead_lane: str) -> None:
    prefix = {
        "corpus": "stats.",
        "web": "web.",
        "research": "research.",
    }.get(lead_lane, "")
    for key, fig in index.figures.items():
        fig.lead_for_question = bool(prefix and key.startswith(prefix))
