"""Corpus lane validation — SQL stats + citation depth."""

from __future__ import annotations

from agents.atlas_v5.j1t1_types import J1T1CorpusStats
from agents.atlas_v5.keyed_figures import KeyedFigure
from agents.contracts.answer_spec import AnswerSpec


def _tier_for_corpus(project_count: int, citation_count: int) -> str:
    if project_count >= 10 and citation_count >= 4:
        return "Supported"
    if project_count >= 3 and citation_count >= 2:
        return "Indicative"
    if project_count >= 1:
        return "Speculative"
    return "Speculative"


def build_corpus_figures(
    stats: J1T1CorpusStats | None,
    skeleton: AnswerSpec,
) -> dict[str, KeyedFigure]:
    if stats is None:
        return {}

    citation_count = len(skeleton.corpus_citations)
    tier = _tier_for_corpus(stats.project_count, citation_count)
    refs = [c.id for c in skeleton.corpus_citations[:8]]

    figures: dict[str, KeyedFigure] = {
        "stats.project_count": KeyedFigure(
            key="stats.project_count",
            value=stats.project_count,
            unit="count",
            material="owned",
            provenance="atlas.projects aggregate (SQL)",
            lane="corpus",
            validation_status="verified",
            confidence_tier=tier,
            source_refs=refs,
        ),
        "stats.funding_floor_gbp": KeyedFigure(
            key="stats.funding_floor_gbp",
            value=stats.funding_sum,
            unit="gbp",
            material="owned",
            provenance="atlas.projects funding sum (floor)",
            floor=True,
            lane="corpus",
            validation_status="verified",
            confidence_tier=tier,
            source_refs=refs,
        ),
        "stats.null_funding_count": KeyedFigure(
            key="stats.null_funding_count",
            value=stats.null_funding_count,
            unit="count",
            material="owned",
            provenance="atlas.projects null funding rows",
            lane="corpus",
            validation_status="verified",
            confidence_tier=tier,
            source_refs=refs,
        ),
        "stats.org_count": KeyedFigure(
            key="stats.org_count",
            value=stats.org_count,
            unit="count",
            material="owned",
            provenance="atlas.projects lead organisations",
            lane="corpus",
            validation_status="verified",
            confidence_tier=tier,
            source_refs=refs,
        ),
        "stats.live_since_2024": KeyedFigure(
            key="stats.live_since_2024",
            value=stats.live_since_2024,
            unit="count",
            material="owned",
            provenance="atlas.projects live since 2024",
            lane="corpus",
            validation_status="verified",
            confidence_tier=tier,
            source_refs=refs,
        ),
        "corpus.citation_count": KeyedFigure(
            key="corpus.citation_count",
            value=citation_count,
            unit="count",
            material="owned",
            provenance="skeleton corpus_citations",
            lane="corpus",
            validation_status="verified" if citation_count else "absent",
            confidence_tier=tier,
            source_refs=refs,
        ),
    }
    return figures
