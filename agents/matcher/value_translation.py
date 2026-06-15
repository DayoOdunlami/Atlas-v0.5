"""
agents.matcher.value_translation
==================================

Value translation — per-claim labelling for cross-sector transfer.

For each claim in the Passport that maps to a requirement criterion,
assigns a transfer label:

  travels-as-is       Claim is directly applicable in the new sector
  needs-reframing     Claim needs vocabulary/framing change to be credible
  not-credible-here   Claim doesn't transfer — sector norms differ too much
  evidence-needed     Gap: new evidence must be generated before claiming value

This is the core of the "Diagnose" outcome and the Value Translation Report
(ADR-0001 §3, North Star product spine step 4 "Strategic Artefact").
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from agents.matcher.matcher import CriterionMatch, MatchResult, Verdict

TransferLabel = Literal[
    "travels-as-is",
    "needs-reframing",
    "not-credible-here",
    "evidence-needed",
]


@dataclass
class TranslatedClaim:
    """A criterion match annotated with a transfer label."""

    criterion_label: str
    criterion_domain: str
    importance: str
    verdict: Verdict
    matched_claim: str | None
    matched_claim_tier: str
    transfer_label: TransferLabel
    translation_note: str
    """One sentence explaining why this label was assigned."""
    action_required: str
    """Concrete next step (blank if travels-as-is)."""


def _assign_transfer_label(match: CriterionMatch) -> tuple[TransferLabel, str, str]:
    """
    Assign a transfer label from a CriterionMatch.

    Rules (deterministic — no LLM):
      FIT + Supported/Robust → travels-as-is
      FIT + Indicative       → needs-reframing
      GAP                    → needs-reframing or evidence-needed
      RISK                   → not-credible-here
      MOVE                   → evidence-needed
    """
    v = match.verdict
    tier = match.matched_claim_tier

    if v == "FIT":
        if tier in ("Supported", "Robust"):
            return (
                "travels-as-is",
                "Evidence is strong enough to use in the new sector without adaptation.",
                "",
            )
        return (
            "needs-reframing",
            f"Evidence exists at {tier} level — reframe to align with sector vocabulary.",
            "Rewrite claim using sector-specific language and add one supporting reference.",
        )

    if v == "GAP":
        if tier in ("Indicative", "Speculative"):
            return (
                "needs-reframing",
                "Partial evidence exists — strengthen framing and highlight analogues.",
                "Identify 2–3 analogous cases in the target sector to bridge the gap.",
            )
        return (
            "evidence-needed",
            "No usable evidence — new case study or metric required.",
            "Commission or document a pilot/deployment to generate evidence.",
        )

    if v == "RISK":
        return (
            "not-credible-here",
            "Existing evidence conflicts with sector norms or TRL expectations.",
            "Do not use this claim as-is. Seek independent validation first.",
        )

    # MOVE
    return (
        "evidence-needed",
        "No evidence in this domain — cannot claim value without new work.",
        "Define a minimum viable evidence package before entering this sector.",
    )


def translate_match_result(match_result: MatchResult) -> list[TranslatedClaim]:
    """Apply transfer labelling to all CriterionMatches in a MatchResult."""
    translated: list[TranslatedClaim] = []
    for match in match_result.matches:
        label, note, action = _assign_transfer_label(match)
        translated.append(TranslatedClaim(
            criterion_label=match.criterion_label,
            criterion_domain=match.criterion_domain,
            importance=match.importance,
            verdict=match.verdict,
            matched_claim=match.matched_claim,
            matched_claim_tier=match.matched_claim_tier,
            transfer_label=label,
            translation_note=note,
            action_required=action,
        ))
    return translated


def summarise_translation(claims: list[TranslatedClaim]) -> dict:
    """Produce a summary dict suitable for the Value Translation Report block."""
    from collections import Counter
    label_counts = Counter(c.transfer_label for c in claims)
    essential_labels = [c.transfer_label for c in claims if c.importance == "essential"]
    essential_ready = sum(1 for l in essential_labels if l == "travels-as-is")
    total_essential = len(essential_labels)

    return {
        "total": len(claims),
        "by_label": dict(label_counts),
        "essential_ready": essential_ready,
        "total_essential": total_essential,
        "readiness_rate": round(essential_ready / max(total_essential, 1), 2),
        "claims": [
            {
                "criterion": c.criterion_label,
                "domain": c.criterion_domain,
                "importance": c.importance,
                "transfer_label": c.transfer_label,
                "note": c.translation_note,
                "action": c.action_required,
            }
            for c in claims
        ],
    }
