"""Trust model v2 type vocabulary."""

from __future__ import annotations

from typing import Literal

EvidenceLane = Literal["corpus", "web", "declared", "research", "user_file"]
ValidationStatus = Literal["verified", "candidate", "contested", "absent", "declined"]
ConfidenceTier = Literal["Speculative", "Indicative", "Supported", "Robust"]

# Legacy material map (backward compat for merge + gate)
Material = Literal["owned", "borrowed", "inferred", "absent", "declared"]


def material_from_lane(
    lane: EvidenceLane,
    validation_status: ValidationStatus,
) -> Material:
    if lane == "declared":
        return "declared"
    if validation_status in ("absent", "declined"):
        return "absent"
    if lane == "corpus" and validation_status in ("verified", "contested"):
        return "owned"
    if lane in ("web", "research", "user_file"):
        return "borrowed"
    return "inferred"
