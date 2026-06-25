"""Atlas v5 LangGraph nodes — streaming partial canvas + reasoning trace."""

from __future__ import annotations

import time
import uuid
from dataclasses import asdict
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage

from agents.atlas_v5.chat_router import is_clear_canvas_query
from agents.atlas_v5.deep_synthesis import synthesize_chat_reply
from agents.atlas_v5.j1t1_corpus import J1T1_QUERY_PHRASE
from agents.atlas_v5.reasoning_trace import trace_step
from agents.atlas_v5.progressive_stream import build_partial_envelope
from agents.atlas_v5.turn_timing import merge_stage_ms
from agents.atlas_v5.wide_pass_snapshot import restore_wide_pass, snapshot_wide_pass
from agents.atlas_v5.run_turn import (
    _clear_canvas_response,
    _execute_substantive_turn,
    _route_dev_meta,
)
from agents.atlas_v5.showcase import resolve_showcase_turn
from agents.atlas_v5.turn_classifier import TurnDecision, classify_turn
from agents.atlas_v5.wide_pass import assemble_spec_from_wide_pass, run_wide_pass


def _ux_pref(state: dict[str, Any], key: str, default: bool = False) -> bool:
    prefs = state.get("ux_prefs") or {}
    return bool(prefs.get(key, default))


def extract_query(state: dict[str, Any]) -> str:
    for msg in reversed(state.get("messages") or []):
        if isinstance(msg, HumanMessage):
            content = msg.content
            if isinstance(content, str) and content.strip():
                return content.strip()
        if isinstance(msg, dict) and msg.get("role") == "user":
            content = msg.get("content", "")
            if isinstance(content, str) and content.strip():
                return content.strip()
    if state.get("query"):
        return str(state["query"]).strip()
    return J1T1_QUERY_PHRASE


def prior_spec(state: dict[str, Any]) -> dict[str, Any] | None:
    if state.get("canvas_cleared"):
        return None
    envelope = state.get("answer_spec_envelope") or {}
    spec = envelope.get("spec")
    if spec and envelope.get("status") in ("final", "partial"):
        return spec
    return None


def next_revision(state: dict[str, Any]) -> int:
    envelope = state.get("answer_spec_envelope") or {}
    return int(envelope.get("revision") or 0) + 1


