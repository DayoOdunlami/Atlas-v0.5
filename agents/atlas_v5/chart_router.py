"""Chart type selection — data-to-viz rules encoded for Atlas v5."""

from __future__ import annotations

import re
from typing import Literal

ChartKind = Literal["bar", "line", "pie", "network"]

_TIME_RE = re.compile(r"\b(over time|trend|timeline|year|monthly|since 20)\b", re.I)
_DIST_RE = re.compile(
    r"\b(distribution|histogram|spread|breakdown|composition|share|proportion|"
    r"by funder|by theme|by mode|funding by)\b",
    re.I,
)
_NETWORK_RE = re.compile(r"\b(network|graph|supply chain|ecosystem map)\b", re.I)
_COMPARE_RE = re.compile(r"\b(compare|versus|vs\.?|rank|top \d+)\b", re.I)


def select_chart_kind(query: str, *, outcome: str = "orient") -> ChartKind | None:
    q = query.strip()
    if _NETWORK_RE.search(q) or outcome == "connect":
        return "network"
    if _TIME_RE.search(q):
        return "line"
    if _DIST_RE.search(q) or _COMPARE_RE.search(q):
        return "bar"
    return None
