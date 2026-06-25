"""Deterministic keyed figure index for composition merge + gate."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from agents.atlas_v5.j1t1_assembler import format_gbp_compact
from agents.atlas_v5.wide_pass import WidePassResult
from agents.contracts.answer_spec import AnswerSpec

Material = Literal["owned", "borrowed", "inferred", "absent", "declared"]
FigureUnit = Literal["count", "gbp", "ratio", "id", "text"]
EvidenceLane = Literal["corpus", "web", "declared", "research", "user_file"]
ValidationStatus = Literal["verified", "candidate", "contested", "absent", "declined"]
ConfidenceTier = Literal["Speculative", "Indicative", "Supported", "Robust"]


@dataclass
class KeyedFigure:
    key: str
    value: float | int | str
    unit: FigureUnit
    material: Material
    provenance: str
    floor: bool = False
    lane: EvidenceLane = "corpus"
    validation_status: ValidationStatus = "verified"
    confidence_tier: ConfidenceTier = "Indicative"
    source_refs: list[str] = field(default_factory=list)
    reconciles_with: list[str] | None = None
    lead_for_question: bool = False


@dataclass
class KeyedFigureIndex:
    figures: dict[str, KeyedFigure] = field(default_factory=dict)
    lane_mode: str = "corpus_only"
    external_skipped: bool = True
    web_keys_absent_reason: str | None = None
    research_keys_absent_reason: str | None = None
    lead_lane: str = "balanced"
    conflict_keys: list[str] = field(default_factory=list)
    validation_summary: dict[str, Any] = field(default_factory=dict)

    def get(self, key: str) -> KeyedFigure | None:
        return self.figures.get(key)

    def keys(self) -> list[str]:
        return sorted(self.figures.keys())

    def figures_for_lane(self, lane: EvidenceLane) -> list[KeyedFigure]:
        return [f for f in self.figures.values() if f.lane == lane]

    def validated_figures(self, *, lanes: list[EvidenceLane] | None = None) -> list[KeyedFigure]:
        allowed = set(lanes) if lanes else None
        out: list[KeyedFigure] = []
        for fig in self.figures.values():
            if allowed and fig.lane not in allowed:
                continue
            if fig.validation_status in ("verified", "candidate", "contested"):
                out.append(fig)
        return out

    def as_merge_dict(self) -> dict[str, str]:
        out: dict[str, str] = {}
        for k, fig in self.figures.items():
            if fig.validation_status in ("absent", "declined"):
                continue
            if fig.unit == "gbp" and isinstance(fig.value, (int, float)):
                approximate = fig.lane == "web" or fig.material == "borrowed"
                out[k] = format_gbp_compact(float(fig.value), approximate=approximate)
            elif fig.unit == "count" and isinstance(fig.value, (int, float)):
                out[k] = str(int(fig.value))
            else:
                out[k] = str(fig.value)
        return out


def build_keyed_index(wide: WidePassResult, skeleton: AnswerSpec) -> KeyedFigureIndex:
    """Build validated trust ledger (v2). Same wide + skeleton → same keys."""
    from agents.atlas_v5.trust.ledger import build_trust_ledger

    return build_trust_ledger(wide, skeleton)
