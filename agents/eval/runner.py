"""
agents.eval.runner
==================

Phase B + D eval runners — battery and trajectory execution.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_BATTERY_PATH = _REPO_ROOT / "eval" / "orchestrator_battery.yaml"
_TRAJECTORY_PATH = _REPO_ROOT / "eval" / "orchestrator_trajectories.yaml"
_BASELINE_DIR = _REPO_ROOT / "eval" / "baselines"


def _load_yaml(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def run_single_eval(
    query: str,
    *,
    expected_outcome: str | None = None,
    include_judge: bool = True,
) -> dict[str, Any]:
    from agents.eval.trace import run_orchestrator_eval

    return run_orchestrator_eval(
        query,
        expected_outcome=expected_outcome,  # type: ignore[arg-type]
        include_quality=True,
        include_judge=include_judge,
    )


def run_battery_item(item: dict[str, Any], *, include_judge: bool = True) -> dict[str, Any]:
    """Run primary query + follow-ups for one battery item."""
    primary = run_single_eval(
        item["query"],
        expected_outcome=item.get("expected_outcome"),
        include_judge=include_judge,
    )
    follow_up_runs: list[dict[str, Any]] = []
    for fq in item.get("follow_ups") or []:
        follow_up_runs.append(
            run_single_eval(fq, expected_outcome=item.get("expected_outcome"), include_judge=include_judge)
        )
    passed = primary.get("quality", {}).get("passed", False)
    judge_passed = (primary.get("judge") or {}).get("passed", True)
    return {
        "id": item["id"],
        "domain": item.get("domain"),
        "query": item["query"],
        "expected_outcome": item.get("expected_outcome"),
        "primary": primary,
        "follow_ups": follow_up_runs,
        "passed": passed and judge_passed,
    }


def run_battery(
    *,
    include_judge: bool = True,
    limit: int | None = None,
    battery_path: Path | None = None,
) -> dict[str, Any]:
    """Run full 20-question battery."""
    data = _load_yaml(battery_path or _BATTERY_PATH)
    items = data["battery"]["items"]
    if limit:
        items = items[:limit]

    results: list[dict[str, Any]] = []
    for item in items:
        results.append(run_battery_item(item, include_judge=include_judge))

    n_pass = sum(1 for r in results if r["passed"])
    quality_scores = [
        r["primary"]["quality"]["overall"]
        for r in results
        if r["primary"].get("quality")
    ]
    judge_scores = [
        r["primary"]["judge"]["overall"]
        for r in results
        if r["primary"].get("judge")
    ]
    latencies = [r["primary"]["timings_ms"]["total_ms"] for r in results]

    aggregate = {
        "items_total": len(results),
        "items_passed": n_pass,
        "pass_rate": round(n_pass / max(len(results), 1), 3),
        "quality_mean": round(sum(quality_scores) / max(len(quality_scores), 1), 3),
        "judge_mean": round(sum(judge_scores) / max(len(judge_scores), 1), 3) if judge_scores else None,
        "latency_ms_mean": round(sum(latencies) / max(len(latencies), 1), 1),
        "latency_ms_p95": sorted(latencies)[int(len(latencies) * 0.95)] if latencies else 0,
    }

    return {
        "battery_version": data["battery"].get("version"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "aggregate": aggregate,
        "results": results,
    }


def run_trajectory(
    scenario: dict[str, Any],
    *,
    include_judge: bool = False,
    use_live_graph: bool = True,
) -> dict[str, Any]:
    """Run one multi-turn trajectory scenario."""
    import asyncio

    from agents.eval.chat_path import chat_result_to_eval_trace, run_workbench_graph_chat

    turn_results: list[dict[str, Any]] = []
    failures: list[str] = []
    thread_id = f"traj-{scenario.get('id', 'anon')}"

    async def _run_turns() -> None:
        nonlocal failures, turn_results
        for i, turn in enumerate(scenario.get("turns") or []):
            if use_live_graph:
                out = await run_workbench_graph_chat(
                    turn["query"],
                    thread_id=thread_id,
                )
                trace = chat_result_to_eval_trace(out, query=turn["query"])
            else:
                trace = run_single_eval(turn["query"], include_judge=include_judge)

            outcome = trace["summary"]["outcome"]
            block_types = set(trace["summary"]["block_types"])
            quality = trace.get("quality") or {}
            min_q = float(turn.get("min_quality", 0.6))
            turn_failures: list[str] = []

            if use_live_graph and out.get("is_conversational"):
                has_blocks = bool((trace.get("render_model") or {}).get("render_blocks"))
                if not has_blocks:
                    turn_failures.append(f"turn {i + 1}: routed to conversational not pipeline")

            expected_outcomes = turn.get("expect_outcome") or []
            if isinstance(expected_outcomes, str):
                expected_outcomes = [expected_outcomes]
            if expected_outcomes and outcome not in expected_outcomes:
                turn_failures.append(
                    f"turn {i + 1}: outcome {outcome} not in {expected_outcomes}"
                )

            for bt in turn.get("expect_blocks") or []:
                if bt not in block_types:
                    turn_failures.append(f"turn {i + 1}: missing block {bt}")

            if quality.get("overall", 0) < min_q:
                turn_failures.append(
                    f"turn {i + 1}: quality {quality.get('overall')} < {min_q}"
                )

            failures.extend(turn_failures)
            turn_results.append({
                "turn": i + 1,
                "query": turn["query"],
                "trace": trace,
                "passed": len(turn_failures) == 0,
            })

    asyncio.run(_run_turns())

    return {
        "id": scenario["id"],
        "name": scenario.get("name"),
        "turns": turn_results,
        "passed": len(failures) == 0,
        "failures": failures,
    }


def run_all_trajectories(
    *,
    include_judge: bool = False,
    trajectory_path: Path | None = None,
) -> dict[str, Any]:
    data = _load_yaml(trajectory_path or _TRAJECTORY_PATH)
    scenarios = data.get("trajectories") or []
    results = [run_trajectory(s, include_judge=include_judge) for s in scenarios]
    n_pass = sum(1 for r in results if r["passed"])
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scenarios_total": len(results),
        "scenarios_passed": n_pass,
        "pass_rate": round(n_pass / max(len(results), 1), 3),
        "results": results,
    }


def write_baseline_report(battery_report: dict[str, Any], *, label: str = "orchestrator") -> Path:
    """Write JSON baseline + markdown summary."""
    _BASELINE_DIR.mkdir(parents=True, exist_ok=True)
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    json_path = _BASELINE_DIR / f"{label}_{date}.json"
    md_path = _BASELINE_DIR / f"{label}_{date}.md"

    json_path.write_text(json.dumps(battery_report, indent=2, default=str), encoding="utf-8")

    agg = battery_report.get("aggregate", {})
    lines = [
        f"# Orchestrator eval baseline — {date}",
        "",
        f"- Items: **{agg.get('items_passed')}/{agg.get('items_total')}** passed ({agg.get('pass_rate', 0):.0%})",
        f"- Structural quality mean: **{agg.get('quality_mean')}**",
        f"- Judge mean: **{agg.get('judge_mean')}**",
        f"- Latency mean: **{agg.get('latency_ms_mean')} ms** (p95 {agg.get('latency_ms_p95')} ms)",
        "",
        "## Per-item",
        "",
        "| ID | Outcome | Quality | Judge | ms | Pass |",
        "|----|---------|---------|-------|-----|------|",
    ]
    for r in battery_report.get("results", []):
        p = r["primary"]
        q = (p.get("quality") or {}).get("overall", "-")
        j = (p.get("judge") or {}).get("overall", "-")
        ms = p.get("timings_ms", {}).get("total_ms", "-")
        lines.append(
            f"| {r['id']} | {p['summary']['outcome']} | {q} | {j} | {ms} | {'✓' if r['passed'] else '✗'} |"
        )
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return json_path
