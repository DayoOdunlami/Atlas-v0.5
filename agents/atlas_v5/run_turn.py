"""
Atlas v5 brain — single-turn execution.

classify (Haiku) → wide pass → keyed index → deep pass (disposition → compose → gate)
"""

from __future__ import annotations

import json
import time
from dataclasses import asdict
from typing import Any, AsyncIterator

from agents.atlas_v5.chat_router import is_clear_canvas_query
from agents.atlas_v5.deep_synthesis import apply_deep_pass, synthesize_chat_reply
from agents.atlas_v5.intent import is_connect_network_query, is_j1t1_orient_query
from agents.atlas_v5.j1t1_corpus import J1T1_QUERY_PHRASE
from agents.atlas_v5.corpus_gate import substantive_blocked_offer
from agents.atlas_v5.online_only import (
    build_online_only_active_meta,
    build_online_only_offer,
    is_online_only_active,
    pending_outcome_hint,
    pending_substantive_query,
    probe_corpus_available,
    user_accepts_online_only,
)
from agents.atlas_v5.reasoning_trace import trace_step
from agents.atlas_v5.showcase import resolve_showcase_turn
from agents.atlas_v5.turn_classifier import OutcomeHint, TurnDecision, classify_turn, infer_outcome_hint
from agents.atlas_v5.turn_memory import apply_turn_accretion
from agents.atlas_v5.turn_timing import merge_stage_ms
from agents.atlas_v5.wide_pass_snapshot import snapshot_wide_pass
from agents.atlas_v5.wide_pass import (
    assemble_spec_from_wide_pass,
    needs_online_only_consent as _needs_online_only_consent,
    run_wide_pass,
)
from agents.atlas_v5.progressive_stream import build_partial_envelope
from agents.contracts.answer_spec import AnswerSpec, AnswerSpecEnvelope
from agents.spine.citation_guard import apply_citation_guard

__all__ = [
    "is_j1t1_orient_query",
    "is_connect_network_query",
    "classify_turn",
    "run_turn",
    "run_turn_envelope",
    "run_turn_response",
    "run_turn_stream",
    "is_clear_canvas_query",
    "substantive_resume_decision",
    "plan_turn_pipeline",
    "gather_substantive_evidence",
    "finalize_turn_payload",
    "execute_substantive_turn",
]


def _apply_tier_guard(spec: AnswerSpec) -> AnswerSpec:
    from agents.atlas_v5.intent import cap_strategy_alignment_tier

    headline = spec.verdict.sentence
    guard = apply_citation_guard(
        confidence_tier=spec.tier,
        citation_count=len(spec.corpus_citations),
        headline=headline,
    )
    if guard["confidence_tier"] != spec.tier:
        spec = spec.model_copy(update={"tier": guard["confidence_tier"]})
    return cap_strategy_alignment_tier(spec)


async def run_turn(
    query: str,
    *,
    thread_id: str | None = None,
    outcome_hint: OutcomeHint | None = None,
    current_spec: dict[str, Any] | None = None,
) -> AnswerSpec:
    q = query.strip() or J1T1_QUERY_PHRASE
    wide = await run_wide_pass(q, outcome_hint=outcome_hint, thread_id=thread_id)
    skeleton = assemble_spec_from_wide_pass(wide)
    spec, _reply, _meta, _update = await apply_deep_pass(
        q, skeleton, wide, current_spec=current_spec, substantive=True, thread_id=thread_id
    )
    return _apply_tier_guard(spec or skeleton)


def build_envelope(
    spec: AnswerSpec,
    *,
    revision: int = 1,
    status: str = "final",
) -> AnswerSpecEnvelope:
    return AnswerSpecEnvelope(
        revision=revision,
        status=status,  # type: ignore[arg-type]
        spec=spec.model_dump(mode="json"),
    )


