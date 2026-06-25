"""
GenUI quality eval — score turns without screenshots.

Scores compose/recipe/gate plus charts[] and trust v2 meta.

Run:
  python -m agents.atlas_v5.genui_eval
  python -m agents.atlas_v5.genui_eval --case swot_cpc
  python -m agents.atlas_v5.genui_eval --fixtures-only
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path

_root = Path(__file__).resolve().parent.parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from agents.atlas_v5.j1t1_corpus import J1T1_QUERY_PHRASE
from agents.atlas_v5.run_turn import run_turn_response

GOLDEN_RAIL_BU_QUERY = (
    "CPC Rail BU — state of play, SWOT, and funding reality in our corpus"
)


@dataclass
class GenUICase:
    id: str
    query: str
    expect_visual: bool = True
    expect_form: str | None = None  # swot | recipe | compose
    expect_charts_min: int = 0
    expect_chart_role: str | None = None
    expect_lead_lane: str | None = None
    min_score: int = 6


@dataclass
class GenUIResult:
    case_id: str
    query: str
    score: int
    max_score: int = 12
    passed: bool = False
    gate_status: str | None = None
    composition_mode: str | None = None
    has_merged_markup: bool = False
    has_recipe: bool = False
    recipe: str | None = None
    fallback_rung: str | None = None
    chart_count: int = 0
    chart_roles: list[str] = field(default_factory=list)
    lead_lane: str | None = None
    trust_conflicts: list[str] = field(default_factory=list)
    visual_suppressed: bool | None = None
    errors: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


CASES: list[GenUICase] = [
    GenUICase(
        id="golden_rail_bu",
        query=GOLDEN_RAIL_BU_QUERY,
        expect_visual=True,
        expect_form="swot",
        expect_charts_min=1,
        min_score=7,
    ),
    GenUICase(
        id="swot_cpc",
        query="Perform a SWOT analysis on CPC for me",
        expect_visual=True,
        expect_form="swot",
        expect_charts_min=1,
        min_score=7,
    ),
    GenUICase(
        id="swot_canvas",
        query="I asked you to perform a SWOT on CPC — show it on the canvas as a four quadrant chart",
        expect_visual=True,
        expect_form="swot",
        expect_charts_min=1,
        min_score=7,
    ),
    GenUICase(
        id="programme_scale_dual",
        query="Compare corpus funding floor to national rail programme scale",
        expect_visual=True,
        expect_form="compose",
        expect_charts_min=1,
        expect_chart_role="compare",
        min_score=6,
    ),
    GenUICase(
        id="rail_orient",
        query=J1T1_QUERY_PHRASE,
        expect_visual=True,
        expect_form="recipe",
        expect_charts_min=1,
        min_score=6,
    ),
    GenUICase(
        id="funder_bar",
        query="Show funding by funder breakdown in the corpus",
        expect_visual=True,
        expect_form="compose",
        expect_charts_min=1,
        min_score=6,
    ),
    GenUICase(
        id="journey_orient",
        query="State of play on rail decarbonisation in our corpus",
        expect_visual=True,
        expect_form="compose",
        expect_charts_min=1,
        min_score=6,
    ),
    GenUICase(
        id="temporal_line",
        query="Show project starts over time for rail decarbonisation in our corpus",
        expect_visual=True,
        expect_charts_min=1,
        expect_chart_role="temporal",
        min_score=5,
    ),
    GenUICase(
        id="theme_stack",
        query="Break down rail decarbonisation projects by transport mode and theme",
        expect_visual=True,
        expect_charts_min=1,
        expect_chart_role="theme_stack",
        min_score=5,
    ),
    GenUICase(
        id="maritime_orient",
        query="Which transport mode should we prioritise for decarbonisation?",
        expect_visual=True,
        expect_form="compose",
        min_score=4,
    ),
    GenUICase(
        id="network_connect",
        query="Map the hydrogen rail supply chain as a network",
        expect_visual=True,
        expect_form="recipe",
        min_score=5,
    ),
]


def _chart_blocks(spec: dict) -> list[dict]:
    charts = spec.get("charts") or []
    if charts:
        return [c for c in charts if isinstance(c, dict)]
    chart = spec.get("chart")
    if isinstance(chart, dict) and chart.get("option"):
        return [chart]
    return []


def score_payload(case: GenUICase, payload: dict) -> GenUIResult:
    result = GenUIResult(case_id=case.id, query=case.query, score=0)
    spec = payload.get("spec") or (payload.get("envelope") or {}).get("spec") or {}
    dev = payload.get("dev_meta") or {}
    canvas = spec.get("canvas") or {}
    instrument = spec.get("instrument") or {}

    merged = canvas.get("merged_markup") or ""
    result.has_merged_markup = bool(merged.strip())
    result.has_recipe = bool(instrument.get("recipe"))
    result.recipe = instrument.get("recipe")
    result.gate_status = dev.get("gate_status") or canvas.get("gate_status")
    result.fallback_rung = dev.get("fallback_rung")
    result.composition_mode = (dev.get("disposition") or {}).get("composition_mode")

    blocks = _chart_blocks(spec)
    result.chart_count = len(blocks)
    result.chart_roles = [
        str(c.get("role")) for c in blocks if c.get("role")
    ]
    result.lead_lane = dev.get("lead_lane")
    if not result.lead_lane:
        recon = spec.get("reconciliation") or {}
        retrieval = recon.get("retrieval") or {}
        result.lead_lane = retrieval.get("lead_lane")
    result.trust_conflicts = list(dev.get("trust_conflicts") or [])
    result.visual_suppressed = dev.get("visual_suppressed")

    score = 0

    if payload.get("update_canvas"):
        score += 1
        result.notes.append("canvas updated")
    else:
        result.errors.append("update_canvas=false")

    if result.has_merged_markup:
        score += 2
        result.notes.append("merged_markup present")
        if case.expect_form == "swot" and "swot" in merged.lower():
            score += 1
            result.notes.append("SWOT markup detected")
    elif result.has_recipe:
        score += 2 if case.expect_form == "recipe" else 1
        result.notes.append(f"recipe: {result.recipe}")

    if result.chart_count > 0:
        score += 2
        result.notes.append(f"charts={result.chart_count}")
        if case.expect_charts_min and result.chart_count >= case.expect_charts_min:
            score += 1
        if case.expect_chart_role and case.expect_chart_role in result.chart_roles:
            score += 1
            result.notes.append(f"role={case.expect_chart_role}")
    elif case.expect_charts_min > 0:
        result.errors.append(f"expected>={case.expect_charts_min} charts, got 0")

    if result.gate_status == "pass":
        score += 2
    elif result.gate_status == "fallback_recipe" and result.has_recipe:
        score += 1
    elif result.gate_status == "degrade_prose":
        score -= 2
        result.errors.append("degraded to prose-only")

    if result.fallback_rung == "prose" and case.expect_visual:
        score -= 1
        result.errors.append("fallback_rung=prose")

    if result.composition_mode == "free_compose" and result.has_merged_markup:
        score += 1

    if result.lead_lane:
        score += 1
        result.notes.append(f"lead_lane={result.lead_lane}")
        if case.expect_lead_lane and result.lead_lane == case.expect_lead_lane:
            score += 1

    if result.trust_conflicts:
        result.notes.append(f"conflicts={len(result.trust_conflicts)}")

    if result.visual_suppressed is True and case.expect_charts_min > 0:
        score -= 1
        result.errors.append("visual_suppressed=true")

    result.score = max(0, min(result.max_score, score))
    visual_ok = result.has_merged_markup or result.has_recipe or result.chart_count > 0
    charts_ok = (
        case.expect_charts_min <= 0 or result.chart_count >= case.expect_charts_min
    )
    result.passed = (
        result.score >= case.min_score
        and (not case.expect_visual or visual_ok)
        and charts_ok
    )
    return result


FIXTURE_CASES: dict[str, dict] = {
    "golden_rail_bu_fixture": {
        "update_canvas": True,
        "dev_meta": {
            "gate_status": "pass",
            "lead_lane": "balanced",
            "trust_conflicts": [],
            "visual_suppressed": False,
            "charts_attached": 2,
            "disposition": {"composition_mode": "free_compose"},
        },
        "spec": {
            "canvas": {
                "merged_markup": '<section data-testid="swot-quadrant">SWOT grid</section>',
                "gate_status": "pass",
            },
            "charts": [
                {"kind": "bar", "role": "ranking", "option": {"series": [{"data": [1]}]}},
                {"kind": "bar", "role": "distribution", "option": {"series": [{"data": [1]}]}},
            ],
            "reconciliation": {"retrieval": {"lead_lane": "balanced"}},
        },
    },
    "programme_scale_fixture": {
        "update_canvas": True,
        "dev_meta": {
            "gate_status": "pass",
            "lead_lane": "web",
            "trust_conflicts": ["stats.funding_floor_gbp"],
            "visual_suppressed": False,
        },
        "spec": {
            "charts": [
                {
                    "kind": "bar",
                    "role": "compare",
                    "option": {"series": [{"data": [1, 2]}]},
                }
            ],
        },
    },
}


def run_fixture_cases() -> list[GenUIResult]:
    results: list[GenUIResult] = []
    mapping = {
        "golden_rail_bu_fixture": GenUICase(
            id="golden_rail_bu_fixture",
            query=GOLDEN_RAIL_BU_QUERY,
            expect_form="swot",
            expect_charts_min=2,
            min_score=8,
        ),
        "programme_scale_fixture": GenUICase(
            id="programme_scale_fixture",
            query="compare corpus vs programme",
            expect_charts_min=1,
            expect_chart_role="compare",
            min_score=6,
        ),
    }
    for fid, payload in FIXTURE_CASES.items():
        case = mapping[fid]
        results.append(score_payload(case, payload))
    return results


async def run_case(case: GenUICase) -> GenUIResult:
    payload = await run_turn_response(case.query)
    return score_payload(case, payload)


async def run_all(case_ids: list[str] | None = None) -> list[GenUIResult]:
    selected = CASES
    if case_ids:
        selected = [c for c in CASES if c.id in case_ids]
    results: list[GenUIResult] = []
    for case in selected:
        try:
            results.append(await run_case(case))
        except Exception as exc:
            results.append(
                GenUIResult(
                    case_id=case.id,
                    query=case.query,
                    score=0,
                    passed=False,
                    errors=[str(exc)],
                )
            )
    return results


def print_report(results: list[GenUIResult]) -> int:
    passed = sum(1 for r in results if r.passed)
    print(f"\nGenUI eval: {passed}/{len(results)} passed\n")
    for r in results:
        status = "PASS" if r.passed else "FAIL"
        print(f"[{status}] {r.case_id}  score={r.score}/{r.max_score}")
        print(f"  query: {r.query[:70]}…")
        print(
            f"  gate={r.gate_status}  compose={r.composition_mode}  "
            f"markup={r.has_merged_markup}  recipe={r.recipe or '—'}  "
            f"charts={r.chart_count} roles={','.join(r.chart_roles) or '—'}"
        )
        print(
            f"  lead_lane={r.lead_lane or '—'}  conflicts={len(r.trust_conflicts)}  "
            f"suppressed={r.visual_suppressed}"
        )
        if r.notes:
            print(f"  + {'; '.join(r.notes)}")
        if r.errors:
            print(f"  - {'; '.join(r.errors)}")
        print()
    return 0 if passed == len(results) else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Atlas v5 GenUI eval")
    parser.add_argument("--case", action="append", dest="cases", help="Run specific case id")
    parser.add_argument("--json", action="store_true", help="JSON output")
    parser.add_argument(
        "--fixtures-only",
        action="store_true",
        help="Score deterministic fixtures (no API/DB)",
    )
    parser.add_argument("case_positional", nargs="*", help="Case ids (shorthand for --case)")
    args = parser.parse_args()
    case_ids = list(args.cases or [])
    case_ids.extend(args.case_positional)

    if args.fixtures_only:
        results = run_fixture_cases()
        if args.json:
            print(json.dumps([r.__dict__ for r in results], indent=2))
            return 0 if all(r.passed for r in results) else 1
        return print_report(results)

    if not os.getenv("ANTHROPIC_API_KEY"):
        print("WARNING: ANTHROPIC_API_KEY not set — deep pass may fall back to skeleton only")
    if not (os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")):
        print("WARNING: POSTGRES_URL not set — corpus stats may fail")

    results = asyncio.run(run_all(case_ids or None))
    if args.json:
        print(json.dumps([r.__dict__ for r in results], indent=2))
        return 0 if all(r.passed for r in results) else 1
    return print_report(results)


if __name__ == "__main__":
    raise SystemExit(main())
