"""Unified deep pass structured output — disposition first, then judgement, then markup."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from agents.atlas_v5.disposition_models import (
    CanvasAction,
    CompositionMode,
    PrimarySurface,
    TurnDispositionOutput,
)
from agents.atlas_v5.judgement_models import JudgementFieldsOutput

CaseClaimKindOut = Literal["fact", "domain", "constraint", "hypothesis", "uncertainty"]


class CaseClaimOut(BaseModel):
    id: str | None = None
    text: str = Field(min_length=1, max_length=2000)
    kind: CaseClaimKindOut = "fact"


class DeepPassOutput(BaseModel):
    """Single Sonnet call — resolve disposition before emitting canvas_markup."""

    primary_surface: PrimarySurface
    canvas_action: CanvasAction
    composition_mode: CompositionMode
    patch_fields: list[str] = Field(default_factory=list)
    disposition_reasoning: str = ""

    judgement: JudgementFieldsOutput
    canvas_markup: str | None = Field(
        default=None,
        description="ONLY when composition_mode is free_compose; else null",
    )
    case_claims: list[CaseClaimOut] = Field(
        default_factory=list,
        description="Declared user_situation claims extracted or updated this turn",
    )

    @model_validator(mode="after")
    def _markup_only_when_compose(self) -> "DeepPassOutput":
        if self.composition_mode != "free_compose" and self.canvas_markup:
            object.__setattr__(self, "canvas_markup", None)
        if self.canvas_action in ("none", "clear") and self.canvas_markup:
            object.__setattr__(self, "canvas_markup", None)
        if self.composition_mode in ("none", "degrade_prose", "reference_recipe"):
            object.__setattr__(self, "canvas_markup", None)
        return self

    @property
    def disposition(self) -> TurnDispositionOutput:
        return TurnDispositionOutput(
            primary_surface=self.primary_surface,
            canvas_action=self.canvas_action,
            composition_mode=self.composition_mode,
            patch_fields=self.patch_fields,
            reasoning=self.disposition_reasoning,
        )
