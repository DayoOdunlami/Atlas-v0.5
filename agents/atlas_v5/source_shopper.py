"""
Source shopper — light-model shopping list before wide_pass fetch (Increment 1A).

Markets are fixed (corpus + web always run). Output carries weights and sub-queries
per aisle only — no field to skip a lane (gate-safe by schema).
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

logger = logging.getLogger(__name__)

ReconcileLead = Literal["corpus", "web", "research", "balanced"]
OutcomeMode = Literal[
    "orient", "connect", "diagnose", "act", "defend", "find_path"
]

_SHOPPER_CACHE: dict[str, dict[str, Any]] = {}


class CorpusAisleShopModel(BaseModel):
    """Corpus sub-aisles — weights only, both always fetched with floor limits."""

    projects_weight: float = Field(ge=0.05, le=1.0)
    documents_weight: float = Field(ge=0.05, le=1.0)
    sub_queries: list[str] = Field(default_factory=list, max_length=4)


class WebAisleShopModel(BaseModel):
    """Web sub-aisles — GovUK + Exa profiles always invoked with scaled limits."""

    govuk_weight: float = Field(ge=0.05, le=1.0)
    funders_weight: float = Field(ge=0.05, le=1.0)
    partners_weight: float = Field(ge=0.05, le=1.0)
    programmes_weight: float = Field(ge=0.05, le=1.0)
    sub_queries: list[str] = Field(default_factory=list, max_length=6)
    exa_scopes: list[str] = Field(
        default_factory=list,
        max_length=4,
        description="Exa query templates; may include {query} placeholder",
    )


class ResearchAisleShopModel(BaseModel):
    """Research sub-aisle — OpenAlex always invoked when research lane enabled."""

    openalex_weight: float = Field(ge=0.05, le=1.0)
    sub_queries: list[str] = Field(default_factory=list, max_length=4)


class ShoppingListModel(BaseModel):
    """Per-lane shopping list — no lane-set / skip field exists."""

    reconcile_lead: ReconcileLead = "balanced"
    corpus: CorpusAisleShopModel
    web: WebAisleShopModel
    research: ResearchAisleShopModel
    reasoning: str = ""

    @model_validator(mode="after")
    def _all_lanes_present(self) -> "ShoppingListModel":
        if self.corpus is None or self.web is None or self.research is None:
            raise ValueError("corpus, web, and research aisles required")
        return self


@dataclass
class ShoppingList:
    outcome: str
    reconcile_lead: ReconcileLead
    corpus: CorpusAisleShopModel
    web: WebAisleShopModel
    research: ResearchAisleShopModel
    source: Literal["floor", "shopper"] = "floor"
    reasoning: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "outcome": self.outcome,
            "reconcile_lead": self.reconcile_lead,
            "source": self.source,
            "reasoning": self.reasoning,
            "corpus": self.corpus.model_dump(),
            "web": self.web.model_dump(),
            "research": self.research.model_dump(),
        }

    @classmethod
    def from_model(cls, outcome: str, model: ShoppingListModel, *, source: str) -> "ShoppingList":
        return cls(
            outcome=outcome,
            reconcile_lead=model.reconcile_lead,
            corpus=model.corpus,
            web=model.web,
            research=model.research,
            source=source,  # type: ignore[arg-type]
            reasoning=model.reasoning,
        )


def _cache_key(query: str, outcome: str) -> str:
    return f"{outcome}::{query.strip().lower()[:240]}"


def shopper_cache_enabled() -> bool:
    return os.getenv("ATLAS_V5_SHOPPER_CACHE", "0").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def clear_shopper_cache() -> None:
    _SHOPPER_CACHE.clear()


def _clamp01(v: float) -> float:
    return max(0.05, min(1.0, float(v)))


def _research_aisle(query: str, outcome: OutcomeMode, *, weight: float = 0.2) -> ResearchAisleShopModel:
    q = query.strip() or "transport innovation UK"
    if outcome in ("diagnose", "defend"):
        weight = max(weight, 0.35)
    elif outcome == "find_path":
        weight = 0.15
    return ResearchAisleShopModel(
        openalex_weight=_clamp01(weight),
        sub_queries=[q[:160], f"{q} academic literature UK transport"][:2],
    )


def floor_shopping_list(query: str, outcome: str) -> ShoppingList:
    """Deterministic per-mode floor — always available (no API key / shopper fail)."""
    from agents.atlas_v5.trust.lane_relevance import is_research_led_query

    q = query.strip() or "transport innovation UK"
    mode: OutcomeMode = outcome if outcome in (
        "orient",
        "connect",
        "diagnose",
        "act",
        "defend",
        "find_path",
    ) else "orient"

    if is_research_led_query(q):
        corpus = CorpusAisleShopModel(
            projects_weight=0.15,
            documents_weight=0.20,
            sub_queries=[q[:160]],
        )
        web = WebAisleShopModel(
            govuk_weight=0.35,
            funders_weight=0.15,
            partners_weight=0.15,
            programmes_weight=0.25,
            sub_queries=[q[:160], f"{q} UK transport policy evidence"],
            exa_scopes=["{query} academic climate transport research UK"],
        )
        research = ResearchAisleShopModel(
            openalex_weight=0.85,
            sub_queries=[q[:160], f"{q} academic literature transport climate"],
        )
        return ShoppingList(
            outcome=mode,
            reconcile_lead="research",
            corpus=corpus,
            web=web,
            research=research,
            source="floor",
            reasoning="research-led floor: OpenAlex primary; corpus consulted at low weight",
        )

    from agents.atlas_v5.intent import is_strategy_alignment_query

    if is_strategy_alignment_query(q):
        corpus = CorpusAisleShopModel(
            projects_weight=0.25,
            documents_weight=0.75,
            sub_queries=[
                q[:160],
                "DfT Better Connected integrated transport strategy priorities",
                "Innovate UK strategic delivery plan innovation ecosystem",
            ],
        )
        web = WebAisleShopModel(
            govuk_weight=0.45,
            funders_weight=0.30,
            partners_weight=0.15,
            programmes_weight=0.35,
            sub_queries=[
                q[:160],
                "Better Connected integrated transport strategy UK",
                "Innovate UK strategic delivery plan 2022 2025",
            ],
            exa_scopes=[
                "{query} UK government transport strategy alignment",
                "{query} Innovate UK strategic delivery plan",
            ],
        )
        return ShoppingList(
            outcome=mode,
            reconcile_lead="balanced",
            corpus=corpus,
            web=web,
            research=_research_aisle(q, mode, weight=0.35),
            source="floor",
            reasoning="strategy alignment floor: KB documents + policy web weighted",
        )

    if mode == "find_path":
        corpus = CorpusAisleShopModel(
            projects_weight=0.25,
            documents_weight=0.75,
            sub_queries=[q[:160]],
        )
        web = WebAisleShopModel(
            govuk_weight=0.15,
            funders_weight=0.45,
            partners_weight=0.30,
            programmes_weight=0.35,
            sub_queries=[
                f"{q} innovate uk funding SME grant",
                f"{q} transport innovation partner UK",
            ],
            exa_scopes=[
                "{query} innovate uk funding call UK transport",
                "{query} SME transport innovation partner accelerator",
            ],
        )
        lead = "web"
        reasoning = "find_path floor: documents + funders/partners; GovUK minimal"
        research = _research_aisle(q, mode, weight=0.15)
    elif mode in ("connect", "act"):
        corpus = CorpusAisleShopModel(
            projects_weight=0.65,
            documents_weight=0.35,
            sub_queries=[q[:160], f"{q} funding UK transport"],
        )
        web = WebAisleShopModel(
            govuk_weight=0.20,
            funders_weight=0.45,
            partners_weight=0.35,
            programmes_weight=0.30,
            sub_queries=[q[:160], f"{q} innovate uk funding call"],
            exa_scopes=[
                "{query} innovate uk funding call UK",
                "{query} transport innovation partner programme",
            ],
        )
        lead = "balanced"
        reasoning = f"{mode} floor: opportunities + partners weighted"
        research = _research_aisle(q, mode, weight=0.2)
    elif mode in ("diagnose", "defend"):
        corpus = CorpusAisleShopModel(
            projects_weight=0.45,
            documents_weight=0.55,
            sub_queries=[q[:160]],
        )
        web = WebAisleShopModel(
            govuk_weight=0.40,
            funders_weight=0.25,
            partners_weight=0.20,
            programmes_weight=0.35,
            sub_queries=[q[:160], f"{q} UK government transport policy"],
            exa_scopes=[
                "{query} UK government transport policy guidance",
                "{query} programme evaluation evidence",
            ],
        )
        lead = "balanced"
        reasoning = f"{mode} floor: policy + document evidence"
        research = _research_aisle(q, mode, weight=0.4)
    else:  # orient
        corpus = CorpusAisleShopModel(
            projects_weight=0.75,
            documents_weight=0.25,
            sub_queries=[q[:160]],
        )
        web = WebAisleShopModel(
            govuk_weight=0.55,
            funders_weight=0.20,
            partners_weight=0.15,
            programmes_weight=0.40,
            sub_queries=[q[:160], f"{q} UK government transport policy"],
            exa_scopes=[
                "{query} site:gov.uk transport policy",
                "{query} UK transport programme strategy",
            ],
        )
        lead = "corpus"
        reasoning = "orient floor: project rows + GovUK policy emphasis"
        research = _research_aisle(q, mode, weight=0.2)

    return ShoppingList(
        outcome=mode,
        reconcile_lead=lead,
        corpus=corpus,
        web=web,
        research=research,
        source="floor",
        reasoning=reasoning,
    )


def _merge_with_floor(floor: ShoppingList, refined: ShoppingListModel) -> ShoppingList:
    """Shopper refines weights within bounds; floor guarantees minimum fetch shape."""
    merged_corpus = CorpusAisleShopModel(
        projects_weight=_clamp01(refined.corpus.projects_weight),
        documents_weight=_clamp01(refined.corpus.documents_weight),
        sub_queries=(refined.corpus.sub_queries or floor.corpus.sub_queries)[:4],
    )
    merged_web = WebAisleShopModel(
        govuk_weight=_clamp01(refined.web.govuk_weight),
        funders_weight=_clamp01(refined.web.funders_weight),
        partners_weight=_clamp01(refined.web.partners_weight),
        programmes_weight=_clamp01(refined.web.programmes_weight),
        sub_queries=(refined.web.sub_queries or floor.web.sub_queries)[:6],
        exa_scopes=(refined.web.exa_scopes or floor.web.exa_scopes)[:4],
    )
    merged_research = ResearchAisleShopModel(
        openalex_weight=_clamp01(refined.research.openalex_weight),
        sub_queries=(refined.research.sub_queries or floor.research.sub_queries)[:4],
    )
    return ShoppingList(
        outcome=floor.outcome,
        reconcile_lead=refined.reconcile_lead,
        corpus=merged_corpus,
        web=merged_web,
        research=merged_research,
        source="shopper",
        reasoning=refined.reasoning or floor.reasoning,
    )


def _shopper_sync(query: str, outcome: str, floor: ShoppingList) -> ShoppingList | None:
    key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not key:
        return None
    try:
        from langchain_anthropic import ChatAnthropic
        from langchain_core.messages import HumanMessage, SystemMessage

        model = os.getenv("INTENT_MODEL_NAME", "claude-haiku-4-5")
        llm = ChatAnthropic(model=model, api_key=key, max_tokens=800, temperature=0.2)
        structured = llm.with_structured_output(ShoppingListModel)
        system = (
            "You are the Atlas source shopper. Set per-lane weights and sub-queries only. "
            "Corpus, web, and research must remain populated — adjust weights, never omit a lane. "
            "corpus has projects_weight + documents_weight; web has govuk/funders/partners/programmes; "
            "research has openalex_weight + sub_queries. "
            "reconcile_lead is corpus | web | research | balanced for narrative prominence only."
        )
        user = (
            f"Query: {query}\nOutcome mode: {outcome}\n"
            f"Floor profile JSON:\n{json.dumps(floor.to_dict(), indent=2)}\n"
            "Refine the shopping list for this specific question."
        )
        result = structured.invoke(
            [SystemMessage(content=system), HumanMessage(content=user)],
        )
        if isinstance(result, ShoppingListModel):
            return _merge_with_floor(floor, result)
    except Exception as exc:
        logger.warning("source shopper failed, using floor: %s", exc)
    return None


def build_shopping_list(query: str, outcome: str) -> ShoppingList:
    """Floor always; optional shopper refinement; eval cache when enabled."""
    mode = outcome if outcome in (
        "orient",
        "connect",
        "diagnose",
        "act",
        "defend",
        "find_path",
    ) else "orient"
    ck = _cache_key(query, mode)
    if shopper_cache_enabled() and ck in _SHOPPER_CACHE:
        raw = _SHOPPER_CACHE[ck]
        model = ShoppingListModel.model_validate(raw)
        return ShoppingList.from_model(mode, model, source=raw.get("source", "floor"))

    floor = floor_shopping_list(query, mode)
    refined = _shopper_sync(query, mode, floor)
    chosen = refined or floor
    if shopper_cache_enabled():
        _SHOPPER_CACHE[ck] = {**chosen.to_dict(), "source": chosen.source}
    return chosen


def corpus_fetch_limits(shop: CorpusAisleShopModel) -> tuple[int, int]:
    """Minimum floor limits scaled by weights — both sub-sources always queried."""
    total = shop.projects_weight + shop.documents_weight
    proj = max(3, min(12, int(round(10 * shop.projects_weight / total))))
    docs = max(2, min(8, int(round(8 * shop.documents_weight / total))))
    return proj, docs


def web_fetch_limits(shop: WebAisleShopModel) -> tuple[int, int]:
    """GovUK and Exa limits — both always run when web lane enabled."""
    gov = max(1, min(5, int(round(5 * shop.govuk_weight))))
    exa = max(2, min(8, int(round(6 * (shop.funders_weight + shop.partners_weight + shop.programmes_weight) / 3))))
    return gov, exa


def research_fetch_limit(shop: ResearchAisleShopModel) -> int:
    return max(1, min(10, int(round(6 * shop.openalex_weight))))


def materialize_exa_queries(query: str, shop: WebAisleShopModel) -> list[str]:
    q = query.strip()
    out: list[str] = []
    for template in shop.exa_scopes or []:
        out.append(template.replace("{query}", q))
    for sub in shop.sub_queries:
        if sub not in out:
            out.append(sub)
    if q and q not in out:
        out.insert(0, q)
    seen: set[str] = set()
    deduped: list[str] = []
    for item in out:
        key = item.strip().lower()
        if key and key not in seen:
            seen.add(key)
            deduped.append(item.strip())
    return deduped[:6]
