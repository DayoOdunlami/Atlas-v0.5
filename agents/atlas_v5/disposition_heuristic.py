"""Heuristic disposition when Sonnet unavailable."""

from __future__ import annotations

import re
from typing import Any

from agents.atlas_v5.chat_router import _ARTIFACT_META_RE, _GREETING_RE, is_clear_canvas_query
from agents.atlas_v5.composition_policy import RecipeRecommendation, should_use_recipe
from agents.atlas_v5.disposition_models import TurnDispositionOutput
from agents.base import is_conversational


def infer_disposition_heuristic(
    query: str,
    *,
    current_spec: dict[str, Any] | None = None,
    substantive: bool = True,
    recipe_rec: RecipeRecommendation | None = None,
    free_compose_enabled: bool = True,
) -> TurnDispositionOutput:
    q = query.strip()

    if is_clear_canvas_query(q):
        return TurnDispositionOutput(
            primary_surface="chat_primary",
            canvas_action="clear",
            composition_mode="none",
            reasoning="clear canvas command",
        )

    if not substantive or _GREETING_RE.match(q) or is_conversational(q):
        if current_spec and _ARTIFACT_META_RE.search(q):
            return TurnDispositionOutput(
                primary_surface="hybrid",
                canvas_action="none",
                composition_mode="none",
                reasoning="artifact meta — chat explains canvas",
            )
        return TurnDispositionOutput(
            primary_surface="chat_only",
            canvas_action="none",
            composition_mode="none",
            reasoning="conversational / chat-only",
        )

    if should_use_recipe(recipe_rec, free_compose_enabled=free_compose_enabled):
        assert recipe_rec is not None
        return TurnDispositionOutput(
            primary_surface="canvas_primary",
            canvas_action="replace",
            composition_mode="reference_recipe",
            reasoning=f"worthy recipe: {recipe_rec.reason}",
        )

    mode = "free_compose" if free_compose_enabled else "reference_recipe"
    return TurnDispositionOutput(
        primary_surface="canvas_primary",
        canvas_action="replace",
        composition_mode=mode,
        reasoning="substantive → free compose default (no recipe lock)",
    )
