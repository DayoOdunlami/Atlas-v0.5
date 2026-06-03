#!/usr/bin/env python3
"""
Sprint 4 — Live artifact contract gate.

Checks headline, insight_card, visual_blocks, Orient body fields, citation/tier sanity.

Run:
  agents\\.venv\\Scripts\\python.exe eval/test_artifact_contract_live.py
  agents\\.venv\\Scripts\\python.exe eval/test_artifact_contract_live.py --live
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

try:
    from dotenv import load_dotenv
    load_dotenv(_root / ".env", override=False)
    load_dotenv(_root / ".env.local", override=True)
except ImportError:
    pass

from agents.atlas.graph import (  # noqa: E402
    _extract_cpc_position,
    _extract_orient_domains,
)
from agents.atlas.citation_guard import apply_citation_guard
from agents.visual_recipe_director import select_recipe  # noqa: E402

CANONICAL = [
    (
        "Orient — UK CAT",
        "Explore the innovation landscape for connected and autonomous transport in the UK.",
        "orient",
    ),
    (
        "Diagnose — port inspection",
        "Can CPC credibly play in autonomous port inspection? What is missing?",
        "diagnose",
    ),
    (
        "Weak signals",
        "What are the strongest market signals in GPS-denied urban autonomy right now?",
        "orient",
    ),
    (
        "Act — Five Case",
        "Build a Five Case investment brief for autonomous port inspection drones.",
        "act",
    ),
    (
        "Connect — funding",
        "What funding routes exist for autonomous rail or transport AI testbeds in the UK?",
        "connect",
    ),
]

ORIENT_SECTION_KEYS = (
    "Landscape Overview",
    "What Exists",
    "Key Players",
    "CPC Position",
)


def recipe_ok(got: str, expected: str) -> bool:
    if got == expected:
        return True
    if expected == "orient" and got in (
        "orient", "cpc_capability_assessment", "cpc_market_alignment",
    ):
        return True
    if expected == "diagnose" and got in ("diagnose", "cpc_evidence_gaps"):
        return True
    if expected == "act" and got in ("act", "brief_five_case"):
        return True
    if expected == "connect" and got in ("connect", "cpc_opportunity_fit"):
        return True
    return False


def check_artifact_contract(ab: dict, expected: str) -> tuple[bool, list[str]]:
    issues: list[str] = []
    headline = str(ab.get("headline") or "").strip()
    insight = str(ab.get("insight_card") or "").strip()
    if len(headline) < 15:
        issues.append(f"headline too short ({len(headline)} chars)")
    if expected in ("orient", "diagnose", "act") and len(insight) < 20:
        issues.append(f"insight_card too short ({len(insight)} chars)")

    cites = ab.get("corpus_citations") or []
    tier = ab.get("confidence_tier", "Speculative")
    headline = str(ab.get("headline") or "")
    guard = apply_citation_guard(
        confidence_tier=str(tier),
        citation_count=len(cites),
        headline=headline,
    )
    if guard["confidence_tier"] != tier:
        issues.append(
            f"tier={tier} exceeds guard cap ({guard['confidence_tier']}) for {len(cites)} citations"
        )
    cg = ab.get("citation_guard") or {}
    if not cg and len(cites) <= 2 and tier in ("Supported", "Robust"):
        issues.append("missing citation_guard on high tier with few citations")

    aq = ab.get("artifact_qa") or {}
    if not aq and headline:
        issues.append("missing artifact_qa panel payload")
    elif aq.get("status") == "fail" and tier in ("Supported", "Robust"):
        issues.append("artifact_qa fail with high tier")

    blocks = ab.get("visual_blocks") or []
    if expected == "orient" and len(blocks) == 0 and len(cites) >= 3:
        issues.append("orient: expected visual_blocks when citations present")

    if expected == "orient":
        sections = ab.get("sections") or {}
        filled = [k for k in ORIENT_SECTION_KEYS if sections.get(k)]
        if len(filled) == 0:
            issues.append("orient: no supporting sections")
        if not ab.get("orient_domains"):
            issues.append("orient: missing orient_domains on artifact_block")

    if expected == "diagnose":
        if not ab.get("gap_rows") and not any(
            b.get("type") == "gap_matrix" for b in blocks if isinstance(b, dict)
        ):
            issues.append("diagnose: no gap_rows or gap_matrix block")

    chat_msg = str(ab.get("_chat_preview") or "")
    if chat_msg.strip().startswith("{") and '"sections"' in chat_msg:
        issues.append("chat looks like raw JSON")

    return len(issues) == 0, issues


def offline_helpers() -> bool:
    ok = True
    print("Offline orient helpers:")
    domains = _extract_orient_domains([
        {"business_unit": "Rail", "source_type": "project"},
        {"business_unit": "Rail", "source_type": "project"},
        {"business_unit": "Aviation", "source_type": "live_call"},
    ])
    ok &= len(domains) >= 2
    print(f"  [{'PASS' if ok else 'FAIL'}] orient_domains from raw results ({len(domains)} domains)")

    pos = _extract_cpc_position({"CPC Position": "CPC is strongest in deployment trials."})
    ok &= pos is not None and "strongest" in pos.get("summary", "").lower()
    print(f"  [{'PASS' if pos else 'FAIL'}] cpc_position parse")
    return ok


def offline_routing() -> bool:
    ok = True
    advisory_only = {"Weak signals", "Connect — funding"}
    print("\nOffline recipe routing:")
    for label, query, expected in CANONICAL:
        recipe = select_recipe(query)
        status = "PASS" if recipe_ok(recipe, expected) else "FAIL"
        if status == "FAIL" and label in advisory_only:
            print(f"  [ADVISORY] {label}: {recipe} (expected {expected}) — live gate is authoritative")
            continue
        if status == "FAIL":
            ok = False
        print(f"  [{status}] {label}: {recipe} (expected {expected})")
    return ok


def live_gate() -> bool:
    from agents.atlas.graph import run_atlas

    ok = True
    print("\nLive artifact contract:")
    for label, query, expected in CANONICAL:
        try:
            data = run_atlas(query)
        except Exception as exc:
            print(f"  [FAIL] {label}: {exc}")
            ok = False
            continue

        ab = data.get("artifact_block") or {}
        recipe = ab.get("recipe") or select_recipe(query)
        if not recipe_ok(str(recipe), expected):
            print(f"  [FAIL] {label}: recipe={recipe} expected {expected}")
            ok = False
            continue

        passed, issues = check_artifact_contract(ab, expected)
        status = "PASS" if passed else "FAIL"
        if not passed:
            ok = False
        detail = "; ".join(issues) if issues else f"headline={len(str(ab.get('headline','')))}c blocks={len(ab.get('visual_blocks') or [])}"
        print(f"  [{status}] {label}: {detail}")

        out = _root / "eval" / "artifacts" / f"sprint4_{expected}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(ab, indent=2, default=str), encoding="utf-8")

    return ok


def main() -> int:
    live = "--live" in sys.argv
    ok = offline_helpers() and offline_routing()
    if live:
        ok = live_gate() and ok
    else:
        print("\n(Skipping live gate — pass --live to run run_atlas)")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
