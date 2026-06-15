"""
agents.matcher.requirement_spec
================================

Requirement Spec — structured extraction of what a funding call, sector
challenge, or opportunity requires from a potential applicant.

This is the "what proof unlocks value here?" object that drives the
Diagnose / Value Translation vertical (ADR-0001 §3).

A Requirement Spec is extracted from free text (e.g. a call description,
a sector brief, or a user query) and then matched against a Passport to
produce the Fit / Gap / Risk / Move output.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class RequirementCriterion:
    """One measurable criterion from the requirement spec."""

    label: str
    """Short label (e.g. 'Demonstrated deployment at scale')."""

    description: str
    """Full description of what is needed."""

    importance: str
    """essential | desirable | nice_to_have."""

    domain: str
    """Capability domain this maps to (e.g. 'data infrastructure')."""

    evidence_type: str
    """What form of proof is expected (case_study | metric | publication | letter_of_support)."""


@dataclass
class RequirementSpec:
    """Structured profile of what an opportunity requires."""

    source_text: str
    """Raw text this spec was extracted from (call description etc.)."""

    title: str
    """Short name for the opportunity / challenge."""

    sector_target: str
    """Sector the opportunity is in."""

    funder: str
    """Funder or challenge owner."""

    criteria: list[RequirementCriterion] = field(default_factory=list)

    total_value: str = ""
    """e.g. '£2M' — informational only."""

    deadline: str = ""

    @property
    def essential_criteria(self) -> list[RequirementCriterion]:
        return [c for c in self.criteria if c.importance == "essential"]

    @property
    def domains_required(self) -> list[str]:
        return sorted({c.domain for c in self.criteria if c.domain})


# ---------------------------------------------------------------------------
# Lightweight heuristic extractor (no LLM) — used in tests + unit modes
# ---------------------------------------------------------------------------

_DOMAIN_KEYWORDS: list[tuple[str, list[str]]] = [
    ("data infrastructure", ["data platform", "data sharing", "data standard", "digital twin", "iot", "sensor"]),
    ("transport modelling", ["transport model", "demand model", "simulation", "network model", "traffic model"]),
    ("smart mobility", ["smart mobility", "autonomous vehicle", "connected vehicle", "maas", "multimodal"]),
    ("freight logistics", ["freight", "logistics", "supply chain", "last mile", "intermodal"]),
    ("climate resilience", ["climate", "net zero", "decarbonisation", "resilience", "adaptation"]),
    ("economic appraisal", ["business case", "cost benefit", "npv", "bcr", "economic appraisal", "green book"]),
    ("research & innovation", ["research", "innovation", "r&d", "prototype", "pilot", "demonstrator"]),
]


def _detect_domain(text: str) -> str:
    t = text.lower()
    for domain, keywords in _DOMAIN_KEYWORDS:
        if any(kw in t for kw in keywords):
            return domain
    return "general"


_VALUE_RE = re.compile(r"£[\d,]+[kmb]?", re.I)
_DEADLINE_RE = re.compile(
    r"\b(deadline|closes|closing date|submit by|due)\b[^.]{0,60}(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+ \d{4})",
    re.I,
)


def extract_requirement_spec(
    source_text: str,
    *,
    title: str = "",
    sector_target: str = "",
    funder: str = "",
) -> RequirementSpec:
    """
    Lightweight heuristic extraction of a Requirement Spec from free text.

    For production use, this should be called via an LLM-assisted extraction
    step in the orchestrator loop (the LLM uses this schema as the output
    contract).  This heuristic version is used in tests and as a fallback.
    """
    text = source_text.strip()

    # Extract value
    value_match = _VALUE_RE.search(text)
    total_value = value_match.group(0) if value_match else ""

    # Extract deadline
    deadline_match = _DEADLINE_RE.search(text)
    deadline = deadline_match.group(2) if deadline_match else ""

    # Build criteria from sentences containing requirement signals
    criteria: list[RequirementCriterion] = []
    req_signals = re.compile(
        r"\b(must|should|will|require|expect|demonstrate|evidence|proof|experience|track record|capabilit)\b",
        re.I,
    )
    for i, sentence in enumerate(re.split(r"[.;]\s+", text)):
        if req_signals.search(sentence) and len(sentence) > 30:
            domain = _detect_domain(sentence)
            importance = (
                "essential" if re.search(r"\b(must|require|essential|mandatory)\b", sentence, re.I)
                else "desirable"
            )
            criteria.append(RequirementCriterion(
                label=sentence.strip()[:80],
                description=sentence.strip()[:300],
                importance=importance,
                domain=domain,
                evidence_type="case_study",
            ))
        if len(criteria) >= 8:
            break

    return RequirementSpec(
        source_text=text[:2000],
        title=title or "Unknown opportunity",
        sector_target=sector_target or _detect_domain(text),
        funder=funder or "Unknown",
        criteria=criteria,
        total_value=total_value,
        deadline=deadline,
    )


def validate_requirement_spec(spec: RequirementSpec) -> list[str]:
    """Return validation errors (empty = valid)."""
    errors: list[str] = []
    if not spec.title or spec.title == "Unknown opportunity":
        errors.append("title is missing — provide a call or challenge name")
    if not spec.criteria:
        errors.append("no criteria extracted — source text may be too sparse")
    if not spec.essential_criteria:
        errors.append("no essential criteria found — all criteria are desirable only")
    return errors
