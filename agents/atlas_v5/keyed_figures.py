"""Deterministic keyed figure index for composition merge + gate."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from agents.atlas_v5.j1t1_assembler import WEB_UPPER_GBP, format_gbp_compact
from agents.atlas_v5.wide_pass import WidePassResult
from agents.contracts.answer_spec import AnswerSpec

Material = Literal["owned", "borrowed", "inferred", "absent", "declared"]
FigureUnit = Literal["count", "gbp", "ratio", "id", "text"]


@dataclass
class KeyedFigure:
    key: str
    value: float | int | str
    unit: FigureUnit
    material: Material
    provenance: str
    floor: bool = False


@dataclass
class KeyedFigureIndex:
    figures: dict[str, KeyedFigure] = field(default_factory=dict)
    lane_mode: str = "corpus_only"
    external_skipped: bool = True
    web_keys_absent_reason: str | None = None

    def get(self, key: str) -> KeyedFigure | None:
        return self.figures.get(key)

    def keys(self) -> list[str]:
        return sorted(self.figures.keys())

    def as_merge_dict(self) -> dict[str, str]:
        out: dict[str, str] = {}
        for k, fig in self.figures.items():
            if fig.unit == "gbp" and isinstance(fig.value, (int, float)):
                out[k] = format_gbp_compact(float(fig.value), approximate=fig.material == "borrowed")
            elif fig.unit == "count" and isinstance(fig.value, (int, float)):
                out[k] = str(int(fig.value))
            else:
                out[k] = str(fig.value)
        return out


def _corpus_only_lane(wide: WidePassResult) -> bool:
    meta = wide.retrieval_meta or {}
    if meta.get("lane_mode") == "corpus_only":
        return True
    return bool(meta.get("external_skipped"))


def build_keyed_index(wide: WidePassResult, skeleton: AnswerSpec) -> KeyedFigureIndex:
    """Same wide + skeleton → same keys. web.* omitted under corpus-only lane."""
    index = KeyedFigureIndex(
        lane_mode=str(wide.retrieval_meta.get("lane_mode", "corpus_only")),
        external_skipped=_corpus_only_lane(wide),
    )
    stats = wide.stats
    if stats:
        index.figures["stats.project_count"] = KeyedFigure(
            key="stats.project_count",
            value=stats.project_count,
            unit="count",
            material="owned",
            provenance="atlas.projects aggregate",
        )
        index.figures["stats.funding_floor_gbp"] = KeyedFigure(
            key="stats.funding_floor_gbp",
            value=stats.funding_sum,
            unit="gbp",
            material="owned",
            provenance="atlas.projects funding sum (floor)",
            floor=True,
        )
        index.figures["stats.null_funding_count"] = KeyedFigure(
            key="stats.null_funding_count",
            value=stats.null_funding_count,
            unit="count",
            material="owned",
            provenance="atlas.projects null funding rows",
        )
        index.figures["stats.org_count"] = KeyedFigure(
            key="stats.org_count",
            value=stats.org_count,
            unit="count",
            material="owned",
            provenance="atlas.projects lead organisations",
        )
        index.figures["stats.live_since_2024"] = KeyedFigure(
            key="stats.live_since_2024",
            value=stats.live_since_2024,
            unit="count",
            material="owned",
            provenance="atlas.projects live since 2024",
        )

    index.figures["corpus.citation_count"] = KeyedFigure(
        key="corpus.citation_count",
        value=len(skeleton.corpus_citations),
        unit="count",
        material="owned",
        provenance="skeleton corpus_citations",
    )

    meta = wide.retrieval_meta or {}
    index.figures["retrieval.external_count"] = KeyedFigure(
        key="retrieval.external_count",
        value=int(meta.get("external_count", 0)),
        unit="count",
        material="owned",
        provenance="retrieval fabric meta",
    )
    index.figures["retrieval.candidate_count"] = KeyedFigure(
        key="retrieval.candidate_count",
        value=int(meta.get("candidate_count", 0)),
        unit="count",
        material="owned",
        provenance="retrieval fabric meta",
    )

    if wide.graph:
        index.figures["graph.node_count"] = KeyedFigure(
            key="graph.node_count",
            value=len(wide.graph.nodes),
            unit="count",
            material="owned",
            provenance="connect network graph",
        )
        index.figures["graph.edge_count"] = KeyedFigure(
            key="graph.edge_count",
            value=len(wide.graph.edges),
            unit="count",
            material="owned",
            provenance="connect network graph",
        )

    if index.external_skipped:
        index.web_keys_absent_reason = (
            "web.* keys absent (web lane disabled); do not fabricate web figures"
        )
    elif wide.evidence_bag and wide.evidence_bag.lane_mode == "dual":
        ext_count = len(wide.evidence_bag.external)
        index.figures["web.external_count"] = KeyedFigure(
            key="web.external_count",
            value=ext_count,
            unit="count",
            material="borrowed",
            provenance="parallel web lane (GovUK + Exa)",
        )
        index.figures["web.programme_upper_gbp"] = KeyedFigure(
            key="web.programme_upper_gbp",
            value=WEB_UPPER_GBP,
            unit="gbp",
            material="borrowed",
            provenance="programme-scale context (TDNS candidate)",
        )
        if ext_count == 0:
            index.web_keys_absent_reason = (
                "dual lane ran but web returned 0 sources — use corpus + honest gap label"
            )
    elif skeleton.web_evidence or (wide.evidence_bag and wide.evidence_bag.has_external):
        index.figures["web.programme_upper_gbp"] = KeyedFigure(
            key="web.programme_upper_gbp",
            value=WEB_UPPER_GBP,
            unit="gbp",
            material="borrowed",
            provenance="web context candidate (TDNS programme scale)",
        )

    return index
