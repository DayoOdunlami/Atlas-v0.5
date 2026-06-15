"""
agents.feature_flags
====================

Centralised feature flag reader for Atlas 5 orchestrator rollout.

All flags default OFF so the legacy workbench graph continues to serve
production traffic until each flag is explicitly enabled.

Usage
-----
    from agents.feature_flags import flags

    if flags.orchestrator_v1:
        # use new brain
    else:
        # fall back to legacy workbench graph

Environment variables
---------------------
ATLAS5_ORCHESTRATOR_V1          "true" → route traffic to agents.orchestrator
ATLAS5_VIZ_ART_DIRECTOR_V1      "true" → enable live viz art-director selection
ATLAS5_GENERATIVE_VIZ_V1        "true" → enable generative ECharts / MCP viz
                                          (requires encoding guardrail to be wired)
ATLAS5_FALSIFICATION_LANE_V1    (existing) "true" → enable disconfirming red-team search

Note: ATLAS5_FALSIFICATION_LANE_V1 existed before this module; it is read directly
by agents/spine/falsification.py using os.getenv for backwards compatibility.
"""

from __future__ import annotations

import os


def _is_on(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes")


class _Flags:
    """Read-only feature flag bundle.  Re-reads env on each attribute access
    so that test code can toggle flags with os.environ without restarting."""

    @property
    def orchestrator_v1(self) -> bool:
        """Route workbench traffic to agents.orchestrator instead of the
        legacy agents.workbench.graph hard-router."""
        return _is_on("ATLAS5_ORCHESTRATOR_V1")

    @property
    def viz_art_director_v1(self) -> bool:
        """Enable the live visual art-director selection in agents.registry.viz.
        When False, chart selection falls back to the legacy recipe-director
        heuristic (current behaviour)."""
        return _is_on("ATLAS5_VIZ_ART_DIRECTOR_V1")

    @property
    def generative_viz_v1(self) -> bool:
        """Enable the generative ECharts / MCP visualisation path behind the
        encoding guardrail.  When False, only the curated block/chart library
        is used."""
        return _is_on("ATLAS5_GENERATIVE_VIZ_V1")

    @property
    def falsification_lane_v1(self) -> bool:
        """Enable the disconfirming red-team search (Exa/Tavily).
        Alias for the existing ATLAS5_FALSIFICATION_LANE_V1 env var so callers
        can use the flags bundle rather than raw os.getenv."""
        return _is_on("ATLAS5_FALSIFICATION_LANE_V1")


flags = _Flags()
