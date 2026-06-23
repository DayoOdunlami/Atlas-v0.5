"""Turn disposition — what surface and how much canvas to touch."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

PrimarySurface = Literal["chat_only", "chat_primary", "hybrid", "canvas_primary"]
CanvasAction = Literal["none", "patch", "replace", "clear"]
CompositionMode = Literal["none", "reference_recipe", "free_compose", "degrade_prose"]


class TurnDispositionOutput(BaseModel):
    primary_surface: PrimarySurface
    canvas_action: CanvasAction
    composition_mode: CompositionMode
    patch_fields: list[str] = Field(default_factory=list)
    reasoning: str = Field(default="", description="Dev overlay only")
