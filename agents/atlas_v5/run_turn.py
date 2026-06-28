"""
Atlas v5 brain — single-turn execution.

classify (Haiku) → wide pass → keyed index → deep pass (disposition → compose → gate)
"""

from __future__ import annotations

import json
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
from agents.atlas_v5.showcase import resolve_showcase_turn
from agents.atlas_v5.turn_classifier import OutcomeHint, TurnDecision, classify_turn
from agents.atlas_v5.turn_memory import apply_turn_accretion
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
]


def _apply_tier_guard(spec: AnswerSpec) -> AnswerSpec:
    headline = spec.verdict.sentence
    guard = apply_citation_guard(
        confidence_tier=spec.tier,
        citation_count=len(spec.corpus_citations),
        headline=headline,
    )
    if guard["confidence_tier"] != spec.tier:
        return spec.model_copy(update={"tier": guard["confidence_tier"]})
    return spec


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
    if not q:
        return {
            "reply": "Send a message when you're ready.",
            "update_canvas": False,
            "route": "chat",
            "route_source": "heuristic",
            "dev_meta": _route_dev_meta("chat", "heuristic"),
        }

    if is_clear_canvas_query(q):
        return await _clear_canvas_response(q, current_spec=current_spec)

    sub_q, showcase_meta, showcase_reply = resolve_showcase_turn(q, prior_dev_meta)
    if showcase_reply is not None:
        if sub_q:
            decision = classify_turn(sub_q, current_spec)
            payload = await _execute_substantive_turn(
                sub_q,
                decision,
                current_spec=current_spec,
                showcase_meta=showcase_meta,
                prior_dev_meta=prior_dev_meta,
                thread_id=thread_id,
            )
            intro = showcase_reply
            payload["reply"] = f"{intro}\n\n---\n\n{payload.get('reply', '')}"
            return payload
        return {
            "reply": showcase_reply,
            "update_canvas": False,
            "route": "showcase",
            "route_source": "heuristic",
            "dev_meta": _route_dev_meta(
                "showcase",
                "heuristic",
                extra=showcase_meta or {},
            ),
        }

    decision: TurnDecision = classify_turn(q, current_spec)

    if decision.route in ("chat", "clarify"):
        reply = await synthesize_chat_reply(
            q,
            current_spec=current_spec,
            clarify=decision.route == "clarify",
        )
        return {
            "reply": reply,
            "update_canvas": False,
            "route": decision.route,
            "route_source": decision.source,
            "dev_meta": _route_dev_meta(
                decision.route,
                decision.source,
                extra={"disposition": {"reasoning": decision.reasoning or ""}},
            ),
        }

    return await _execute_substantive_turn(
        q,
        decision,
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
