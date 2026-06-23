"""Detect when a turn wants a specific visual form (SWOT, journey, charts, etc.)."""

from __future__ import annotations

import re
from typing import Literal

VisualForm = Literal[
    "swot",
    "journey_orient",
    "funder_bar",
    "stat_strip",
    "none",
]

_SWOT_RE = re.compile(
    r"\b(swot|s\.w\.o\.t|strengths?\s+weaknesses?\s+opportunities?\s+threats?)\b",
    re.I,
)

_JOURNEY_ORIENT_RE = re.compile(
    r"\b("
    r"state of play|decarbon|two.?tier|national programme|funding floor|"
    r"corpus|orient|port|shore|maritime|prioriti[sz]e.*decarbon|"
    r"landscape|rail decarb"
    r")\b",
    re.I,
)

_FUNDER_BAR_RE = re.compile(
    r"\b("
    r"funder|funding by|who funds|innovate uk|epsrc|breakdown|distribution|"
    r"composition of funding|grant"
    r")\b",
    re.I,
)


def detect_visual_form(query: str, *, outcome: str = "orient") -> VisualForm:
    q = query.strip()
    if _SWOT_RE.search(q):
        return "swot"
    if _FUNDER_BAR_RE.search(q):
        return "funder_bar"
    if outcome in ("orient", "diagnose") and _JOURNEY_ORIENT_RE.search(q):
        return "journey_orient"
    return "none"


def is_swot_query(query: str) -> bool:
    return detect_visual_form(query) == "swot"


def is_journey_orient_query(query: str, *, outcome: str = "orient") -> bool:
    return detect_visual_form(query, outcome=outcome) == "journey_orient"


def is_funder_bar_query(query: str) -> bool:
    return detect_visual_form(query) == "funder_bar"