def dev_meta_stage(
    base: dict[str, Any] | None,
    *,
    stage: str,
    active: bool,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    meta = {**(base or {}), "turn_stage": stage, "turn_active": active}
    if extra:
        meta.update(extra)
    return meta


async def prepare_turn(state: dict[str, Any]) -> dict[str, Any]:
    query = extract_query(state)
    revision = next_revision(state)
    preview = query if len(query) <= 72 else f"{query[:69]}…"
    return {
        "query": query,
        "error": None,
        "turn_active": True,
        "turn_pipeline": {
            "revision": revision,
            "turn_started_ms": round(time.time() * 1000),
            "stage_ms": {},
        },
        "reasoning_trace": [
            trace_step("prepare", f"Reading your question — {preview}"),
        ],
    }


async def route_turn(state: dict[str, Any]) -> dict[str, Any]:
    q = (state.get("query") or "").strip()
    pipeline = dict(state.get("turn_pipeline") or {})
    current_spec = prior_spec(state)
    prior_dev_meta = state.get("answer_dev_meta")

    if not q:
        pipeline["route"] = "chat"
        pipeline["reply"] = "Send a message when you're ready."
        return {
            "turn_pipeline": pipeline,
            "reasoning_trace": [trace_step("route", "Waiting for a question")],
        }

    if is_clear_canvas_query(q):
        payload = await _clear_canvas_response(q, current_spec=current_spec)
        pipeline["route"] = "clear"
        pipeline["final_payload"] = payload
        return {
            "turn_pipeline": pipeline,
            "reasoning_trace": [trace_step("route", "Clearing canvas")],
        }

    sub_q, showcase_meta, showcase_reply = resolve_showcase_turn(q, prior_dev_meta)
    if showcase_reply is not None and not sub_q:
        pipeline["route"] = "showcase"
        pipeline["reply"] = showcase_reply
        pipeline["showcase_meta"] = showcase_meta
        return {
            "turn_pipeline": pipeline,
            "answer_dev_meta": dev_meta_stage(
                prior_dev_meta,
                stage="showcase",
                active=False,
                extra=showcase_meta or {},
            ),
            "reasoning_trace": [trace_step("route", "Showcase menu — pick a journey")],
        }

    query_for_turn = sub_q or q
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

    if decision.route in ("chat", "clarify") and not sub_q:
        thought = (
            "Thinking partner mode — canvas held while we talk"
            if decision.route == "chat"
            else "One clarifying question — canvas held"
        )
        pipeline["route"] = decision.route
        return {
            "turn_pipeline": pipeline,
            "reasoning_trace": [trace_step("route", thought)],
        }

    outcome = decision.outcome_hint or "orient"
    return {
        "turn_pipeline": pipeline,
        "reasoning_trace": [
            trace_step(
                "route",
                f"Substantive turn · {outcome} mode ({decision.source})",
            ),
        ],
    }


def route_after_route(state: dict[str, Any]) -> str:
    route = (state.get("turn_pipeline") or {}).get("route", "chat")
    if route == "substantive":
        return "gather"
    return "finalize"


async def gather_evidence(state: dict[str, Any]) -> dict[str, Any]:
    pipeline = dict(state.get("turn_pipeline") or {})
    revision = int(pipeline.get("revision") or 1)
    q = pipeline.get("query_for_turn") or state.get("query") or ""
    decision = TurnDecision(**pipeline["decision"])
    stage_ms = dict(pipeline.get("stage_ms") or {})

    t_gather = time.perf_counter()
    wide = await run_wide_pass(q, outcome_hint=decision.outcome_hint)
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

    skeleton = assemble_spec_from_wide_pass(wide)
    pipeline["wide_outcome"] = wide.outcome
    pipeline["skeleton"] = skeleton.model_dump(mode="json")
    pipeline["wide_snapshot"] = snapshot_wide_pass(wide)
    pipeline["stage_ms"] = stage_ms

    stats_line = "corpus gathered"
    if wide.stats:
        stats_line = (
            f"{wide.stats.project_count} projects · "
            f"£{wide.stats.funding_sum / 1_000_000:.2f}m floor"
        )

    lane = wide.retrieval_meta.get("lane_mode", "corpus_only")
    ext = wide.retrieval_meta.get("external_count", 0)

    patch: dict[str, Any] = {
        "turn_pipeline": pipeline,
        "answer_spec_envelope": build_partial_envelope(
            skeleton, revision=revision, stage="stats"
        ).model_dump(mode="json"),
        "canvas_cleared": False,
        "answer_dev_meta": dev_meta_stage(
            state.get("answer_dev_meta"),
            stage="gather",
            active=True,
            extra={
                "route": "substantive",
                "route_source": decision.source,
                "outcome_hint": wide.outcome,
                "lane_mode": lane,
                "external_skipped": wide.retrieval_meta.get("external_skipped"),
                "partial_stage": "stats",
                "stage_ms": stage_ms,
            },
        ),
        "reasoning_trace": [
            trace_step(
                "gather",
                f"Wide pass · {wide.outcome} · {stats_line} · lane {lane} · web {ext}",
                evidence_count=wide.stats.project_count if wide.stats else None,
            ),
            trace_step("gather", "Stats on canvas — building spine"),
        ],
    }

    if _ux_pref(state, "streamInterimChat", True):
        count = wide.stats.project_count if wide.stats else 0
        patch["messages"] = [
            AIMessage(
                content=(
                    f"Corpus scan complete — **{count} projects** in scope. "
                    "Composing verdict and canvas…"
                ),
                id=str(uuid.uuid4()),
            ),
        ]

    return patch


async def stream_spine(state: dict[str, Any]) -> dict[str, Any]:
    pipeline = dict(state.get("turn_pipeline") or {})
    revision = int(pipeline.get("revision") or 1)
    skeleton_dump = pipeline.get("skeleton")
    if not skeleton_dump:
        return {}

    from agents.contracts.answer_spec import AnswerSpec

    skeleton = AnswerSpec.model_validate(skeleton_dump)

    stage = "visual" if _ux_pref(state, "streamCompose", False) else "spine"

    patch: dict[str, Any] = {
        "answer_spec_envelope": build_partial_envelope(
            skeleton, revision=revision, stage=stage
        ).model_dump(mode="json"),
        "answer_dev_meta": dev_meta_stage(
            state.get("answer_dev_meta"),
            stage="spine",
            active=True,
            extra={
                "partial_stage": "visual" if stage == "visual" else "spine",
                "stage_ms": dict((state.get("turn_pipeline") or {}).get("stage_ms") or {}),
            },
        ),
        "reasoning_trace": [
            trace_step("judgement", "Verdict and blindspot on canvas"),
        ],
    }

    if _ux_pref(state, "streamChatTokens", False):
        patch["messages"] = [
            AIMessage(
                content="Deep synthesis running — final chat lands when the canvas is ready.",
                id=str(uuid.uuid4()),
            ),
        ]

    return patch


async def synthesize_turn(state: dict[str, Any]) -> dict[str, Any]:
    pipeline = dict(state.get("turn_pipeline") or {})
    revision = int(pipeline.get("revision") or 1)
    q = pipeline.get("query_for_turn") or state.get("query") or ""
    decision = TurnDecision(**pipeline["decision"])
    current_spec = prior_spec(state)
    stage_ms = dict(pipeline.get("stage_ms") or {})

    from agents.contracts.answer_spec import AnswerSpec

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
        cached_wide=cached_wide,
        cached_skeleton=cached_skeleton,
        stage_ms=stage_ms,
    )

    reply = payload.get("reply") or ""
    if pipeline.get("showcase_intro"):
        reply = f"{pipeline['showcase_intro']}\n\n---\n\n{reply}"

    dev_meta = payload.get("dev_meta") or {}
    disposition = (dev_meta.get("disposition") or {}).get("reasoning") or ""
    composition = (dev_meta.get("disposition") or {}).get("composition_mode") or "—"
    gate = dev_meta.get("gate_status") or "—"
    trace = [
        trace_step("judgement", "Deep synthesis — disposition, verdict, visual"),
        trace_step(
            "judgement",
            f"{composition} · gate {gate}"
            + (f" — {disposition[:80]}" if disposition else ""),
        ),
        trace_step("complete", "Canvas ready"),
    ]

    dev_meta = {
        **dev_meta,
        "turn_stage": "complete",
        "turn_active": False,
        "partial_stage": "complete",
    }

    patch: dict[str, Any] = {
        "answer_dev_meta": dev_meta,
        "turn_active": False,
        "turn_pipeline": {},
        "reasoning_trace": trace,
    }

    if reply:
        patch["messages"] = [AIMessage(content=reply, id=str(uuid.uuid4()))]

    if payload.get("update_canvas") and payload.get("envelope"):
        envelope = dict(payload["envelope"])
        envelope["revision"] = revision
        patch["answer_spec_envelope"] = envelope
        patch["canvas_cleared"] = False
    elif payload.get("update_canvas") and payload.get("spec"):
        patch["answer_spec_envelope"] = {
            "revision": revision,
            "status": "final",
            "spec": payload["spec"],
        }
        patch["canvas_cleared"] = False

    return patch


