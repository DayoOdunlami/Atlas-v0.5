#!/usr/bin/env python3
"""
Sprint 5 — Object routing unit tests (offline table-driven).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from agents.object_routing import (  # noqa: E402
    apply_object_recipe_override,
    object_routing_enabled,
    resolve_object_route,
)

PASS = "[PASS]"
FAIL = "[FAIL]"

CASES_ENABLED = [
    ("Show me CPC as an organisation", "organisation_profile", "organisation"),
    ("Organisation profile for Connected Places Catapult", "organisation_profile", "organisation"),
    ("Stakeholder map for this programme", "organisation_profile", "stakeholder_map"),
    ("Who are the stakeholders for the A14 pilot?", "organisation_profile", "stakeholder_map"),
    ("Map the stakeholders for autonomous freight", "organisation_profile", "stakeholder_map"),
    ("Passport for Acme Mobility Ltd", "evidence_panel", "passport"),
    ("Open passport for entity 42", "evidence_panel", "passport"),
    ("Show me the passport for this supplier", "evidence_panel", "passport"),
    ("Show me the GoShuttle passport", "evidence_panel", "passport"),
    ("give me a SWOT for GoShuttle X1", "evidence_panel", "swot"),
    ("SWOT analysis of Acme Mobility", "evidence_panel", "swot"),
]

CASES_DISABLED = [
    ("Explore UK CAT landscape", None),
    ("Build a Five Case investment brief for port inspection drones", None),
    ("What is NPV and how is it calculated?", None),
]

CONTROL_RECIPE = [
    ("Explore UK CAT landscape", "orient"),
    ("Build a Five Case investment brief for port inspection drones", "act"),
]


def check(label: str, ok: bool, note: str = "") -> bool:
    status = PASS if ok else FAIL
    print(f"  {status}  {label}" + (f"  [{note}]" if note else ""))
    return ok


def main() -> int:
    os.environ["ATLAS_OBJECT_ROUTING_V1"] = "true"
    ok = True
    print("Object routing (ATLAS_OBJECT_ROUTING_V1=true):")

    ok &= check("flag enabled", object_routing_enabled())

    for query, expected_recipe, expected_kind in CASES_ENABLED:
        route = resolve_object_route(query)
        ok &= check(
            f"{query[:48]}…" if len(query) > 48 else query,
            route is not None
            and route.get("recipe") == expected_recipe
            and route.get("object_kind") == expected_kind,
            f"got {route}",
        )

    for query, expected in CASES_DISABLED:
        route = resolve_object_route(query)
        ok &= check(
            f"no route: {query[:40]}",
            route == expected,
            f"got {route}",
        )

    from agents.visual_recipe_director import select_recipe  # noqa: E402

    for query, expected_horsemen in CONTROL_RECIPE:
        base = select_recipe(query)
        primary, secondaries, route = apply_object_recipe_override(query, base, [])
        ok &= check(
            f"horsemen preserved: {query[:36]}",
            route is None and primary == expected_horsemen,
            f"primary={primary} route={route}",
        )

    os.environ["ATLAS_OBJECT_ROUTING_V1"] = "false"
    ok &= check("disabled → no route", resolve_object_route("Show me CPC as an organisation") is None)

    print(f"\n{'All object routing checks passed.' if ok else 'Some checks failed.'}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
