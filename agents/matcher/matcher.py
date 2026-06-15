"""
agents.matcher.matcher
======================

Passport × Requirement Spec → Fit / Gap / Risk / Move scoring.

For each RequirementCriterion, the matcher:
  1. Finds the best matching claim(s) from the Passport
  2. Assigns a verdict: FIT | GAP | RISK | MOVE
  3. Produces a scored MatchResult

Verdicts
--------
  FIT   Passport has a Supported/Robust claim covering this criterion
  GAP   Passport has claims in the domain but below required confidence
  RISK  Passport has conflicting or TRL-mismatch evidence
  MOVE  No relevant evidence — needs new work or analogue transfer

Scores (0.0–1.0)
  overall_fit_score   fraction of essential criteria that are FIT
  gap_severity        weighted gap count (essential gaps count double)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from agents.matcher.passport import Passport, PassportClaim
from agents.matcher.requirement_spec import RequirementCriterion, RequirementSpec

Verdict = Literal["FIT", "GAP", "RISK", "MOVE"]

TIER_RANK = {"Robust": 3, "Supported": 2, "Indicative": 1, "Speculative": 0}


@dataclass
class CriterionMatch:
    """Scored match for one RequirementCriterion against the Passport."""

    criterion_label: str
    criterion_domain: str
    importance: str
    verdict: Verdict
    matched_claim: str | None
    """Best matching claim text, or None if no match."""
    matched_claim_tier: str
    """Tier of the matched claim."""
    rationale: str
    """Short explanation of the verdict."""
    score: float
    """0.0 = complete gap, 1.0 = perfect fit."""


@dataclass
class MatchResult:
    """Complete scored match between a Passport and a Requirement Spec."""

    entity_name: str
    opportunity_title: str
    matches: list[CriterionMatch] = field(default_factory=list)

    @property
    def overall_fit_score(self) -> float:
        essential = [m for m in self.matches if m.importance == "essential"]
        if not essential:
            return 0.0
        fits = sum(1 for m in essential if m.verdict == "FIT")
        return round(fits / len(essential), 2)

    @property
    def gap_severity(self) -> float:
        """0.0 = no gaps, 1.0 = all essential criteria are GAP or MOVE."""
        total_weight = 0.0
        gap_weight = 0.0
        for m in self.matches:
            weight = 2.0 if m.importance == "essential" else 1.0
            total_weight += weight
            if m.verdict in ("GAP", "MOVE"):
                gap_weight += weight
        if total_weight == 0:
            return 0.0
        return round(gap_weight / total_weight, 2)

    @property
    def verdict_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {"FIT": 0, "GAP": 0, "RISK": 0, "MOVE": 0}
        for m in self.matches:
            counts[m.verdict] = counts.get(m.verdict, 0) + 1
        return counts

    def to_dict(self) -> dict[str, Any]:
        return {
            "entity_name": self.entity_name,
            "opportunity_title": self.opportunity_title,
            "overall_fit_score": self.overall_fit_score,
            "gap_severity": self.gap_severity,
            "verdict_counts": self.verdict_counts,
            "matches": [
                {
                    "criterion": m.criterion_label,
                    "domain": m.criterion_domain,
                    "importance": m.importance,
                    "verdict": m.verdict,
                    "matched_claim": m.matched_claim,
                    "matched_tier": m.matched_claim_tier,
                    "rationale": m.rationale,
                    "score": m.score,
                }
                for m in self.matches
            ],
        }


def _find_best_claim(
    passport: Passport,
    criterion: RequirementCriterion,
) -> PassportClaim | None:
    """Find the strongest passport claim matching the criterion domain."""
    domain_claims = [c for c in passport.claims if c.domain == criterion.domain]
    if not domain_claims:
        # Try partial keyword match
        kw = criterion.domain.split()[0].lower()
        domain_claims = [c for c in passport.claims if kw in c.domain.lower()]

    if not domain_claims:
        return None

    return max(domain_claims, key=lambda c: TIER_RANK.get(c.confidence_tier, 0))


def _score_match(claim: PassportClaim | None, criterion: RequirementCriterion) -> tuple[Verdict, float, str]:
    """Derive verdict, score, and rationale from the best claim."""
    if claim is None:
        return (
            "MOVE",
            0.0,
            f"No evidence in '{criterion.domain}' — requires new work or analogue transfer.",
        )

    claim_rank = TIER_RANK.get(claim.confidence_tier, 0)

    if claim_rank >= 2:  # Supported or Robust
        return (
            "FIT",
            0.8 + 0.2 * (claim_rank - 2),
            f"Passport has {claim.confidence_tier} evidence in '{claim.domain}'.",
        )

    if claim_rank == 1:  # Indicative
        if criterion.importance == "essential":
            return (
                "GAP",
                0.4,
                f"Evidence exists but is only Indicative — insufficient for an essential criterion.",
            )
        return (
            "GAP",
            0.5,
            f"Indicative evidence available — borderline for '{criterion.domain}'.",
        )

    # Speculative
    return (
        "GAP",
        0.2,
        f"Only Speculative evidence in '{criterion.domain}' — insufficient.",
    )


def run_matcher(passport: Passport, spec: RequirementSpec) -> MatchResult:
    """
    Match a Passport against a Requirement Spec and return a scored MatchResult.
    """
    result = MatchResult(
        entity_name=passport.entity_name,
        opportunity_title=spec.title,
    )

    for criterion in spec.criteria:
        best_claim = _find_best_claim(passport, criterion)
        verdict, score, rationale = _score_match(best_claim, criterion)

        result.matches.append(CriterionMatch(
            criterion_label=criterion.label,
            criterion_domain=criterion.domain,
            importance=criterion.importance,
            verdict=verdict,
            matched_claim=best_claim.text if best_claim else None,
            matched_claim_tier=best_claim.confidence_tier if best_claim else "None",
            rationale=rationale,
            score=score,
        ))

    return result
