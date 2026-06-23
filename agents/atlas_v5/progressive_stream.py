"""Staged partial AnswerSpec envelopes for progressive canvas streaming."""

from __future__ import annotations

from typing import Any, Literal

from agents.contracts.answer_spec import AnswerSpec, AnswerSpecEnvelope

PartialStage = Literal["stats", "spine", "visual", "final"]


def build_partial_envelope(
    spec: AnswerSpec,
    *,
    revision: int,
    stage: PartialStage,
) -> AnswerSpecEnvelope:
    dump = spec.model_dump(mode="json")
    if stage == "stats":
        partial: dict[str, Any] = {
            k: dump[k]
            for k in (
                "specVersion",
                "object",
                "scope",
                "mode",
                "tier",
                "tierCapReason",
                "stats",
                "reconciliation",
                "query",
            )
            if k in dump and dump[k] is not None
        }
    elif stage == "spine":
        partial = {
            k: dump[k]
            for k in (
                "specVersion",
                "object",
                "scope",
                "mode",
                "tier",
                "tierCapReason",
                "stats",
                "verdict",
                "blindspot",
                "soWhat",
                "reconciliation",
                "web_evidence",
                "query",
            )
            if k in dump and dump[k] is not None
        }
    elif stage == "visual":
        partial = {
            k: dump[k]
            for k in (
                "specVersion",
                "object",
                "scope",
                "mode",
                "tier",
                "stats",
                "verdict",
                "blindspot",
                "soWhat",
                "instrument",
                "chart",
                "canvas",
                "reconciliation",
                "web_evidence",
                "query",
            )
            if k in dump and dump[k] is not None
        }
    else:
        partial = dump

    return AnswerSpecEnvelope(
        revision=revision,
        status="partial" if stage != "final" else "final",
        spec=partial,
    )
