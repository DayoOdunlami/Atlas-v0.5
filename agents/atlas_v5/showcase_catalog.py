"""Showcase / demo journeys — rail, aviation, flex (digital muscle)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ShowcaseDomain = Literal["rail", "aviation", "flex"]


@dataclass(frozen=True)
class ShowcaseStep:
    label: str
    query: str
    hint: str


@dataclass(frozen=True)
class ShowcaseJourney:
    domain: ShowcaseDomain
    title: str
    tagline: str
    steps: tuple[ShowcaseStep, ...]


RAIL_JOURNEY = ShowcaseJourney(
    domain="rail",
    title="Rail decarbonisation · 4 turns",
    tagline="Orient → Diagnose → Network → Act",
    steps=(
        ShowcaseStep(
            "Orient",
            "State of play on rail decarbonisation in our corpus",
            "IncommensurableMagnitudes · corpus floor vs national programme",
        ),
        ShowcaseStep(
            "Diagnose",
            "What evidence gaps exist in rail decarbonisation funding data?",
            "EvidenceGapMatrix · TRIG + null funding gates",
        ),
        ShowcaseStep(
            "Connect",
            "Map the hydrogen rail supply chain as a network",
            "NetworkMap · mode bridges",
        ),
        ShowcaseStep(
            "Act",
            "Where is the biggest CPC opportunity in rail decarbonisation?",
            "OpportunityList · practitioner signals",
        ),
    ),
)

AVIATION_JOURNEY = ShowcaseJourney(
    domain="aviation",
    title="Aviation decarbonisation · 4 turns",
    tagline="SAF · electrification · corpus gaps",
    steps=(
        ShowcaseStep(
            "Orient",
            "State of play on aviation decarbonisation in our corpus",
            "Landscape · aviation mode slice",
        ),
        ShowcaseStep(
            "Diagnose",
            "Diagnose evidence gaps in aviation decarbonisation funding",
            "Gap matrix · funder concentration",
        ),
        ShowcaseStep(
            "Connect",
            "Map the aviation decarbonisation ecosystem and who collaborates",
            "Network · cross-sector bridges",
        ),
        ShowcaseStep(
            "Act",
            "What should CPC pursue next in aviation decarbonisation funding?",
            "Ranked opportunity signals",
        ),
    ),
)

FLEX_JOURNEY = ShowcaseJourney(
    domain="flex",
    title="Digital muscle · flex demo",
    tagline="Surfaces Atlas can morph — your pick of domain",
    steps=(
        ShowcaseStep(
            "Orient",
            "Flex your digital muscle — show me the state of play on rail decarbonisation",
            "Two-tier funding field",
        ),
        ShowcaseStep(
            "Connect",
            "Show the cross-modal ecosystem and who collaborates on rail decarb",
            "Network morph",
        ),
        ShowcaseStep(
            "Diagnose",
            "What's missing from our corpus on rail decarbonisation partnerships?",
            "Honest gap matrix",
        ),
        ShowcaseStep(
            "Act",
            "Show me ranked practitioner signals for rail decarbonisation opportunities",
            "Web + corpus opportunities",
        ),
    ),
)

JOURNEYS: dict[ShowcaseDomain, ShowcaseJourney] = {
    "rail": RAIL_JOURNEY,
    "aviation": AVIATION_JOURNEY,
    "flex": FLEX_JOURNEY,
}

DOMAIN_ALIASES: dict[str, ShowcaseDomain] = {
    "rail": "rail",
    "trains": "rail",
    "1": "rail",
    "aviation": "aviation",
    "air": "aviation",
    "saf": "aviation",
    "2": "aviation",
    "flex": "flex",
    "muscle": "flex",
    "digital": "flex",
    "3": "flex",
    "showcase": "flex",
}