async def run_turn_envelope(
    query: str,
    *,
    thread_id: str | None = None,
    revision: int = 1,
    current_spec: dict[str, Any] | None = None,
) -> dict[str, Any]:
    spec = await run_turn(
        query,
        thread_id=thread_id,
        current_spec=current_spec,
    )
    return build_envelope(spec, revision=revision).model_dump(mode="json")


def _route_dev_meta(
    route: str,
    route_source: str,
    *,
    update_canvas: bool = False,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "route": route,
        "route_source": route_source,
        "disposition": {
            "primary_surface": "canvas_primary" if update_canvas else "chat_only",
            "canvas_action": "update" if update_canvas else "none",
            "composition_mode": "—",
            "reasoning": f"turn route={route}",
        },
    }
    if extra:
        meta.update(extra)
    return meta


async def _clear_canvas_response(
    query: str,
    *,
    current_spec: dict[str, Any] | None = None,
) -> dict[str, Any]:
    reply = await synthesize_chat_reply(query, current_spec=current_spec)
    if "can't blank" in reply.lower():
        reply = (
            "Canvas cleared. Ask a landscape or network question when you're ready — "
            "e.g. *state of play on rail decarbonisation* or *map the ecosystem*."
        )
    return {
        "reply": reply,
        "update_canvas": True,
        "clear_canvas": True,
        "route": "clear",
        "route_source": "heuristic",
        "dev_meta": _route_dev_meta("clear", "heuristic", update_canvas=True),
    }


def substantive_resume_decision(
    query: str,
    prior_dev_meta: dict[str, Any] | None,
) -> tuple[TurnDecision, str] | None:
    """Hand off to substantive pipeline when user accepts online-only consent."""
    if not user_accepts_online_only(query, prior_dev_meta):
        return None
    work_q = pending_substantive_query(prior_dev_meta) or query.strip()
    hint = pending_outcome_hint(prior_dev_meta) or infer_outcome_hint(work_q, None)
    decision = TurnDecision(
        route="substantive",
        outcome_hint=hint,
        reasoning="User accepted online-only — resuming substantive pipeline",
        source="heuristic",
    )
    return decision, work_q


