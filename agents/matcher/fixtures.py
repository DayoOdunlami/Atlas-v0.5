"""
agents.matcher.fixtures
=======================

Shared test/demo fixtures for the Value Translation vertical.
Used by pytest and the orchestrator diagnose path when corpus data is unavailable.
"""
from __future__ import annotations

from agents.matcher.passport import Passport, PassportClaim
from agents.matcher.requirement_spec import RequirementCriterion, RequirementSpec


def cpc_smart_mobility_passport() -> Passport:
    """CPC smart mobility passport — Sameer pilot scenario."""
    return Passport(
        entity_name="CPC Smart Mobility Programme",
        owner_org="Connected Places Catapult",
        sector_origin="transport",
        sector_target="smart mobility",
        summary=(
            "CPC has delivered 12+ smart mobility projects across UK cities, "
            "including MaaS pilots, freight optimisation, and connected vehicle trials."
        ),
        trl_level=6,
        claims=[
            PassportClaim(
                domain="smart mobility",
                text="CPC has deployed a MaaS platform across 3 UK cities at TRL 7.",
                confidence_tier="Supported",
                role="primary",
            ),
            PassportClaim(
                domain="data infrastructure",
                text="CPC operates a national transport data sharing platform with 40+ data feeds.",
                confidence_tier="Robust",
                role="primary",
            ),
            PassportClaim(
                domain="economic appraisal",
                text="CPC has conducted Green Book appraisals for 5 transport investment cases.",
                confidence_tier="Indicative",
                role="supporting",
            ),
        ],
    )


def innovate_uk_smart_mobility_spec() -> RequirementSpec:
    """Innovate UK Smart Mobility call — Sameer pilot scenario."""
    return RequirementSpec(
        source_text="Innovate UK seeks applicants with demonstrated deployment of smart mobility solutions at scale.",
        title="Innovate UK Smart Mobility Challenge 2026",
        sector_target="smart mobility",
        funder="Innovate UK",
        criteria=[
            RequirementCriterion(
                label="Demonstrated deployment at scale",
                description="Applicants must demonstrate previous deployment of smart mobility solutions at TRL 7+.",
                importance="essential",
                domain="smart mobility",
                evidence_type="case_study",
            ),
            RequirementCriterion(
                label="Data infrastructure capability",
                description="Strong evidence of data sharing and platform management.",
                importance="essential",
                domain="data infrastructure",
                evidence_type="case_study",
            ),
            RequirementCriterion(
                label="Economic appraisal experience",
                description="Should have experience with cost-benefit analysis and business case development.",
                importance="desirable",
                domain="economic appraisal",
                evidence_type="publication",
            ),
            RequirementCriterion(
                label="Climate resilience",
                description="Nice to have: climate adaptation considerations.",
                importance="nice_to_have",
                domain="climate resilience",
                evidence_type="case_study",
            ),
        ],
    )
