"""Inspect wide-pass + AnswerSpec data shapes for visual selection."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from agents.atlas_v5.j1t1_types import J1T1CorpusStats
from agents.atlas_v5.keyed_figures import KeyedFigureIndex
from agents.atlas_v5.wide_pass import WidePassResult
from agents.contracts.answer_spec import AnswerSpec


@dataclass
class DataProfile:
    project_count: int = 0
    funder_count: int = 0
    funded_funder_count: int = 0
    org_count: int = 0
    null_funding_count: int = 0
    null_funding_ratio: float = 0.0
    citation_count: int = 0
    flow_link_count: int = 0
    has_funder_breakdown: bool = False
    has_evidence_matrix: bool = False
    has_flow_data: bool = False
    has_web_programme: bool = False
    has_scale_conflict: bool = False
    has_temporal_series: bool = False
    has_theme_breakdown: bool = False
    temporal_year_count: int = 0
    theme_pair_count: int = 0
    web_verified_count: int = 0
    lead_lane: str = "balanced"
    is_sparse: bool = True
    tier: str = "Indicative"
    outcome: str = "orient"
    query: str = ""


def _citations_as_dicts(wide: WidePassResult, spec: AnswerSpec) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for hit in wide.corpus_hits:
        if isinstance(hit, dict):
            rows.append(hit)
    for cite in spec.corpus_citations:
        rows.append(
            {
                "id": cite.id,
                "title": cite.title,
                "score": cite.score,
                "organisation": cite.organisation,
                "source_type": cite.source_type or "project",
            }
        )
    for web in spec.web_evidence:
        rows.append(
            {
                "id": web.id,
                "title": web.title,
                "score": 0.75 if web.verification_state == "verified" else 0.5,
                "organisation": web.publisher,
                "source_type": "live_call" if web.verification_state == "verified" else "web_doc",
                "url": web.url,
            }
        )
    if wide.evidence_bag:
        for item in wide.evidence_bag.external:
            if isinstance(item, dict):
                rows.append({**item, "source_type": item.get("source_type") or "web_doc"})
    return rows


def _count_sankey_flows(citations: list[dict[str, Any]]) -> int:
    flow: dict[tuple[str, str], int] = {}
    for c in citations:
        st = c.get("source_type") or "project"
        if st in ("live_call", "web_doc"):
            label = str(c.get("publisher") or c.get("funder") or c.get("title") or "Web source")[:30]
            if label:
                key = (label, "Web / live sources")
                flow[key] = flow.get(key, 0) + 1
        elif st == "project":
            org = str(c.get("organisation") or c.get("lead_org_name") or "").strip()[:30]
            if org:
                key = (org, "Corpus projects")
                flow[key] = flow.get(key, 0) + 1
        elif st in ("cpc_internal", "cpc_claim"):
            bu = str(c.get("business_unit") or c.get("organisation") or "CPC internal").strip()[:30]
            key = (bu, "CPC capability evidence")
            flow[key] = flow.get(key, 0) + 1
    return len(flow)


def build_data_profile(
    wide: WidePassResult,
    spec: AnswerSpec,
    *,
    query: str = "",
    index: KeyedFigureIndex | None = None,
) -> DataProfile:
    stats = wide.stats
    citations = _citations_as_dicts(wide, spec)
    profile = DataProfile(
        tier=spec.tier,
        outcome=wide.outcome,
        query=query or wide.query,
        citation_count=len(citations),
    )

    if index:
        profile.lead_lane = index.lead_lane
        profile.has_scale_conflict = bool(index.conflict_keys)
        prog = index.get("web.programme_total_gbp") or index.get("web.programme_upper_gbp")
        profile.has_web_programme = prog is not None and prog.validation_status != "absent"
        profile.web_verified_count = sum(
            1 for f in index.figures_for_lane("web") if f.validation_status == "verified"
        )

    if stats is None:
        profile.is_sparse = profile.citation_count < 3
        profile.has_evidence_matrix = profile.citation_count >= 4
        profile.flow_link_count = _count_sankey_flows(citations)
        profile.has_flow_data = profile.flow_link_count >= 3
        return profile

    profile.project_count = stats.project_count
    profile.null_funding_count = stats.null_funding_count
    profile.org_count = stats.org_count
    profile.funder_count = len(stats.funders)
    profile.funded_funder_count = sum(1 for f in stats.funders if f.funding_sum > 0)
    profile.has_funder_breakdown = profile.funder_count >= 2
    if stats.project_count > 0:
        profile.null_funding_ratio = stats.null_funding_count / stats.project_count
    profile.temporal_year_count = len(stats.start_years)
    profile.has_temporal_series = profile.temporal_year_count >= 3
    profile.theme_pair_count = len(stats.mode_themes)
    profile.has_theme_breakdown = profile.theme_pair_count >= 3
    profile.is_sparse = stats.project_count < 2
    profile.has_evidence_matrix = len(citations) >= 4
    profile.flow_link_count = _count_sankey_flows(citations)
    profile.has_flow_data = profile.flow_link_count >= 3
    return profile
