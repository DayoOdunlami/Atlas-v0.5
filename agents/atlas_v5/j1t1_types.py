"""Atlas v5 — J1T1 corpus types (brain / GATE 2)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class FunderBreakdownRow:
    lead_funder: str
    project_count: int
    null_funding_count: int
    funding_sum: float


@dataclass
class ModeThemeRow:
    mode: str
    theme: str
    project_count: int


@dataclass
class StartYearRow:
    year: int
    project_count: int


@dataclass
class J1T1CorpusStats:
    project_count: int
    funding_sum: float
    null_funding_count: int
    funded_row_count: int
    org_count: int
    live_since_2024: int
    funders: list[FunderBreakdownRow] = field(default_factory=list)
    mode_themes: list[ModeThemeRow] = field(default_factory=list)
    start_years: list[StartYearRow] = field(default_factory=list)
    top_citations: list[dict[str, Any]] = field(default_factory=list)
    queried_at: str = ""
