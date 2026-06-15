"""
agents.registry.viz
===================

Curated visualisation registry — chart selector and spec builders.

This module is the canonical import point for all viz selection logic.
During D0.4 the implementation lives in agents.visual_recipe_director
(too large to safely move in one step).  The full move happens at D1.4
when the format pass is wired.

Public API (stable)
-------------------
    from agents.registry.viz import classify_intent, select_recipe, build_chart_specs, build_visual_blocks

    recipe  = select_recipe(query)
    charts  = build_chart_specs(artifact, query=query)
    blocks  = build_visual_blocks(artifact, query=query)

Feature flag: ATLAS5_VIZ_ART_DIRECTOR_V1
    False (default) — uses legacy heuristic recipe selection from visual_recipe_director
    True            — reserved for live art-director selection wired in D1.4
"""
from __future__ import annotations

# Re-export the entire public API from the legacy director
from agents.visual_recipe_director import (  # noqa: F401
    classify_intent,
    is_cpc_inward,
    is_comparison_query,
    select_recipe,
    select_recipes,
    build_chart_specs,
    build_visual_blocks,
)
