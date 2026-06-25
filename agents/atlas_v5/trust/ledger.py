"""Build validated KeyedFigureIndex from wide pass + skeleton."""

from __future__ import annotations

from agents.atlas_v5.j1t1_assembler import WEB_UPPER_GBP
from agents.atlas_v5.keyed_figures import KeyedFigure, KeyedFigureIndex
from agents.atlas_v5.trust.reconcile_v2 import (
    _research_substantive,
    apply_lead_flags,
    detect_conflicts,
    resolve_lead_lane,
)
from agents.atlas_v5.trust.validate_corpus import build_corpus_figures
from agents.atlas_v5.trust.validate_research import build_research_figures
from agents.atlas_v5.trust.validate_web import build_web_figures
from agents.atlas_v5.web_lane import research_lane_enabled
from agents.atlas_v5.wide_pass import WidePassResult
from agents.contracts.answer_spec import AnswerSpec
from agents.orchestrator.retrieval_fabric import EvidenceBag


def _corpus_only_lane(wide: WidePassResult) -> bool:
    meta = wide.retrieval_meta or {}
    if meta.get("lane_mode") == "corpus_only":
        return True
    return bool(meta.get("external_skipped"))


def _corpus_substantive(bag: EvidenceBag | None, *, has_stats: bool) -> bool:
    if has_stats:
        return True
    if bag is None:
        return False
    if bag.project_hit_count >= 2:
        return True
    if bag.document_hit_count >= 2:
        return True
    return False


def _web_substantive(bag: EvidenceBag | None) -> bool:
    if bag is None:
        return False
    if len(bag.external) >= 2:
        return True
    if len(bag.external) >= 1 and len(bag.candidates) >= 1:
        return True
    return False


def build_trust_ledger(wide: WidePassResult, skeleton: AnswerSpec) -> KeyedFigureIndex:
    """Validated ledger — corpus + web figures with lane + validation_status."""
    external_skipped = _corpus_only_lane(wide)
    bag = wide.evidence_bag

    index = KeyedFigureIndex(
        lane_mode=str(wide.retrieval_meta.get("lane_mode", "corpus_only")),
        external_skipped=external_skipped,
    )

    index.figures.update(build_corpus_figures(wide.stats, skeleton))

    meta = wide.retrieval_meta or {}
    index.figures["retrieval.external_count"] = KeyedFigure(
        key="retrieval.external_count",
        value=int(meta.get("external_count", 0)),
        unit="count",
        material="owned",
        provenance="retrieval fabric meta",
        lane="corpus",
        validation_status="verified",
        confidence_tier="Indicative",
        source_refs=[],
    )
    index.figures["retrieval.candidate_count"] = KeyedFigure(
        key="retrieval.candidate_count",
        value=int(meta.get("candidate_count", 0)),
        unit="count",
        material="owned",
        provenance="retrieval fabric meta",
        lane="corpus",
        validation_status="verified",
        confidence_tier="Indicative",
        source_refs=[],
    )

    if wide.graph:
        index.figures["graph.node_count"] = KeyedFigure(
            key="graph.node_count",
            value=len(wide.graph.nodes),
            unit="count",
            material="owned",
            provenance="connect network graph",
            lane="corpus",
            validation_status="verified",
            confidence_tier="Indicative",
            source_refs=[],
        )
        index.figures["graph.edge_count"] = KeyedFigure(
            key="graph.edge_count",
            value=len(wide.graph.edges),
            unit="count",
            material="owned",
            provenance="connect network graph",
            lane="corpus",
            validation_status="verified",
            confidence_tier="Indicative",
            source_refs=[],
        )

    if external_skipped:
        index.web_keys_absent_reason = (
            "web.* keys absent (web lane disabled); do not fabricate web figures"
        )
    else:
        index.figures.update(build_web_figures(bag, external_skipped=False))
        if not index.get("web.programme_total_gbp"):
            index.figures["web.programme_upper_gbp"] = KeyedFigure(
                key="web.programme_upper_gbp",
                value=WEB_UPPER_GBP,
                unit="gbp",
                material="borrowed",
                provenance="programme-scale context (TDNS candidate)",
                lane="web",
                validation_status="candidate",
                confidence_tier="Indicative",
                source_refs=[],
            )
        ext_count = len(bag.external) if bag else 0
        if ext_count == 0 and not index.get("web.programme_total_gbp"):
            index.web_keys_absent_reason = (
                "dual lane ran but web returned 0 sources — use corpus + honest gap label"
            )

    if research_lane_enabled():
        snapshot = bag.research_snapshot if bag else None
        index.figures.update(build_research_figures(snapshot))
        if snapshot is None and not index.get("research.work_count"):
            index.research_keys_absent_reason = (
                "research lane ran but OpenAlex returned no works — honest absent label"
            )
    else:
        index.research_keys_absent_reason = (
            "research.* absent — set ATLAS_V5_RESEARCH_LANE=1 to enable OpenAlex lane"
        )

    corpus_sub = _corpus_substantive(bag, has_stats=wide.stats is not None)
    web_sub = _web_substantive(bag)
    research_sub = _research_substantive(bag)

    lead_lane = resolve_lead_lane(
        wide.query or skeleton.query or "",
        shopping=wide.shopping_list,
        corpus_substantive=corpus_sub,
        web_substantive=web_sub,
        index=index,
        research_substantive=research_sub,
    )
    if skeleton.reconciliation and skeleton.reconciliation.retrieval:
        stored = skeleton.reconciliation.retrieval.lead_lane
        if stored:
            lead_lane = stored

    index.lead_lane = lead_lane
    index.conflict_keys = detect_conflicts(index)
    apply_lead_flags(index, lead_lane)

    index.validation_summary = {
        "lead_lane": lead_lane,
        "conflicts": index.conflict_keys,
        "corpus_figures": sum(1 for f in index.figures.values() if f.lane == "corpus"),
        "web_figures": sum(1 for f in index.figures.values() if f.lane == "web"),
        "research_figures": sum(1 for f in index.figures.values() if f.lane == "research"),
        "verified": sum(1 for f in index.figures.values() if f.validation_status == "verified"),
        "contested": sum(1 for f in index.figures.values() if f.validation_status == "contested"),
    }

    return index
