"""
Atlas v5 multi-turn session trajectories — inject queries without a browser.

Same state threading as /atlas/session (thread_id, current_spec, prior_dev_meta).

Run:
  python eval/run_atlas_v5_trajectories.py
  python eval/run_atlas_v5_trajectories.py --id V02_rail_orient_followup
  python eval/run_atlas_v5_trajectories.py --json --out eval/baselines/v5_trajectories.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_DEFAULT_YAML = _REPO_ROOT / "eval" / "atlas_v5_trajectories.yaml"


@dataclass
class TurnResult:
    turn: int
    query: str
    passed: bool
    failures: list[str] = field(default_factory=list)
    route: str | None = None
    update_canvas: bool | None = None
    latency_ms: float = 0.0
    reply_preview: str = ""
    lane_mode: str | None = None
    spec_recipe: str | None = None
    spec_mode: str | None = None


@dataclass
class TrajectoryResult:
    id: str
    name: str
    passed: bool
    skipped: bool = False
    skip_reason: str = ""
    turns: list[TurnResult] = field(default_factory=list)
    failures: list[str] = field(default_factory=list)


def _load_yaml(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _as_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    return [str(v) for v in value]


def _check_expect(payload: dict[str, Any], expect: dict[str, Any], latency_ms: float) -> list[str]:
    failures: list[str] = []
    route = payload.get("route")
    reply = str(payload.get("reply") or "")
    dev_meta = payload.get("dev_meta") or {}
    spec = payload.get("spec") or {}

    expected_routes = _as_list(expect.get("route"))
    if expected_routes and route not in expected_routes:
        failures.append(f"route {route!r} not in {expected_routes}")

    if "update_canvas" in expect:
        want = bool(expect["update_canvas"])
        got = bool(payload.get("update_canvas"))
        if got != want:
            failures.append(f"update_canvas expected {want}, got {got}")

    max_lat = expect.get("max_latency_ms")
    if max_lat is not None and latency_ms > float(max_lat):
        failures.append(f"latency {latency_ms:.0f}ms > max {max_lat}ms")

    min_chars = expect.get("min_reply_chars")
    if min_chars is not None and len(reply.strip()) < int(min_chars):
        failures.append(f"reply length {len(reply.strip())} < min {min_chars}")

    for phrase in _as_list(expect.get("reply_not_contains")):
        if phrase.lower() in reply.lower():
            failures.append(f"reply must not contain {phrase!r}")

    for phrase in _as_list(expect.get("reply_contains")):
        if phrase.lower() not in reply.lower():
            failures.append(f"reply must contain {phrase!r}")

    lane_mode = expect.get("lane_mode")
    if lane_mode is not None:
        got_lane = dev_meta.get("lane_mode")
        if got_lane != lane_mode:
            failures.append(f"lane_mode expected {lane_mode!r}, got {got_lane!r}")

    expected_outcomes = _as_list(expect.get("outcome_hint"))
    if expected_outcomes:
        got_outcome = payload.get("outcome_hint") or dev_meta.get("outcome_hint")
        if got_outcome not in expected_outcomes:
            failures.append(f"outcome_hint {got_outcome!r} not in {expected_outcomes}")

    spec_expect = expect.get("spec") or {}
    if spec_expect.get("has_verdict") and not (spec.get("verdict") or {}).get("sentence"):
        failures.append("spec missing verdict.sentence")

    min_tier = spec_expect.get("min_tier")
    if min_tier:
        tier_order = ["Speculative", "Indicative", "Supported", "Robust"]
        got = spec.get("tier")
        if got not in tier_order:
            failures.append(f"spec tier missing or invalid: {got!r}")
        elif tier_order.index(got) < tier_order.index(str(min_tier)):
            failures.append(f"spec tier {got} below min {min_tier}")

    max_tier = spec_expect.get("max_tier")
    if max_tier:
        tier_order = ["Speculative", "Indicative", "Supported", "Robust"]
        got = spec.get("tier")
        if got not in tier_order:
            failures.append(f"spec tier missing or invalid: {got!r}")
        elif tier_order.index(got) > tier_order.index(str(max_tier)):
            failures.append(f"spec tier {got} above max {max_tier}")

    max_charts = spec_expect.get("max_charts")
    if max_charts is not None:
        chart_count = len(spec.get("charts") or [])
        if spec.get("chart") is not None and chart_count == 0:
            chart_count = 1
        if chart_count > int(max_charts):
            failures.append(f"spec charts {chart_count} > max {max_charts}")

    scope_contains = spec_expect.get("scope_contains")
    if scope_contains:
        scope = str(spec.get("scope") or "")
        if str(scope_contains).upper() not in scope.upper():
            failures.append(f"spec.scope must contain {scope_contains!r}, got {scope!r}")

    mode_expect = spec_expect.get("mode")
    if mode_expect and str(spec.get("mode")) != str(mode_expect):
        failures.append(f"spec.mode expected {mode_expect!r}, got {spec.get('mode')!r}")

    return failures


def _scenario_skipped(scenario: dict[str, Any]) -> tuple[bool, str]:
    if not scenario.get("optional"):
        return False, ""
    req = scenario.get("requires_env")
    if req and not os.getenv(str(req), "").strip():
        return True, f"optional scenario — set {req}=1 to run"
    return False, ""


async def run_trajectory(
    scenario: dict[str, Any],
    *,
    run_turn=None,
) -> TrajectoryResult:
    from agents.atlas_v5.run_turn import run_turn_response

    execute = run_turn or run_turn_response
    skipped, skip_reason = _scenario_skipped(scenario)
    if skipped:
        return TrajectoryResult(
            id=str(scenario.get("id", "unknown")),
            name=str(scenario.get("name", "")),
            passed=True,
            skipped=True,
            skip_reason=skip_reason,
        )

    tid = str(scenario.get("thread_id") or f"traj-{scenario.get('id', uuid.uuid4().hex[:8])}")
    current_spec: dict[str, Any] | None = None
    prior_meta: dict[str, Any] | None = None
    turn_results: list[TurnResult] = []
    all_failures: list[str] = []

    for i, turn in enumerate(scenario.get("turns") or [], start=1):
        query = str(turn.get("query") or "").strip()
        expect = turn.get("expect") or {}
        t0 = time.perf_counter()
        try:
            payload = await execute(
                query,
                thread_id=tid,
                current_spec=current_spec,
                prior_dev_meta=prior_meta,
            )
        except Exception as exc:
            turn_results.append(
                TurnResult(
                    turn=i,
                    query=query,
                    passed=False,
                    failures=[f"execution error: {exc}"],
                    reply_preview=str(exc)[:120],
                )
            )
            all_failures.append(f"turn {i}: {exc}")
            break

        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        failures = _check_expect(payload, expect, latency_ms)
        reply = str(payload.get("reply") or "")
        dev_meta = payload.get("dev_meta") or {}

        if payload.get("update_canvas") and payload.get("spec"):
            current_spec = payload["spec"]
        prior_meta = dev_meta or prior_meta

        turn_results.append(
            TurnResult(
                turn=i,
                query=query,
                passed=len(failures) == 0,
                failures=failures,
                route=str(payload.get("route") or ""),
                update_canvas=payload.get("update_canvas"),
                latency_ms=latency_ms,
                reply_preview=reply[:280].replace("\n", " "),
                lane_mode=dev_meta.get("lane_mode"),
                spec_recipe=((payload.get("spec") or {}).get("instrument") or {}).get("recipe"),
                spec_mode=(payload.get("spec") or {}).get("mode"),
            )
        )
        all_failures.extend([f"turn {i}: {f}" for f in failures])

    passed = len(all_failures) == 0 and bool(turn_results)
    return TrajectoryResult(
        id=str(scenario.get("id", "unknown")),
        name=str(scenario.get("name", "")),
        passed=passed,
        turns=turn_results,
        failures=all_failures,
    )


async def run_all_trajectories(
    *,
    trajectory_path: Path | None = None,
    scenario_ids: list[str] | None = None,
    run_turn=None,
) -> dict[str, Any]:
    data = _load_yaml(trajectory_path or _DEFAULT_YAML)
    scenarios = data.get("trajectories") or []
    if scenario_ids:
        scenarios = [s for s in scenarios if s.get("id") in scenario_ids]

    results: list[TrajectoryResult] = []
    for scenario in scenarios:
        results.append(await run_trajectory(scenario, run_turn=run_turn))

    executed = [r for r in results if not r.skipped]
    n_pass = sum(1 for r in executed if r.passed)
    n_skip = sum(1 for r in results if r.skipped)

    return {
        "version": data.get("version"),
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "scenarios_total": len(results),
        "scenarios_executed": len(executed),
        "scenarios_skipped": n_skip,
        "scenarios_passed": n_pass,
        "pass_rate": round(n_pass / max(len(executed), 1), 3),
        "results": results,
    }


def _result_to_dict(result: TrajectoryResult) -> dict[str, Any]:
    return {
        "id": result.id,
        "name": result.name,
        "passed": result.passed,
        "skipped": result.skipped,
        "skip_reason": result.skip_reason,
        "failures": result.failures,
        "turns": [
            {
                "turn": t.turn,
                "query": t.query,
                "passed": t.passed,
                "failures": t.failures,
                "route": t.route,
                "update_canvas": t.update_canvas,
                "latency_ms": t.latency_ms,
                "lane_mode": t.lane_mode,
                "reply_preview": t.reply_preview,
                "spec_recipe": t.spec_recipe,
                "spec_mode": t.spec_mode,
            }
            for t in result.turns
        ],
    }


def write_markdown_report(report: dict[str, Any], path: Path) -> None:
    """Human-readable MOT — queries, routes, canvas, reply previews for review."""
    lines = [
        "# Atlas v5 MOT — trajectory report",
        "",
        f"Generated: {report.get('generated_at', '')}",
        f"Pass rate: **{report.get('scenarios_passed', 0)}/{report.get('scenarios_executed', 0)}** "
        f"({report.get('scenarios_skipped', 0)} skipped)",
        "",
        "Use this to review answer quality without clicking through the UI.",
        "",
    ]
    for raw in report.get("results") or []:
        r = raw if isinstance(raw, dict) else _result_to_dict(raw)
        if r.get("skipped"):
            lines.append(f"## SKIP — {r['id']}")
            lines.append(f"{r.get('skip_reason', '')}\n")
            continue
        status = "PASS" if r.get("passed") else "FAIL"
        lines.append(f"## [{status}] {r['id']} — {r.get('name', '')}")
        if r.get("failures"):
            lines.append("**Failures:**")
            for f in r["failures"]:
                lines.append(f"- {f}")
        lines.append("")
        for t in r.get("turns") or []:
            mark = "ok" if t.get("passed") else "FAIL"
            canvas = "canvas updated" if t.get("update_canvas") else "chat only"
            recipe = t.get("spec_recipe") or "—"
            mode = t.get("spec_mode") or "—"
            lines.append(f"### Turn {t['turn']} [{mark}]")
            lines.append(f"**Query:** {t.get('query', '')}")
            lines.append(
                f"**Route:** `{t.get('route')}` · **{canvas}** · "
                f"**{t.get('latency_ms')}ms** · mode `{mode}` · recipe `{recipe}`"
            )
            lines.append(f"**Reply preview:** {t.get('reply_preview', '')}")
            lines.append("")
        lines.append("---\n")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def print_report(report: dict[str, Any]) -> None:
    print("Atlas v5 — session trajectories (API / brain)")
    print(
        f"  {report['scenarios_passed']}/{report['scenarios_executed']} passed"
        f" ({report.get('scenarios_skipped', 0)} skipped)\n"
    )
    for raw in report["results"]:
        r = raw if isinstance(raw, dict) else _result_to_dict(raw)
        if r.get("skipped"):
            print(f"  [SKIP] {r['id']}: {r.get('skip_reason')}")
            continue
        status = "PASS" if r.get("passed") else "FAIL"
        name = str(r.get("name") or "").replace("\u2192", "->")
        print(f"  [{status}] {r['id']}: {name}")
        for t in r.get("turns") or []:
            mark = "ok" if t.get("passed") else "!!"
            print(
                f"         turn {t['turn']} [{mark}] route={t.get('route')} "
                f"{t.get('latency_ms')}ms — {t.get('reply_preview', '')[:80]}"
            )
        for f in r.get("failures") or []:
            print(f"         - {f}")


async def _cli_async(args: argparse.Namespace) -> int:
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY not set — trajectories need live brain.")
        return 2

    run_turn_fn = None
    if os.getenv("ATLAS_TRAJECTORY_FORCE_OFFLINE") == "1":
        from unittest.mock import patch

        from agents.atlas_v5 import online_only as oo

        async def _wrapped(query, **kwargs):
            with patch.object(oo, "corpus_reachable_for_turn", return_value=False):
                from agents.atlas_v5.run_turn import run_turn_response

                return await run_turn_response(query, **kwargs)

        run_turn_fn = _wrapped

    report = await run_all_trajectories(
        trajectory_path=Path(args.file) if args.file else None,
        scenario_ids=args.id,
        run_turn=run_turn_fn,
    )

    serializable = {
        **report,
        "results": [
            _result_to_dict(r) if not isinstance(r, dict) else r
            for r in report["results"]
        ],
    }

    if args.json:
        print(json.dumps(serializable, indent=2))
    else:
        print_report(serializable)

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(serializable, indent=2), encoding="utf-8")
        print(f"\nWrote {out_path}")

    if args.markdown:
        md_path = Path(args.markdown)
        write_markdown_report(serializable, md_path)
        print(f"Wrote {md_path}")

    executed = report["scenarios_executed"]
    passed = report["scenarios_passed"]
    return 0 if executed == passed else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Atlas v5 multi-turn session trajectories")
    parser.add_argument("--file", help="YAML path (default eval/atlas_v5_trajectories.yaml)")
    parser.add_argument("--id", action="append", help="Run single scenario id (repeatable)")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--out", help="Write JSON report path")
    parser.add_argument("--markdown", help="Write human-readable MOT markdown path")
    args = parser.parse_args(argv)
    return asyncio.run(_cli_async(args))


if __name__ == "__main__":
    raise SystemExit(main())
