"""
Sprint 5 — entity-centric object routing (offline heuristics).

Gated by ATLAS_OBJECT_ROUTING_V1. Does not replace turn-intent lanes or horsemen
routing for generic analyse-mode queries.
"""
from __future__ import annotations

import os
import re

_OBJECT_ENABLED = re.compile(r"^(1|true|yes)$", re.I)


def object_routing_enabled() -> bool:
    return bool(_OBJECT_ENABLED.match(os.getenv("ATLAS_OBJECT_ROUTING_V1", "").strip()))


_ORG_PROFILE = re.compile(
    r"show\s+me\s+.+\s+as\s+an\s+organisation|organisation\s+profile|organization\s+profile|"
    r"(?:profile|show)\s+(?:me\s+)?(?:cpc|connected\s+places)(?:\s+as)?",
    re.I,
)
_STAKEHOLDER_MAP = re.compile(
    r"stakeholder\s+map|stakeholder\s+network|who\s+are\s+the\s+stakeholders|"
    r"map\s+(?:the\s+)?stakeholders|stakeholders?\s+for\s+this\s+programme",
    re.I,
)
_PASSPORT = re.compile(
    r"passport\s+for|open\s+passport|entity\s+passport|show\s+(?:me\s+)?(?:the\s+)?passport",
    re.I,
)

# Horsemen / strategic analyse controls — must not object-route
_ANALYZE_CONTROL = re.compile(
    r"five\s+case|investment\s+brief|explore\s+(?:the\s+)?(?:uk\s+)?(?:cat|innovation)\s+landscape|"
    r"port\s+inspection\s+drones|npv\s+and\s+how\s+is\s+it\s+calculated",
    re.I,
)


def resolve_object_route(query: str) -> dict[str, str] | None:
    """
    Return { recipe, object_kind, visual_block_type? } or None.
    """
    if not object_routing_enabled():
        return None
    q = (query or "").strip()
    if not q or _ANALYZE_CONTROL.search(q):
        return None
    if _ORG_PROFILE.search(q):
        return {"recipe": "organisation_profile", "object_kind": "organisation"}
    if _STAKEHOLDER_MAP.search(q):
        return {
            "recipe": "organisation_profile",
            "object_kind": "stakeholder_map",
            "visual_block_type": "stakeholder_map",
        }
    if _PASSPORT.search(q):
        return {"recipe": "evidence_panel", "object_kind": "passport"}
    return None


def apply_object_recipe_override(query: str, primary: str, secondaries: list[str]) -> tuple[str, list[str], dict[str, str] | None]:
    """Override select_recipes() output when object routing matches."""
    route = resolve_object_route(query)
    if not route:
        return primary, secondaries, None
    recipe = route.get("recipe") or primary
    return recipe, [], route
