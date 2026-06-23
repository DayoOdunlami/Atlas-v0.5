#!/usr/bin/env python3
"""Phase 0–1 session contract tests — turn lanes, merge, decision spine, connect routing."""
from __future__ import annotations

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from agents.orchestrator.context import merge_render_models, build_artifact_summary
from agents.orchestrator.decision_spine import ensure_decision_spine
from agents.orchestrator.diagnose import should_run_value_translation
from agents.orchestrator.turn_lanes import classify_turn_lane

PASS = "[PASS]"
FAIL = "[FAIL]"


def check(label: str, ok: bool, note: str = "") -> bool:
    status = PASS if ok else FAIL
    print(f"  {status}  {label}" + (f"  [{note}]" if note else ""))
    return ok


def main() -> int:
    ok = True
    print("Turn lanes:")
    ok &= check("cold -> analyze", classify_turn_lane("SWOT for CPC rail", has_prior=False) == "analyze")
    ok &= check("explain NPV -> clarify", classify_turn_lane("What is NPV?", has_prior=True) == "clarify")
    ok &= check("refine headline", classify_turn_lane("Sharpen the headline", has_prior=True) == "refine")
    ok &= check("five case -> analyze", classify_turn_lane("Give me a Five Case brief", has_prior=True) == "analyze")
    ok &= check(
        "artifact not updating -> clarify",
        classify_turn_lane("Why isn't the artifact updating?", has_prior=True) == "clarify",
    )
    ok &= check(
        "blockers vs reframes -> clarify",
        classify_turn_lane("Which gaps are blockers versus reframes?", has_prior=True) == "clarify",
    )

    print("Merge / replace:")
    prior = {"outcome": "orient", "headline": "Old", "blocks_data": {"a": {}}}
    new = {"outcome": "act", "headline": "New", "blocks_data": {"b": {}}}
    merged = merge_render_models(prior, new, outcome="act")
    ok &= check("outcome change replaces", merged["headline"] == "New" and "b" in merged["blocks_data"])
    same = merge_render_models(prior, {"outcome": "orient", "headline": "Fresh"}, outcome="orient")
    ok &= check("same outcome replaces blocks", same["headline"] == "Fresh")

    print("Decision spine:")
    model = ensure_decision_spine({
        "outcome": "connect",
        "headline": "Top routes",
        "insight_card": "Three live calls match.",
        "confidence_tier": "Indicative",
        "corpus_citations": [{"id": "x"}],
    })
    spine = model.get("decision_spine") or {}
    ok &= check("spine injected", bool(spine.get("recommendation")))
    ok &= check("blocks_data spine", "decision_spine" in (model.get("blocks_data") or {}))
    ok &= check("next_action present", bool(spine.get("next_action")))

    print("Connect vs VT routing:")
    ok &= check(
        "opportunity routes skip VT",
        not should_run_value_translation(
            "connect",
            "What are the top opportunity routes for CPC in rail?",
        ),
    )
    ok &= check(
        "transfer evidence runs VT",
        should_run_value_translation(
            "connect",
            "What evidence does CPC have in smart mobility that would transfer to Innovate UK?",
        ),
    )
    ok &= check("diagnose generic skips VT", not should_run_value_translation("diagnose", "find corpus evidence for rail inspection"))
    ok &= check(
        "diagnose transfer runs VT",
        should_run_value_translation(
            "diagnose",
            "What evidence gaps transfer to Innovate UK Smart City Challenge?",
        ),
    )

    ok &= check(
        "opportunity triage -> connect",
        __import__("agents.orchestrator.triage", fromlist=["triage_query"]).triage_query(
            "What are the top opportunity routes for CPC in rail?"
        ).outcome
        == "connect",
    )
    ok &= check(
        "five case triage no gate",
        __import__("agents.orchestrator.triage", fromlist=["triage_query"]).triage_query(
            "Give me a Five Case investment brief for rail"
        ).needs_gate
        is False,
    )
    summary = build_artifact_summary({
        "headline": "H",
        "outcome": "orient",
        "confidence_tier": "Indicative",
        "blocks_data": {"executive_summary": {"summary": "Exec"}},
    })
    ok &= check("summary fields", summary.get("headline") == "H" and "Exec" in summary.get("executive_summary", ""))

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
