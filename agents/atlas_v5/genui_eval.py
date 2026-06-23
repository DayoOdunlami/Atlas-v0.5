"""
GenUI quality eval — score turns without screenshots.

Run:
  python -m agents.atlas_v5.genui_eval
  python -m agents.atlas_v5.genui_eval --case swot_cpc
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


@dataclass
class GenUICase:
    id: str
    query: str
    expect_visual: bool = True
    expect_form: str | None = None  # swot | recipe | compose
    min_score: int = 4


@dataclass
class GenUIResult:
    case_id: str
    query: str
    score: int
    max_score: int = 7
    passed: bool = False
    gate_status: str | None = None
    composition_mode: str | None = None
    has_merged_markup: bool = False
    has_recipe: bool = False
    recipe: str | None = None
    fallback_rung: str | None = None
    errors: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


CASES: list[GenUICase] = [
    GenUICase(
        id="swot_cpc",
        query="Perform a SWOT analysis on CPC for me",
        expect_visual=True,
        expect_form="swot",
        min_score=5,
    ),
    GenUICase(
        id="swot_canvas",
        query="I asked you to perform a SWOT on CPC — show it on the canvas as a four quadrant chart",
        expect_visual=True,
        expect_form="swot",
        min_score=5,
    ),
    GenUICase(
        id="rail_orient",
        query=J1T1_QUERY_PHRASE,
        expect_visual=True,
        expect_form="recipe",
        min_score=4,
    ),
    GenUICase(
        id="funder_bar",
        query="Show funding by funder breakdown in the corpus",
        expect_visual=True,
        expect_form="compose",
        min_score=4,
    ),
    GenUICase(
        id="journey_orient",
        query="State of play on rail decarbonisation in our corpus",
        expect_visual=True,
        expect_form="compose",
        min_score=4,
    ),
    GenUICase(
        id="maritime_orient",
        query="Which transport mode should we prioritise for decarbonisation?",
        expect_visual=True,
        expect_form="compose",
        min_score=3,
    ),
    GenUICase(
        id="network_connect",
        query="Map the hydrogen rail supply chain as a network",
        expect_visual=True,
        expect_form="recipe",
        min_score=4,
    ),
]


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

    score = 0

    if payload.get("update_canvas"):
        score += 1
        result.notes.append("canvas updated")
    else:
        result.errors.append("update_canvas=false")

    if result.has_merged_markup:
        score += 3
        result.notes.append("merged_markup present")
        if case.expect_form == "swot" and "swot" in merged.lower():
            score += 1
            result.notes.append("SWOT markup detected")
    elif result.has_recipe:
        score += 3 if case.expect_form == "recipe" else 2
        result.notes.append(f"recipe: {result.recipe}")

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

    result.score = max(0, min(result.max_score, score))
    result.passed = result.score >= case.min_score and (
        not case.expect_visual or result.has_merged_markup or result.has_recipe
    )
    return result


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
                    max_score=7,
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
            f"markup={r.has_merged_markup}  recipe={r.recipe or '—'}"
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
    parser.add_argument("case_positional", nargs="*", help="Case ids (shorthand for --case)")
    args = parser.parse_args()
    case_ids = list(args.cases or [])
    case_ids.extend(args.case_positional)

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
