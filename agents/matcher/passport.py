"""
agents.matcher.passport
=======================

Entity Passport schema + extraction helpers (Phase 3, ADR-0001).

A Passport is a structured capability profile for an entity (CPC project,
innovation, product) that can be matched against a Requirement Spec.

This module extends the existing passport_loader.py with:
  - A typed PassportSchema dataclass
  - load_entity_passport() — loads + normalises from Supabase OR infers
    from corpus search results when no Supabase passport exists
  - validate_passport() — checks completeness for the matcher

DB source: atlas.passports + atlas.passport_claims (existing schema)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class PassportClaim:
    """A single evidence claim attached to a passport."""

    domain: str
    """Capability domain (e.g. 'data infrastructure', 'transport modelling')."""

    text: str
    """Claim text — one sentence describing the capability."""

    confidence_tier: str
    """Speculative | Indicative | Supported | Robust."""

    role: str
    """primary | supporting | context."""

    corpus_citation_id: str | None = None
    """atlas.projects.id that backs this claim, if known."""


@dataclass
class Passport:
    """Structured capability profile for one entity."""

    entity_name: str
    owner_org: str = ""
    sector_origin: str = ""
    sector_target: str = ""
    summary: str = ""
    trl_level: int | None = None
    claims: list[PassportClaim] = field(default_factory=list)
    passport_id: str | None = None
    """atlas.passports.id — None when inferred from corpus, not from DB."""

    @property
    def capability_domains(self) -> list[str]:
        return sorted({c.domain for c in self.claims if c.domain})

    @property
    def strong_claims(self) -> list[PassportClaim]:
        return [c for c in self.claims if c.confidence_tier in ("Supported", "Robust")]

    @property
    def overall_tier(self) -> str:
        tiers = {"Robust": 3, "Supported": 2, "Indicative": 1, "Speculative": 0}
        if not self.claims:
            return "Speculative"
        max_tier = max((tiers.get(c.confidence_tier, 0) for c in self.claims), default=0)
        return {3: "Robust", 2: "Supported", 1: "Indicative", 0: "Speculative"}[max_tier]


def load_entity_passport(entity_name: str) -> dict[str, Any]:
    """
    Load an entity passport from Supabase atlas.passports.

    Falls back gracefully if the DB is unavailable.
    Returns a dict compatible with the tool schema (for use as a @tool result).
    """
    try:
        from agents.passport_loader import load_passport_for_query
        result = load_passport_for_query(entity_name)
        if result:
            return result
    except Exception:
        pass

    # Minimal fallback
    return {
        "passport_id": None,
        "title": entity_name,
        "project_name": entity_name,
        "owner_org": "",
        "trl_level": None,
        "sector_origin": "",
        "sector_target": "",
        "summary": f"No passport found for '{entity_name}' in atlas.passports.",
        "claims": [],
    }


def dict_to_passport(data: dict[str, Any]) -> Passport:
    """Convert a passport dict (from DB or tool result) to a typed Passport."""
    claims = [
        PassportClaim(
            domain=c.get("domain") or c.get("claim_domain") or "",
            text=c.get("text") or c.get("claim_text") or "",
            confidence_tier=c.get("confidence_tier", "Speculative"),
            role=c.get("role") or c.get("claim_role") or "supporting",
            corpus_citation_id=c.get("corpus_citation_id"),
        )
        for c in (data.get("claims") or [])
    ]
    return Passport(
        entity_name=data.get("title") or data.get("project_name") or "",
        owner_org=data.get("owner_org") or "",
        sector_origin=data.get("sector_origin") or "",
        sector_target=data.get("sector_target") or "",
        summary=data.get("summary") or "",
        trl_level=data.get("trl_level"),
        claims=claims,
        passport_id=data.get("passport_id"),
    )


def validate_passport(passport: Passport) -> list[str]:
    """Return validation errors (empty = valid)."""
    errors: list[str] = []
    if not passport.entity_name:
        errors.append("entity_name is required")
    if not passport.summary:
        errors.append("summary is empty — passport may be uninformative")
    if not passport.claims:
        errors.append("no claims — passport has no capability evidence")
    return errors