async def finalize_turn(state: dict[str, Any]) -> dict[str, Any]:
    pipeline = dict(state.get("turn_pipeline") or {})
    route = pipeline.get("route", "chat")
    revision = int(pipeline.get("revision") or 1)
    current_spec = prior_spec(state)
    q = state.get("query") or ""

    if route == "clear":
        payload = pipeline.get("final_payload") or await _clear_canvas_response(
            q, current_spec=current_spec
        )
        reply = payload.get("reply") or ""
        return {
            "canvas_cleared": True,
            "turn_active": False,
            "turn_pipeline": {},
            "answer_spec_envelope": {"revision": revision, "status": "final"},
            "answer_dev_meta": {
                **(payload.get("dev_meta") or {}),
                "turn_stage": "complete",
                "turn_active": False,
            },
            "reasoning_trace": [trace_step("complete", "Canvas cleared")],
            "messages": [AIMessage(content=reply, id=str(uuid.uuid4()))] if reply else [],
        }

    if route == "showcase":
        reply = pipeline.get("reply") or ""
        return {
            "turn_active": False,
            "turn_pipeline": {},
            "answer_dev_meta": dev_meta_stage(
                state.get("answer_dev_meta"),
                stage="showcase",
                active=False,
                extra=pipeline.get("showcase_meta") or {},
            ),
            "reasoning_trace": [trace_step("complete", "Showcase menu ready")],
            "messages": [AIMessage(content=reply, id=str(uuid.uuid4()))],
        }

    if route in ("chat", "clarify"):
        reply = await synthesize_chat_reply(
            q,
            current_spec=current_spec,
            clarify=route == "clarify",
        )
        decision = pipeline.get("decision") or {}
        return {
            "turn_active": False,
            "turn_pipeline": {},
            "answer_dev_meta": dev_meta_stage(
                state.get("answer_dev_meta"),
                stage="chat",
                active=False,
                extra=_route_dev_meta(
                    route,
                    decision.get("source", "heuristic"),
                    extra={"disposition": {"reasoning": decision.get("reasoning") or ""}},
                ),
            ),
            "reasoning_trace": [trace_step("complete", "Reply ready — canvas unchanged")],
            "messages": [AIMessage(content=reply, id=str(uuid.uuid4()))],
        }

    reply = pipeline.get("reply") or "Send a message when you're ready."
    return {
        "turn_active": False,
        "turn_pipeline": {},
        "messages": [AIMessage(content=reply, id=str(uuid.uuid4()))],
    }
