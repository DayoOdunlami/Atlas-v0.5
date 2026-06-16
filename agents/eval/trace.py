"""
agents.eval.trace
=================

Full orchestrator eval trace export — one JSON object per run for
battery runners, LLM judges, and POST /eval/run.
"""
from __future__ import annotations

import time
import uuid
from typing import Any, Literal

Outcome = Literal["orient", "connect", "diagnose", "act", "defend"]


def run_orchestrator_eval(
    query: str,
    *,
    expected_outcome: Outcome | None = None,
    thread_id: str | None = None,
    include_quality: bool = True,
    include_judge: bool = False,
) -> dict[str, Any]:
    """
    Run triage → builder → verify → format and return a full eval trace.
    """
    from agents.orchestrator.triage import triage_query
    from agents.orchestrator.diagnose import run_value_translation_pipeline
    from agents.orchestrator.outcome_builders import build_outcome_model
    from agents.orchestrator.format_pass import run_format_pass
    from agents.orchestrator.reasoning_trace import steps_for_pipeline
    from agents.spine.verify import run_verify_spine

    run_id = str(uuid.uuid4())
    t0 = time.perf_counter()
    timings: dict[str, float] = {}

    t_triage = time.perf_counter()
    triage = triage_query(query)
    timings["triage_ms"] = round((time.perf_counter() - t_triage) * 1000, 1)

    path = "unknown"
    t_build = time.perf_counter()
    vt = run_value_translation_pipeline(query=query, outcome=triage.outcome)
    if vt is not None:
        model = vt
        path = "value_translation"
    elif triage.outcome in ("orient", "connect", "act", "defend", "diagnose"):
        model = build_outcome_model(query=query, outcome=triage.outcome, thread_id=thread_id)
        path = f"{triage.outcome}_builder"
    else:
        model = build_outcome_model(
            query=query,
            outcome=expected_outcome or "orient",
            thread_id=thread_id,
        )
        path = "fallback_orient"
    timings["build_ms"] = round((time.perf_counter() - t_build) * 1000, 1)

    t_verify = time.perf_counter()
    verified = run_verify_spine(
        artifact=model,
        query=query,
        headline=model.get("headline", ""),
        effort=triage.effort,
    )
    timings["verify_ms"] = round((time.perf_counter() - t_verify) * 1000, 1)

    t_format = time.perf_counter()
    formatted = run_format_pass(verified, query=query)
    timings["format_ms"] = round((time.perf_counter() - t_format) * 1000, 1)
    timings["total_ms"] = round((time.perf_counter() - t0) * 1000, 1)

    steps = steps_for_pipeline(outcome=triage.outcome, effort=triage.effort, path=path)
    formatted["reasoning_steps"] = steps

    quality: dict[str, Any] | None = None
    if include_quality:
        from agents.orchestrator.outcome_quality import score_render_model
        report = score_render_model(
            formatted,
            query=query,
            expected_outcome=expected_outcome,
        )
        quality = {
            "completeness": report.completeness,
            "evidence_alignment": report.evidence_alignment,
            "block_substance": report.block_substance,
            "matcher_integrity": report.matcher_integrity,
            "overall": report.overall,
            "passed": report.passed,
            "failures": report.failures,
            "passes": report.passes,
        }

    judge: dict[str, Any] | None = None
    if include_judge:
        from agents.eval.judge import judge_orchestrator_trace
        judge = judge_orchestrator_trace(formatted, query=query)

    render_blocks = formatted.get("render_blocks") or []
    block_types = [b.get("type") for b in render_blocks]

    return {
        "run_id": run_id,
        "query": query,
        "expected_outcome": expected_outcome,
        "triage": {
            "effort": triage.effort,
            "outcome": triage.outcome,
            "needs_gate": triage.needs_gate,
            "notes": triage.notes,
        },
        "pipeline_path": path,
        "timings_ms": timings,
        "render_model": formatted,
        "summary": {
            "outcome": formatted.get("outcome"),
            "confidence_tier": formatted.get("confidence_tier"),
            "render_mode": formatted.get("render_mode"),
            "citation_count": len(formatted.get("corpus_citations") or []),
            "block_types": block_types,
            "headline": formatted.get("headline"),
        },
        "trust_spine": {
            "citation_guard": formatted.get("citation_guard"),
            "artifact_qa": formatted.get("artifact_qa"),
            "falsification": formatted.get("falsification"),
        },
        "gap_signals": formatted.get("gap_signals") or [],
        "reasoning_steps": steps,
        "quality": quality,
        "judge": judge,
        "tools_called": [],  # populated when LLM loop is wired into eval path
    }
