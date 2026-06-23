"""Scale policies — geometry is code, not model prose."""

from __future__ import annotations

import math
from dataclasses import dataclass

from agents.atlas_v5.keyed_figures import KeyedFigureIndex

MAX_BAR_PX = 320
REFUSE_RATIO = 1000.0


@dataclass
class ScaleResult:
    pixels: int | None
    honesty_label: str
    refused: bool = False


def apply_scale_policy(
    policy: str,
    key: str,
    index: KeyedFigureIndex,
    *,
    peer_key: str | None = None,
) -> ScaleResult:
    fig = index.get(key)
    if fig is None:
        return ScaleResult(None, f"unknown key {key}", refused=True)

    value = float(fig.value) if isinstance(fig.value, (int, float)) else 0.0
    peer_val: float | None = None
    if peer_key:
        peer = index.get(peer_key)
        if peer and isinstance(peer.value, (int, float)):
            peer_val = float(peer.value)

    if policy == "refuse_to_scale_v1":
        return ScaleResult(None, "layout only — not to scale", refused=True)

    if policy == "linear_bar_v1":
        if value <= 0:
            return ScaleResult(0, "zero value", refused=True)
        px = min(MAX_BAR_PX, max(8, int(value / max(value, 1) * MAX_BAR_PX)))
        if peer_val and peer_val > 0:
            px = min(MAX_BAR_PX, max(8, int((value / peer_val) * MAX_BAR_PX)))
        return ScaleResult(px, "linear_bar_v1", refused=False)

    if policy == "compressed_bar_v1":
        if value <= 0:
            return ScaleResult(0, "zero value", refused=True)
        if peer_val and peer_val > 0:
            ratio = peer_val / value
            if ratio >= REFUSE_RATIO:
                return ScaleResult(
                    None,
                    "axis compressed at the gap — ratio too extreme for faithful scale",
                    refused=True,
                )
            log_ratio = math.log10(max(ratio, 1.01))
            px = min(MAX_BAR_PX, max(12, int(MAX_BAR_PX * (1.0 / (1.0 + log_ratio)))))
            return ScaleResult(px, "compressed_bar_v1", refused=False)
        px = min(MAX_BAR_PX, max(12, int(math.sqrt(value) / 1000)))
        return ScaleResult(px, "compressed_bar_v1 (single value)", refused=False)

    return ScaleResult(None, f"unknown policy {policy}", refused=True)
