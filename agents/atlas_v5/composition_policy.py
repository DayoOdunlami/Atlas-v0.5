"""
Composition policy — flexible recipe ladder (not global recipe lock).

Ladder:
  1. recommend_worthy_recipe() when data + outcome + query clearly match
  2. visual_templates.py fallback when model omits markup
  3. free_compose default with soft Atlas tokens
  4. explicit skip — meta/defend queries never force rail orient recipes
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from agents.atlas_v5.intent import (
    is_atlas_self_reflection_query,
    is_connect_network_query,
    is_j1t1_orient_query,
)
from agents.atlas_v5.keyed_figures import KeyedFigureIndex
from agents.atlas_v5.wide_pass import WidePassResult
from agents.contracts.answer_spec import AnswerSpec

RECIPE_LOCK_ENABLED = os.getenv("ATLAS_V5_RECIPE_LOCK", "0").strip().lower() in (
    "1",
    "true",
    "yes",
)
DEMO_STRICT = os.getenv("ATLAS_V5_DEMO_STRICT", "0").strip().lower() in (
    "1",
    "true",
    "yes",
)
_CATALOG_PATH = Path(__file__).resolve().parent / "recipe_catalog.yaml"


@dataclass(frozen=True)
class RecipeRecommendation:
    recipe: str
    reason: str
    catalog_id: str | None = None


@lru_cache(maxsize=1)
def _load_catalog() -> list[dict[str, Any]]:
    if not _CATALOG_PATH.is_file():
        return []
    with _CATALOG_PATH.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return list(data.get("entries") or [])


def _pattern_match(query: str, patterns: list[str]) -> bool:
    q = query.strip()
    for pat in patterns:
        if re.search(pat, q, re.I):
            return True
    return False


def _catalog_blocks_recipe(query: str, recipe: str) -> bool:
    """Catalog exclude_patterns — e.g. meta defend must not get rail orient."""
    for entry in _load_catalog():
        if entry.get("recipe") != recipe:
            continue
        excludes = entry.get("exclude_patterns") or []
        if _pattern_match(query, excludes):
            return True
    return False


def recommend_worthy_recipe(
    query: str,
    wide: WidePassResult,
    skeleton: AnswerSpec,
) -> RecipeRecommendation | None:
    """Return a reference recipe when gates pass — works without ATLAS_V5_RECIPE_LOCK."""
    if is_atlas_self_reflection_query(query):
        return None

    instrument = skeleton.instrument
    if instrument is None:
        return None

    recipe = instrument.recipe
    if _catalog_blocks_recipe(query, recipe):
        return None

    stats = wide.stats
    project_count = stats.project_count if stats else 0

    if wide.outcome == "diagnose" and recipe == "EvidenceGapMatrix":
        dims = (instrument.data or {}).get("dimensions") or []
        min_dims = 2 if DEMO_STRICT else 3
        if len(dims) >= min_dims:
            return RecipeRecommendation(
                recipe,
                "Diagnose gap matrix — structured HAVE/GAP/MOVE beats ad-hoc HTML",
                catalog_id="diagnose_gaps",
            )

    if wide.outcome == "connect" and recipe == "NetworkMap" and wide.graph:
        edge_count = len(wide.graph.edges)
        node_count = len(wide.graph.nodes)
        min_edges = 1 if DEMO_STRICT else 2
        if edge_count >= min_edges or wide.graph.ladder_rung == "force-graph":
            return RecipeRecommendation(
                recipe,
                f"NetworkMap — {node_count} nodes / {edge_count} edges corpus-grounded",
                catalog_id="connect_network",
            )
        if is_connect_network_query(query) and node_count >= 1:
            return RecipeRecommendation(
                recipe,
                "NetworkMap — typed inventory when graph too sparse for free layout",
                catalog_id="connect_sparse",
            )

    if wide.outcome == "act" and recipe == "OpportunityList":
        items = (instrument.data or {}).get("items") or []
        min_items = 1 if DEMO_STRICT else 2
        if len(items) >= min_items:
            return RecipeRecommendation(
                recipe,
                f"OpportunityList — {len(items)} ranked practitioner signals",
                catalog_id="act_opportunity",
            )

    if wide.outcome == "orient" and recipe == "IncommensurableMagnitudes":
        data = instrument.data or {}
        if not (data.get("upper") and data.get("lower")):
            return None
        min_projects = 5 if DEMO_STRICT else 10
        if project_count < min_projects and not is_j1t1_orient_query(query):
            return None
        if is_j1t1_orient_query(query) or _two_tier_orient_query(query):
            return RecipeRecommendation(
                recipe,
                "IncommensurableMagnitudes — two-tier funding field (locked geometry)",
                catalog_id="rail_orient_j1t1",
            )
        if _pattern_match(query, [r"state of play.*hydrogen", r"hydrogen.*corpus"]):
            return RecipeRecommendation(
                recipe,
                "IncommensurableMagnitudes — corpus floor vs programme scale",
                catalog_id="hydrogen_orient",
            )
        return None

    return None


def _two_tier_orient_query(query: str) -> bool:
    return bool(
        re.search(
            r"\b(two.?tier|funding floor|national programme|incommensurable|"
            r"£.*bn|programme scale|corpus vs)\b",
            query,
            re.I,
        )
    )


def build_recipe_lock_addendum(
    rec: RecipeRecommendation | None,
    *,
    free_compose_enabled: bool,
) -> str:
    if not free_compose_enabled:
        if rec:
            return (
                f"\n## Composition (recipes-only mode)\n"
                f"RECIPE_LOCK: {rec.recipe} — {rec.reason}\n"
                f"composition_mode: reference_recipe; canvas_markup: null\n"
            )
        return (
            "\n## Composition (recipes-only mode)\n"
            "composition_mode: reference_recipe; canvas_markup: null\n"
        )

    if rec:
        return (
            f"\n## Composition policy\n"
            f"WORTHY_RECIPE: {rec.recipe} — {rec.reason}\n"
            f"Use composition_mode reference_recipe and canvas_markup null — "
            f"this recipe is higher value than free HTML for this query.\n"
        )

    return (
        "\n## Composition policy\n"
        "Default: composition_mode free_compose — compose an engaging, trust-marked "
        "HTML/SVG canvas using {{key}} holes and available_keys only.\n"
        "Use reference_recipe ONLY when WORTHY_RECIPE is present above. "
        "canvas_markup REQUIRED when composition_mode is free_compose.\n"
        "Visual tone: match Atlas spine tokens (#FBFAF7, #1A1714, #3F7A52, #EFEBE4) "
        "unless a strong layout reason to diverge — see atlas-visual-composition skill.\n"
    )


def should_use_recipe(
    rec: RecipeRecommendation | None,
    *,
    free_compose_enabled: bool,
) -> bool:
    """Flexible ladder: worthy recipe wins; never force wrong recipe via global lock."""
    if not free_compose_enabled:
        return True
    if rec is not None:
        return True
    if RECIPE_LOCK_ENABLED:
        return False
    return False
