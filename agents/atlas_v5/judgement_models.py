"""Structured output from Sonnet deep pass (judgement fields only)."""

from __future__ import annotations

from pydantic import BaseModel, Field

from agents.contracts.answer_spec import (
    Blindspot,
    Claim,
    ConfidenceTier,
    OutcomeMode,
    SoWhat,
    Verdict,
)


class SwotQuadrants(BaseModel):
    strengths: list[str] = Field(default_factory=list, max_length=5)
    weaknesses: list[str] = Field(default_factory=list, max_length=5)
    opportunities: list[str] = Field(default_factory=list, max_length=5)
    threats: list[str] = Field(default_factory=list, max_length=5)


class JudgementFieldsOutput(BaseModel):
    mode: OutcomeMode
    tier: ConfidenceTier
    tierCapReason: str | None = None
    verdict: Verdict
    blindspot: Blindspot | None = None
    soWhat: SoWhat
    instrument_recipe: str = Field(
        description="IncommensurableMagnitudes, NetworkMap, EvidenceGapMatrix, or OpportunityList",
    )
    instrument_honesty_label: str | None = None
    chat_complement: str = Field(
        description="Short chat-rail complement; not a duplicate of verdict.sentence",
    )
    claims: list[Claim] = Field(
        default_factory=list,
        description="Evidence-grounded claims; cite corpus_id or web_id only when in evidence bag",
    )
    swot: SwotQuadrants | None = Field(
        default=None,
        description="Required when user asks for SWOT — four quadrants of bullet strings",
    )
