"""Merge Sonnet judgement onto SQL-locked AnswerSpec skeleton."""

from __future__ import annotations

from agents.atlas_v5.composition_merge import (
    merge_keyed_figures_in_text,
    strip_unresolved_key_holes,
    text_has_unresolved_key_holes,
)
from agents.atlas_v5.judgement_models import JudgementFieldsOutput
from agents.atlas_v5.keyed_figures import KeyedFigureIndex
from agents.contracts.answer_spec import (
    AnswerSpec,
    Blindspot,
    BlindspotStructure,
    Instrument,
    InstrumentHonesty,
    SoWhat,
    Verdict,
)


def _merge_field(
    text: str | None,
    fallback: str | None,
    index: KeyedFigureIndex,
) -> str | None:
    if text is None:
        return None
    merged = merge_keyed_figures_in_text(text, index)
    if text_has_unresolved_key_holes(merged) and fallback is not None:
        return fallback
    return merged


def merge_keyed_figures_into_spec(
    spec: AnswerSpec,
    index: KeyedFigureIndex,
    *,
    skeleton: AnswerSpec | None = None,
) -> AnswerSpec:
    """Fill {{key}} holes in user-facing prose; fall back to skeleton when holes remain."""
    base = skeleton or spec
    verdict = spec.verdict
    merged_verdict = Verdict(
        sentence=_merge_field(
            verdict.sentence,
            base.verdict.sentence,
            index,
        )
        or verdict.sentence,
        tail=_merge_field(verdict.tail, base.verdict.tail, index),
    )

    blindspot = spec.blindspot
    merged_blindspot = blindspot
    if blindspot:
        structure = blindspot.structure
        if structure:
            structure = BlindspotStructure(
                pattern=_merge_field(
                    structure.pattern,
                    base.blindspot.structure.pattern if base.blindspot and base.blindspot.structure else None,
                    index,
                )
                or structure.pattern,
                implication=_merge_field(
                    structure.implication,
                    base.blindspot.structure.implication if base.blindspot and base.blindspot.structure else None,
                    index,
                )
                or structure.implication,
            )
        merged_blindspot = Blindspot(
            sign=blindspot.sign,
            gap=_merge_field(
                blindspot.gap,
                base.blindspot.gap if base.blindspot else None,
                index,
            )
            or blindspot.gap,
            closable=_merge_field(
                blindspot.closable,
                base.blindspot.closable if base.blindspot else None,
                index,
            ),
            secondary=_merge_field(
                blindspot.secondary,
                base.blindspot.secondary if base.blindspot else None,
                index,
            ),
            structure=structure,
        )

    so_what = spec.soWhat
    merged_so_what = SoWhat(
        lookingAt=_merge_field(so_what.lookingAt, base.soWhat.lookingAt, index)
        or so_what.lookingAt,
        oneDecision=_merge_field(so_what.oneDecision, base.soWhat.oneDecision, index)
        or so_what.oneDecision,
        gate=_merge_field(so_what.gate, base.soWhat.gate, index) or so_what.gate,
        primaryAction=_merge_field(
            so_what.primaryAction,
            base.soWhat.primaryAction,
            index,
        )
        or so_what.primaryAction,
        turn=so_what.turn,
    )

    tier_cap = _merge_field(spec.tierCapReason, base.tierCapReason, index)

    claims = spec.claims
    if claims:
        claims = [
            claim.model_copy(
                update={
                    "text": _merge_field(claim.text, claim.text, index) or claim.text,
                }
            )
            for claim in claims
        ]

    return spec.model_copy(
        update={
            "verdict": merged_verdict,
            "blindspot": merged_blindspot,
            "soWhat": merged_so_what,
            "tierCapReason": tier_cap,
            "claims": claims,
        }
    )


def merge_judgement_onto_skeleton(
    skeleton: AnswerSpec,
    judgement: JudgementFieldsOutput,
) -> AnswerSpec:
    """Facts from skeleton; prose fields from model."""
    instrument = skeleton.instrument
    if instrument is not None:
        honesty = instrument.honesty or InstrumentHonesty(toScale=False)
        if judgement.instrument_honesty_label:
            honesty = InstrumentHonesty(
                toScale=honesty.toScale,
                label=judgement.instrument_honesty_label,
            )
        instrument = Instrument(
            recipe=judgement.instrument_recipe,
            data=instrument.data,
            honesty=honesty,
        )

    blindspot = judgement.blindspot
    if blindspot and skeleton.blindspot and skeleton.blindspot.structure:
        blindspot = blindspot.model_copy(
            update={"structure": skeleton.blindspot.structure},
        )

    update: dict = {
        "mode": judgement.mode,
        "tier": judgement.tier,
        "tierCapReason": judgement.tierCapReason or skeleton.tierCapReason,
        "verdict": judgement.verdict,
        "blindspot": blindspot or skeleton.blindspot,
        "soWhat": judgement.soWhat,
        "instrument": instrument,
    }
    if judgement.claims:
        update["claims"] = judgement.claims

    return skeleton.model_copy(update=update)


def merge_chat_complement(text: str, index: KeyedFigureIndex) -> str:
    if not text.strip():
        return text
    merged = merge_keyed_figures_in_text(text, index)
    if text_has_unresolved_key_holes(merged):
        return strip_unresolved_key_holes(merged)
    return merged
