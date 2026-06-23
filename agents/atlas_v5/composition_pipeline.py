"""Orchestrate merge → gate → fallback for free composition."""

from __future__ import annotations

import os
from typing import Literal

from agents.atlas_v5.composition_gate import validate_composition_gate
from agents.atlas_v5.composition_merge import merge_composition_markup
from agents.atlas_v5.keyed_figures import KeyedFigureIndex
from agents.contracts.answer_spec import AnswerSpec, CanvasBlock, GateStatus

GateStatusLiteral = Literal["pass", "reject", "fallback_recipe", "degrade_prose"]

GATE_MODE = os.getenv("ATLAS_V5_GATE_MODE", "warn").strip().lower()


def apply_composition_to_spec(
    spec: AnswerSpec,
    markup: str | None,
    index: KeyedFigureIndex,
) -> tuple[AnswerSpec, GateStatusLiteral, list[str], str]:
    """
    Returns (spec, gate_status, gate_errors, fallback_rung).
    fallback_rung: rendered | recipe | prose
    """
    if not markup or not markup.strip():
        return spec, "degrade_prose", [], "prose"

    merge = merge_composition_markup(markup, index)
    if merge.errors:
        return _fallback_recipe(spec, merge.errors)

    gate = validate_composition_gate(markup, merge.merged_markup, merge, index)
    if not gate.passed:
        if GATE_MODE == "warn":
            canvas = CanvasBlock(
                markup=markup,
                merged_markup=merge.merged_markup,
                scale_bindings=merge.scale_bindings,
                gate_status="pass",
                gate_errors=gate.errors,
            )
            return (
                spec.model_copy(update={"canvas": canvas}),
                "pass",
                gate.errors,
                "rendered",
            )
        return _fallback_recipe(spec, gate.errors)

    canvas = CanvasBlock(
        markup=markup,
        merged_markup=merge.merged_markup,
        scale_bindings=merge.scale_bindings,
        gate_status="pass",
        gate_errors=[],
    )
    return (
        spec.model_copy(update={"canvas": canvas}),
        "pass",
        [],
        "rendered",
    )


def _fallback_recipe(
    spec: AnswerSpec,
    errors: list[str],
) -> tuple[AnswerSpec, GateStatusLiteral, list[str], str]:
    if spec.instrument is not None:
        canvas = CanvasBlock(
            markup="",
            gate_status="fallback_recipe",
            gate_errors=errors,
        )
        return spec.model_copy(update={"canvas": canvas}), "fallback_recipe", errors, "recipe"
    stripped = spec.model_copy(update={"instrument": None})
    canvas = CanvasBlock(
        markup="",
        gate_status="degrade_prose",
        gate_errors=errors,
    )
    return stripped.model_copy(update={"canvas": canvas}), "degrade_prose", errors, "prose"
