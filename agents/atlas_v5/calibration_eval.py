"""
Increment 1B-eval — practitioner calibration with graded diagnosis.

Runs five fixed calibration turns through the live brain, then grades each transcript
with a pinned LLM director (or heuristic fallback). Output is pre-triage for human read.

Run:
  python -m agents.atlas_v5.calibration_eval
  python -m agents.atlas_v5.calibration_eval --case cal_03_lost_rail
  python -m agents.atlas_v5.calibration_eval --json --out eval/baselines/calibration_latest.json

Env:
  ANTHROPIC_API_KEY          — required for live turns + LLM grader
  CALIBRATION_GRADER_MODEL   — default claude-sonnet-4-6
  EVAL_HEURISTIC_JUDGE_ONLY  — skip LLM grader (structural proxy only)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import uuid
from pathlib import Path
from typing import Any

_root = Path(__file__).resolve().parent.parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

try:
    from dotenv import load_dotenv

    load_dotenv(_root / ".env.local", override=True)
    load_dotenv(_root / "agents" / ".env", override=False)
    load_dotenv(_root / ".env", override=False)
except ImportError:
    pass

from agents.atlas_v5.calibration_rubric import (
    CALIBRATION_CASES,
    PRACTITIONER_AGENT_ID,
    CalibrationCase,
)
from agents.atlas_v5.case_file import default_thread_id, load_case_file
from agents.atlas_v5.run_turn import run_turn_response
from agents.eval.behavioral_grader import (
    BehavioralGradeResult,
    grade_turn,
)


def reset_case_file(thread_id: str) -> None:
    import agents.atlas_v5.case_file as cf

    tid = default_thread_id(thread_id)
    cf._MEMORY.pop(tid, None)


def _spec_excerpt(payload: dict[str, Any]) -> dict[str, Any]:
    spec = payload.get("spec") or {}
    canvas = spec.get("canvas") or {}
    instrument = spec.get("instrument") or {}
    recon = spec.get("reconciliation") or {}
    retrieval = recon.get("retrieval") or {}
    markup = canvas.get("merged_markup") or ""
    return {
        "tier": spec.get("tier"),
        "verdict": (spec.get("verdict") or {}).get("sentence"),
        "recipe": instrument.get("recipe"),
        "composition_mode": instrument.get("composition_mode"),
        "declared_in_markup": 'data-testid="declared-situation"' in markup
        or 'data-material="declared"' in markup,
        "markup_preview": markup[:1200] if markup else None,
        "corpus_citation_count": len(spec.get("corpus_citations") or []),
        "retrieval_meta": {
            k: retrieval.get(k)
            for k in (
                "lane_mode",
                "corpus_count",
                "external_count",
                "dual_peer",
                "corpus_substantive",
                "web_substantive",
                "tier_reason",
                "reconcile_lead",
            )
            if retrieval.get(k) is not None
        },
    }


def _turn_record(query: str, payload: dict[str, Any]) -> dict[str, Any]:
    dev = payload.get("dev_meta") or {}
    disposition = dev.get("disposition") or {}
    return {
        "query": query,
        "reply": payload.get("reply"),
        "route": payload.get("route"),
        "route_source": payload.get("route_source"),
        "outcome_hint": payload.get("outcome_hint"),
        "update_canvas": payload.get("update_canvas"),
        "disposition": disposition,
        "lane_mode": dev.get("lane_mode"),
        "gate_status": dev.get("gate_status"),
        "spec_excerpt": _spec_excerpt(payload),
    }


def _followup_references_declared(reply: str, case_file: list[dict[str, Any]]) -> bool:
    if not reply or not case_file:
        return False
    lower = reply.lower()
    for claim in case_file:
        text = str(claim.get("text") or "").lower()
        if len(text) >= 12 and text[:40] in lower:
            return True
        for token in ("rail", "sme", "funding", "partner", "uncertain", "idea"):
            if token in text and token in lower:
                return True
    return False


def extract_structural_signals(
    case: CalibrationCase,
    *,
    thread_id: str,
    turns: list[dict[str, Any]],
    follow_up_payload: dict[str, Any] | None,
    case_file_after: list[dict[str, Any]],
) -> dict[str, Any]:
    primary = turns[-1] if turns else {}
    spec_ex = primary.get("spec_excerpt") or {}
    recon_retrieval = spec_ex.get("retrieval_meta") or {}

    signals: dict[str, Any] = {
        "case_id": case.id,
        "thread_id": thread_id,
        "route": primary.get("route"),
        "route_source": primary.get("route_source"),
        "outcome_hint": primary.get("outcome_hint"),
        "update_canvas": primary.get("update_canvas"),
        "recipe": spec_ex.get("recipe"),
        "declared_in_markup": spec_ex.get("declared_in_markup"),
        "lane_mode": primary.get("lane_mode") or recon_retrieval.get("lane_mode"),
        "corpus_count": recon_retrieval.get("corpus_count"),
        "external_count": recon_retrieval.get("external_count"),
        "case_file_count": len(case_file_after),
        "case_file_kinds": [c.get("kind") for c in case_file_after],
        "follow_up_ran": follow_up_payload is not None,
    }

    if follow_up_payload:
        fu_reply = str(follow_up_payload.get("reply") or "")
        signals["followup_references_prior_declared"] = _followup_references_declared(
            fu_reply,
            case_file_after,
        )

    disposition = primary.get("disposition") or {}
    signals["canvas_action"] = disposition.get("canvas_action")
    signals["primary_surface"] = disposition.get("primary_surface")
    return signals


def build_transcript_pack(
    case: CalibrationCase,
    *,
    thread_id: str,
    turn_records: list[dict[str, Any]],
    case_file_after: list[dict[str, Any]],
    prior_case_file: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "case_id": case.id,
        "case_label": case.label,
        "thread_id": thread_id,
        "prior_queries": case.prior_queries,
        "follow_up_query": case.follow_up_query,
        "turns": turn_records,
        "case_file_before": prior_case_file,
        "case_file_after": case_file_after,
    }


async def execute_calibration_case(case: CalibrationCase) -> BehavioralGradeResult:
    thread_id = f"cal-{case.id}-{uuid.uuid4().hex[:8]}"
    reset_case_file(thread_id)

    current_spec: dict[str, Any] | None = None
    prior_dev_meta: dict[str, Any] | None = None
    turn_records: list[dict[str, Any]] = []

    for prior_q in case.prior_queries:
        payload = await run_turn_response(
            prior_q,
            thread_id=thread_id,
            current_spec=current_spec,
            prior_dev_meta=prior_dev_meta,
        )
        turn_records.append(_turn_record(prior_q, payload))
        if payload.get("spec"):
            current_spec = payload["spec"]
        prior_dev_meta = payload.get("dev_meta")

    prior_case_file = [
        {"id": c.id, "text": c.text, "kind": c.kind}
        for c in load_case_file(thread_id)
    ]

    payload = await run_turn_response(
        case.query,
        thread_id=thread_id,
        current_spec=current_spec,
        prior_dev_meta=prior_dev_meta,
    )
    turn_records.append(_turn_record(case.query, payload))
    if payload.get("spec"):
        current_spec = payload["spec"]
    prior_dev_meta = payload.get("dev_meta")

    follow_up_payload: dict[str, Any] | None = None
    if case.follow_up_query:
        follow_up_payload = await run_turn_response(
            case.follow_up_query,
            thread_id=thread_id,
            current_spec=current_spec,
            prior_dev_meta=prior_dev_meta,
        )
        turn_records.append(_turn_record(case.follow_up_query, follow_up_payload))

    case_file_after = [
        {"id": c.id, "text": c.text, "kind": c.kind, "source": c.source}
        for c in load_case_file(thread_id)
    ]

    structural = extract_structural_signals(
        case,
        thread_id=thread_id,
        turns=turn_records,
        follow_up_payload=follow_up_payload,
        case_file_after=case_file_after,
    )
    transcript = build_transcript_pack(
        case,
        thread_id=thread_id,
        turn_records=turn_records,
        case_file_after=case_file_after,
        prior_case_file=prior_case_file,
    )

    return grade_turn(
        agent_id=PRACTITIONER_AGENT_ID,
        case_id=case.id,
        case_label=case.label,
        rubric=case.rubric,
        transcript=transcript,
        structural_signals=structural,
    )


async def run_all(case_ids: list[str] | None = None) -> list[BehavioralGradeResult]:
    selected = CALIBRATION_CASES
    if case_ids:
        selected = [c for c in CALIBRATION_CASES if c.id in case_ids]
    results: list[BehavioralGradeResult] = []
    for case in selected:
        try:
            results.append(await execute_calibration_case(case))
        except Exception as exc:
            from agents.eval.behavioral_grader import GradedCriterion, TurnSwot

            broken = BehavioralGradeResult(
                agent_id=PRACTITIONER_AGENT_ID,
                case_id=case.id,
                method="heuristic",
                model=None,
                criteria=[
                    GradedCriterion(
                        id="execution_error",
                        layer="routing",
                        score=0,
                        reason=str(exc),
                    )
                ],
                turn_swot=TurnSwot(
                    weaknesses=[str(exc)],
                    threats=["Turn failed before grader — fix infra first"],
                ),
                diagnosis=f"execution failure — {exc}",
                verdict="broken",
                note=str(exc),
            )
            results.append(broken)
    return results


def _result_to_dict(result: BehavioralGradeResult) -> dict[str, Any]:
    return {
        "agent_id": result.agent_id,
        "case_id": result.case_id,
        "method": result.method,
        "model": result.model,
        "verdict": result.verdict,
        "grader_verdict": result.grader_verdict,
        "diagnosis": result.diagnosis,
        "criteria": [c.model_dump() for c in result.criteria],
        "turn_swot": result.turn_swot.model_dump(),
        "structural_signals": result.structural_signals,
        "note": result.note,
        "llm_error": result.llm_error,
    }


def print_report(results: list[BehavioralGradeResult]) -> int:
    ship = sum(1 for r in results if r.verdict == "ship")
    tune = sum(1 for r in results if r.verdict == "tune")
    broken = sum(1 for r in results if r.verdict == "broken")

    print(
        f"\nCalibration eval ({PRACTITIONER_AGENT_ID}): "
        f"ship={ship} tune={tune} broken={broken} / {len(results)}\n"
    )

    for r in results:
        tag = r.verdict.upper()
        method = r.method + (f" ({r.model})" if r.model else "")
        print(f"[{tag}] {r.case_id}  grader={method}")
        print(f"  diagnosis: {r.diagnosis}")
        if r.grader_verdict and r.grader_verdict != r.verdict:
            print(f"  grader suggested: {r.grader_verdict} → computed: {r.verdict}")
        if r.note:
            print(f"  note: {r.note}")

        print("  criteria:")
        for c in r.criteria:
            print(f"    [{c.score}/3] {c.id} ({c.layer}): {c.reason[:120]}")

        swot = r.turn_swot
        if swot.strengths:
            print(f"  strengths: {'; '.join(swot.strengths[:2])}")
        if swot.weaknesses:
            print(f"  weaknesses: {'; '.join(swot.weaknesses[:2])}")
        if swot.opportunities:
            print(f"  opportunities: {'; '.join(swot.opportunities[:2])}")
        if swot.threats:
            print(f"  threats: {'; '.join(swot.threats[:2])}")
        print()

    return 0 if broken == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Atlas v5 practitioner calibration eval")
    parser.add_argument("--case", action="append", dest="cases", help="Run specific case id")
    parser.add_argument("--json", action="store_true", help="JSON output")
    parser.add_argument("--out", help="Write JSON report to path")
    parser.add_argument(
        "--heuristic-only",
        action="store_true",
        help="Skip LLM grader (structural proxy only)",
    )
    parser.add_argument("case_positional", nargs="*", help="Case ids (shorthand)")
    args = parser.parse_args()

    case_ids = list(args.cases or [])
    case_ids.extend(args.case_positional)

    if args.heuristic_only:
        os.environ["EVAL_HEURISTIC_JUDGE_ONLY"] = "1"

    if not os.getenv("ANTHROPIC_API_KEY"):
        print("WARNING: ANTHROPIC_API_KEY not set — live turns may skeleton; grader heuristic-only")
    if not (os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")):
        print("WARNING: POSTGRES_URL not set — corpus retrieval may be thin")

    results = asyncio.run(run_all(case_ids or None))

    if args.json or args.out:
        payload = {
            "agent_id": PRACTITIONER_AGENT_ID,
            "results": [_result_to_dict(r) for r in results],
            "summary": {
                "ship": sum(1 for r in results if r.verdict == "ship"),
                "tune": sum(1 for r in results if r.verdict == "tune"),
                "broken": sum(1 for r in results if r.verdict == "broken"),
            },
        }
        text = json.dumps(payload, indent=2)
        if args.out:
            out_path = Path(args.out)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(text + "\n", encoding="utf-8")
            print(f"Wrote {out_path}")
        if args.json:
            print(text)
        return 0 if payload["summary"]["broken"] == 0 else 1

    return print_report(results)


if __name__ == "__main__":
    raise SystemExit(main())