async def plan_turn_pipeline(
    query: str,
    *,
    current_spec: dict[str, Any] | None = None,
    prior_dev_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Route a turn — single source of truth for graph and REST paths."""
    q = query.strip()
    pipeline: dict[str, Any] = {"stage_ms": {}}

    if not q:
        pipeline["route"] = "chat"
        pipeline["reply"] = "Send a message when you're ready."
        return pipeline

    if is_clear_canvas_query(q):
        payload = await _clear_canvas_response(q, current_spec=current_spec)
        pipeline["route"] = "clear"
        pipeline["final_payload"] = payload
        return pipeline

    sub_q, showcase_meta, showcase_reply = resolve_showcase_turn(q, prior_dev_meta)
    if showcase_reply is not None and not sub_q:
        pipeline["route"] = "showcase"
        pipeline["reply"] = showcase_reply
        pipeline["showcase_meta"] = showcase_meta
        return pipeline

    query_for_turn = sub_q or q

    resume = substantive_resume_decision(q, prior_dev_meta)
    if resume and not sub_q:
        resume_decision, work_q = resume
        pipeline["route"] = "substantive"
        pipeline["query_for_turn"] = work_q
        pipeline["decision"] = asdict(resume_decision)
        pipeline["online_only_resume"] = True
        return pipeline

    t_route = time.perf_counter()
    decision = classify_turn(query_for_turn, current_spec)
    route_ms = round((time.perf_counter() - t_route) * 1000, 0)
    pipeline["route_ms"] = route_ms
    pipeline["stage_ms"] = merge_stage_ms(pipeline, {"route_ms": route_ms})
    pipeline["route"] = "substantive" if sub_q else decision.route
    pipeline["decision"] = asdict(decision)
    pipeline["query_for_turn"] = query_for_turn
    if sub_q:
        pipeline["showcase_meta"] = showcase_meta
        pipeline["showcase_intro"] = showcase_reply

    return pipeline


async def gather_substantive_evidence(
    pipeline: dict[str, Any],
    *,
    prior_dev_meta: dict[str, Any] | None = None,
    thread_id: str | None = None,
    case_entity_id: str | None = None,
) -> dict[str, Any]:
    """Wide pass + corpus gate for substantive graph path. Mutates pipeline in place."""
    q = pipeline.get("query_for_turn") or ""
    decision = TurnDecision(**pipeline["decision"])
    stage_ms = dict(pipeline.get("stage_ms") or {})

    online_only = is_online_only_active(prior_dev_meta) or bool(
        pipeline.get("online_only_resume")
    )

    t_gather = time.perf_counter()
    wide = await run_wide_pass(
        q,
        outcome_hint=decision.outcome_hint,
        online_only=online_only,
        thread_id=thread_id,
        case_entity_id=case_entity_id,
    )
    stage_ms["wide_ms"] = round((time.perf_counter() - t_gather) * 1000, 0)
    meta = wide.retrieval_meta or {}
    if meta.get("shopper_ms") is not None:
        stage_ms["shopper_ms"] = float(meta["shopper_ms"])
    if meta.get("corpus_stats_ms") is not None:
        stage_ms["corpus_stats_ms"] = float(meta["corpus_stats_ms"])
    if meta.get("corpus_ms") is not None:
        stage_ms["corpus_fetch_ms"] = float(meta["corpus_ms"])
    if meta.get("external_ms") is not None:
        stage_ms["external_fetch_ms"] = float(meta["external_ms"])
    if meta.get("research_ms") is not None:
        stage_ms["research_fetch_ms"] = float(meta["research_ms"])

    blocked = substantive_blocked_offer(wide, q, decision, online_only=online_only)
    if blocked:
        pipeline["route"] = "corpus_blocked"
        pipeline["blocked_payload"] = blocked
        pipeline["stage_ms"] = stage_ms
        return {"blocked": True, "wide": wide}

    skeleton = assemble_spec_from_wide_pass(wide, online_only=online_only)
    pipeline["wide_outcome"] = wide.outcome
    pipeline["skeleton"] = skeleton.model_dump(mode="json")
    pipeline["wide_snapshot"] = snapshot_wide_pass(wide)
    pipeline["stage_ms"] = stage_ms
    return {"blocked": False, "wide": wide, "skeleton": skeleton}


async def finalize_turn_payload(
    query: str,
    pipeline: dict[str, Any],
    *,
    current_spec: dict[str, Any] | None = None,
    prior_dev_meta: dict[str, Any] | None = None,
    session_history: list[dict[str, Any]] | None = None,
    thread_id: str | None = None,
    case_entity_id: str | None = None,
) -> dict[str, Any]:
    """Non-streaming finalize — chat, showcase, clear, corpus_blocked, empty."""
    route = pipeline.get("route", "chat")
    q = query.strip()

    if route == "corpus_blocked":
        return dict(
            pipeline.get("blocked_payload")
            or {
                "reply": (
                    "Corpus evidence is insufficient for a canvas brief. "
                    'Reply "yes, continue online" to use web-only mode.'
                ),
                "update_canvas": False,
                "route": "clarify",
                "route_source": "heuristic",
                "dev_meta": {},
            }
        )

    if route == "clear":
        return dict(
            pipeline.get("final_payload")
            or await _clear_canvas_response(q, current_spec=current_spec)
        )

    if route == "showcase":
        return {
            "reply": pipeline.get("reply") or "",
            "update_canvas": False,
            "route": "showcase",
            "route_source": "heuristic",
            "dev_meta": _route_dev_meta(
                "showcase",
                "heuristic",
                extra=pipeline.get("showcase_meta") or {},
            ),
        }

    if not q:
        return {
            "reply": pipeline.get("reply") or "Send a message when you're ready.",
            "update_canvas": False,
            "route": "chat",
            "route_source": "heuristic",
            "dev_meta": _route_dev_meta("chat", "heuristic"),
        }

    if route in ("chat", "clarify"):
        resume = substantive_resume_decision(q, prior_dev_meta)
        if resume:
            resume_decision, work_q = resume
            return await _execute_substantive_turn(
                work_q,
                resume_decision,
                current_spec=current_spec,
                prior_dev_meta=prior_dev_meta,
                thread_id=thread_id,
                case_entity_id=case_entity_id,
            )

        decision = pipeline.get("decision") or {}
        reply = await synthesize_chat_reply(
            q,
            current_spec=current_spec,
            clarify=route == "clarify",
            session_history=session_history,
        )
        return {
            "reply": reply,
            "update_canvas": False,
            "route": route,
            "route_source": decision.get("source", "heuristic"),
            "dev_meta": _route_dev_meta(
                route,
                decision.get("source", "heuristic"),
                extra={"disposition": {"reasoning": decision.get("reasoning") or ""}},
            ),
        }

    return {
        "reply": pipeline.get("reply") or "Send a message when you're ready.",
        "update_canvas": False,
        "route": "chat",
        "route_source": "heuristic",
        "dev_meta": _route_dev_meta("chat", "heuristic"),
    }


async def execute_substantive_turn(
    pipeline: dict[str, Any],
    *,
    current_spec: dict[str, Any] | None = None,
    prior_dev_meta: dict[str, Any] | None = None,
    thread_id: str | None = None,
    case_entity_id: str | None = None,
) -> dict[str, Any]:
    """Deep pass for substantive graph path (after gather + optional stream_spine)."""
    from agents.atlas_v5.wide_pass_snapshot import restore_wide_pass

    q = pipeline.get("query_for_turn") or ""
    decision = TurnDecision(**pipeline["decision"])
    stage_ms = dict(pipeline.get("stage_ms") or {})

    cached_wide = None
    cached_skeleton = None
    if pipeline.get("wide_snapshot") and pipeline.get("skeleton"):
        cached_wide = restore_wide_pass(pipeline["wide_snapshot"])
        cached_skeleton = AnswerSpec.model_validate(pipeline["skeleton"])

    payload = await _execute_substantive_turn(
        q,
        decision,
        current_spec=current_spec,
        showcase_meta=pipeline.get("showcase_meta"),
        prior_dev_meta=prior_dev_meta,
        cached_wide=cached_wide,
        cached_skeleton=cached_skeleton,
        stage_ms=stage_ms,
        thread_id=thread_id,
        case_entity_id=case_entity_id,
    )
    if pipeline.get("showcase_intro"):
        payload["reply"] = f"{pipeline['showcase_intro']}\n\n---\n\n{payload.get('reply', '')}"
    return payload


async def _execute_substantive_turn(
    q: str,
    decision: TurnDecision,
    *,
    current_spec: dict[str, Any] | None = None,
    showcase_meta: dict[str, Any] | None = None,
    prior_dev_meta: dict[str, Any] | None = None,
    thread_id: str | None = None,
    case_entity_id: str | None = None,
    cached_wide: Any | None = None,
    cached_skeleton: AnswerSpec | None = None,
    stage_ms: dict[str, float] | None = None,
) -> dict[str, Any]:
    online_only = is_online_only_active(prior_dev_meta)
    work_q = q
    outcome_hint = decision.outcome_hint

    if user_accepts_online_only(q, prior_dev_meta):
        online_only = True
        work_q = pending_substantive_query(prior_dev_meta) or q
        outcome_hint = pending_outcome_hint(prior_dev_meta) or outcome_hint
    elif not online_only and not await probe_corpus_available(work_q):
        return build_online_only_offer(work_q, decision)

    import time

    if cached_wide is not None and cached_skeleton is not None:
        wide = cached_wide
        skeleton = cached_skeleton
    else:
        t_wide = time.perf_counter()
        wide = await run_wide_pass(
            work_q,
            outcome_hint=outcome_hint,
            online_only=online_only,
            thread_id=thread_id,
            case_entity_id=case_entity_id,
        )
        if stage_ms is not None:
            stage_ms["wide_ms"] = round((time.perf_counter() - t_wide) * 1000, 0)
            meta = wide.retrieval_meta or {}
            if meta.get("shopper_ms") is not None:
                stage_ms["shopper_ms"] = float(meta["shopper_ms"])
            if meta.get("corpus_ms") is not None:
                stage_ms["corpus_fetch_ms"] = float(meta["corpus_ms"])
            if meta.get("external_ms") is not None:
                stage_ms["external_fetch_ms"] = float(meta["external_ms"])

        if _needs_online_only_consent(wide) and not online_only:
            return build_online_only_offer(work_q, decision)

        blocked = substantive_blocked_offer(wide, work_q, decision, online_only=online_only)
        if blocked:
            return blocked

        skeleton = assemble_spec_from_wide_pass(wide, online_only=online_only)

    if cached_wide is None:
        blocked = substantive_blocked_offer(wide, work_q, decision, online_only=online_only)
        if blocked:
            return blocked
        if _needs_online_only_consent(wide) and not online_only:
            return build_online_only_offer(work_q, decision)

    t_deep = time.perf_counter()
    spec, reply, dev_meta, update_canvas = await apply_deep_pass(
        work_q,
        skeleton,
        wide,
        current_spec=current_spec,
        substantive=True,
        thread_id=thread_id,
        case_entity_id=case_entity_id,
    )
    if stage_ms is not None:
        stage_ms["deep_ms"] = round((time.perf_counter() - t_deep) * 1000, 0)

    if online_only:
        dev_meta = {
            **dev_meta,
            **build_online_only_active_meta(work_q, wide.outcome),
        }

    if showcase_meta:
        dev_meta = {**dev_meta, **showcase_meta}

    if stage_ms:
        dev_meta = {**dev_meta, "stage_ms": stage_ms}

    if not update_canvas:
        return {
            "reply": reply,
            "update_canvas": False,
            "route": "substantive",
            "route_source": decision.source,
            "outcome_hint": wide.outcome,
            "dev_meta": {**dev_meta, "route": "substantive", "route_source": decision.source},
        }

    final = _apply_tier_guard(spec or skeleton)
    final = apply_turn_accretion(final, current_spec, query=q)
    return {
        "spec": final.model_dump(mode="json"),
        "reply": reply,
        "update_canvas": True,
        "route": "substantive",
        "route_source": decision.source,
        "outcome_hint": wide.outcome,
        "envelope": build_envelope(final).model_dump(mode="json"),
        "dev_meta": {**dev_meta, "route": "substantive", "route_source": decision.source},
    }


async def run_turn_response(
    query: str,
    *,
    thread_id: str | None = None,
    current_spec: dict[str, Any] | None = None,
    prior_dev_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    q = query.strip()
    pipeline = await plan_turn_pipeline(
        q, current_spec=current_spec, prior_dev_meta=prior_dev_meta
    )
    route = pipeline.get("route", "chat")

    if route == "substantive":
        sub_q = pipeline.get("query_for_turn") or q
        if pipeline.get("showcase_meta") and pipeline.get("showcase_intro"):
            decision = TurnDecision(**pipeline["decision"])
            payload = await _execute_substantive_turn(
                sub_q,
                decision,
                current_spec=current_spec,
                showcase_meta=pipeline.get("showcase_meta"),
                prior_dev_meta=prior_dev_meta,
                thread_id=thread_id,
            )
            payload["reply"] = (
                f"{pipeline['showcase_intro']}\n\n---\n\n{payload.get('reply', '')}"
            )
            return payload
        decision = TurnDecision(**pipeline["decision"])
        return await _execute_substantive_turn(
            sub_q,
            decision,
            current_spec=current_spec,
            prior_dev_meta=prior_dev_meta,
            thread_id=thread_id,
        )

    return await finalize_turn_payload(
        q,
        pipeline,
        current_spec=current_spec,
        prior_dev_meta=prior_dev_meta,
        thread_id=thread_id,
    )


async def run_turn_stream(
    query: str,
    *,
    thread_id: str | None = None,
    current_spec: dict[str, Any] | None = None,
) -> AsyncIterator[str]:
    """NDJSON stream: partial skeleton envelope, then final turn payload."""
    q = query.strip()
    if not q:
        yield json.dumps(
            {
                "event": "final",
                "reply": "Send a message when you're ready.",
                "update_canvas": False,
                "route": "chat",
            }
        ) + "\n"
        return

    if is_clear_canvas_query(q):
        payload = await _clear_canvas_response(q, current_spec=current_spec)
        yield json.dumps({"event": "final", **payload}) + "\n"
        return

    decision = classify_turn(q, current_spec)
    if decision.route in ("chat", "clarify"):
        reply = await synthesize_chat_reply(
            q,
            current_spec=current_spec,
            clarify=decision.route == "clarify",
        )
        yield json.dumps(
            {
                "event": "final",
                "reply": reply,
                "update_canvas": False,
                "route": decision.route,
                "route_source": decision.source,
            }
        ) + "\n"
        return

    wide = await run_wide_pass(
        q, outcome_hint=decision.outcome_hint, thread_id=thread_id
    )
    blocked = substantive_blocked_offer(wide, q, decision)
    if blocked:
        yield json.dumps({"event": "final", **blocked}) + "\n"
        return

    skeleton = assemble_spec_from_wide_pass(wide)
    stats_line = "corpus gathered"
    if wide.stats:
        stats_line = (
            f"{wide.stats.project_count} projects · "
            f"£{wide.stats.funding_sum / 1_000_000:.2f}m floor"
        )
    gather_trace = [
        trace_step(
            "gather",
            f"Wide pass · {wide.outcome} · {stats_line}",
            evidence_count=wide.stats.project_count if wide.stats else None,
        ),
        trace_step("gather", "Stats on canvas — building spine"),
    ]
    yield json.dumps(
        {
            "event": "partial",
            "update_canvas": True,
            "route": "substantive",
            "outcome_hint": wide.outcome,
            "envelope": build_partial_envelope(skeleton, revision=1, stage="stats").model_dump(
                mode="json"
            ),
            "reply": "Loading judgement…",
            "reasoning_trace": gather_trace,
            "dev_meta": {
                "turn_stage": "gather",
                "turn_active": True,
                "partial_stage": "stats",
                "route": "substantive",
                "route_source": decision.source,
                "lane_mode": wide.retrieval_meta.get("lane_mode"),
                "external_skipped": wide.retrieval_meta.get("external_skipped"),
            },
        }
    ) + "\n"

    yield json.dumps(
        {
            "event": "partial",
            "update_canvas": True,
            "route": "substantive",
            "envelope": build_partial_envelope(skeleton, revision=1, stage="spine").model_dump(
                mode="json"
            ),
            "reply": "Deep synthesis…",
            "reasoning_trace": [trace_step("judgement", "Verdict and blindspot on canvas")],
            "dev_meta": {
                "turn_stage": "spine",
                "turn_active": True,
                "partial_stage": "spine",
            },
        }
    ) + "\n"

    payload = await _execute_substantive_turn(
        q, decision, current_spec=current_spec, thread_id=thread_id
    )
    final_trace = [
        trace_step("complete", "Canvas ready"),
    ]
    payload["reasoning_trace"] = gather_trace + [
        trace_step("judgement", "Deep synthesis — disposition, verdict, visual"),
    ] + final_trace
    if payload.get("dev_meta"):
        payload["dev_meta"] = {
            **payload["dev_meta"],
            "turn_stage": "complete",
            "turn_active": False,
            "partial_stage": "complete",
        }
    yield json.dumps({"event": "final", **payload}) + "\n"
