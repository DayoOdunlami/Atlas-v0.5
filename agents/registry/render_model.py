"""
agents.registry.render_model
=============================

buildAtlasRenderModel — keystone constructor for the AtlasRenderModel dict.

This is the single authoritative way to create an AtlasRenderModel.  Every
node in the orchestrator graph that produces a final artifact calls this
function.  The format pass (D1.4) then selects blocks and renders mode.

AtlasRenderModel contract (from ATLAS5_BRAIN_ADR.md §4):
---------------------------------------------------------
    type:               'brief' | 'evidence' | 'chart'
    outcome:            'orient' | 'connect' | 'diagnose' | 'act' | 'defend'
    headline:           str  (≥15 chars)
    insight_card:       str  (summary paragraph, ≥20 chars)
    sections:           dict[str, str]
    corpus_citations:   list[CitationRecord]   real atlas.projects.id UUIDs
    hive_citations:     list[HiveCitation]     real hive.articles.id UUIDs
    confidence_tier:    'Speculative' | 'Indicative' | 'Supported' | 'Robust'
    chart_spec:         list[dict] | None
    blocks:             list[BlockData]   populated by format pass (D1.4)
    canonical_question_id: str | None
    thread_id:          str | None
    query:              str   (original user query)
    effort:             str   (triage bucket: clarify|refine|analyze|deep)
    recipe:             str   (viz recipe selected)
    --- trust spine outputs (populated by verify_spine, D1.3) ---
    citation_guard:     dict | None
    falsification:      dict | None
    artifact_qa:        dict | None
"""
from __future__ import annotations

from typing import Any, Literal

Outcome = Literal["orient", "connect", "diagnose", "act", "defend"]
ArtifactType = Literal["brief", "evidence", "chart"]
ConfidenceTier = Literal["Speculative", "Indicative", "Supported", "Robust"]
EffortBucket = Literal["clarify", "refine", "analyze", "deep"]


def build_atlas_render_model(
    *,
    outcome: Outcome,
    headline: str,
    insight_card: str,
    sections: dict[str, str] | None = None,
    corpus_citations: list[dict[str, Any]] | None = None,
    hive_citations: list[dict[str, Any]] | None = None,
    confidence_tier: ConfidenceTier = "Speculative",
    chart_spec: list[dict[str, Any]] | None = None,
    artifact_type: ArtifactType = "brief",
    canonical_question_id: str | None = None,
    thread_id: str | None = None,
    query: str = "",
    effort: EffortBucket = "analyze",
    recipe: str = "",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Construct a validated AtlasRenderModel dict.

    Parameters
    ----------
    outcome             One of the five canonical outcomes (ADR §3).
    headline            Lead headline (≥15 chars recommended).
    insight_card        Summary paragraph (≥20 chars recommended).
    sections            Arbitrary section text keyed by section name.
    corpus_citations    atlas.projects citations (verified UUIDs only).
    hive_citations      hive.articles citations (verified UUIDs only).
    confidence_tier     Must be aligned with citation count before passing
                        to the trust spine (citation_guard will cap it).
    chart_spec          Optional list of chart spec dicts (from registry.viz).
    artifact_type       'brief' | 'evidence' | 'chart'.
    canonical_question_id  CQ taxonomy ID if known.
    thread_id           LangGraph thread ID.
    query               Original user query (for falsification and logging).
    effort              Triage effort bucket.
    recipe              Viz recipe name (from registry.viz.select_recipe).
    extra               Any additional fields to merge in (for future expansion).

    Returns
    -------
    dict  conforming to the AtlasRenderModel contract.
    """
    model: dict[str, Any] = {
        "type": artifact_type,
        "outcome": outcome,
        "headline": headline,
        "insight_card": insight_card,
        "sections": sections or {},
        "corpus_citations": corpus_citations or [],
        "hive_citations": hive_citations or [],
        "confidence_tier": confidence_tier,
        "chart_spec": chart_spec,
        "blocks": [],
        "canonical_question_id": canonical_question_id,
        "thread_id": thread_id,
        "query": query,
        "effort": effort,
        "recipe": recipe,
        # Trust spine outputs — populated by verify_spine node (D1.3)
        "citation_guard": None,
        "falsification": None,
        "artifact_qa": None,
    }

    if extra:
        model.update(extra)

    return model


def validate_render_model(model: dict[str, Any]) -> list[str]:
    """
    Return a list of validation errors (empty = valid).

    Lightweight structural check — does not verify corpus UUIDs
    (that is the job of the trust spine).
    """
    errors: list[str] = []

    if not model.get("headline") or len(str(model["headline"])) < 5:
        errors.append("headline missing or too short")

    if model.get("confidence_tier") not in ("Speculative", "Indicative", "Supported", "Robust"):
        errors.append(f"invalid confidence_tier: {model.get('confidence_tier')!r}")

    if model.get("outcome") not in ("orient", "connect", "diagnose", "act", "defend"):
        errors.append(f"invalid outcome: {model.get('outcome')!r}")

    if model.get("type") not in ("brief", "evidence", "chart"):
        errors.append(f"invalid type: {model.get('type')!r}")

    return errors
