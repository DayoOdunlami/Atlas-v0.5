"""Atlas v5 LangGraph nodes — thin delegates to run_turn.py (Phase 1 single executor)."""

from __future__ import annotations

import time
import uuid
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage

from agents.atlas_v5.j1t1_corpus import J1T1_QUERY_PHRASE
from agents.atlas_v5.progressive_stream import build_partial_envelope
from agents.atlas_v5.reasoning_trace import trace_step
from agents.atlas_v5.run_turn import (
    execute_substantive_turn,
    finalize_turn_payload,
    gather_substantive_evidence,
    plan_turn_pipeline,
)


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


def _route_trace(pipeline: dict[str, Any]) -> list[dict[str, Any]]:
    route = pipeline.get("route", "chat")
    if route == "substantive":
        decision = pipeline.get("decision") or {}
        outcome = decision.get("outcome_hint") or "orient"
        source = decision.get("source", "heuristic")
        if pipeline.get("online_only_resume"):
            return [
                trace_step(
                    "route",
                    "Online-only consent — handing off to substantive pipeline",
                ),
            ]
        return [
            trace_step("route", f"Substantive turn · {outcome} mode ({source})"),
        ]
    if route == "clear":
        return [trace_step("route", "Clearing canvas")]
    if route == "showcase":
        return [trace_step("route", "Showcase menu — pick a journey")]
    if route == "chat":
        if pipeline.get("reply"):
            return [trace_step("route", "Waiting for a question")]
        return [trace_step("route", "Thinking partner mode — canvas held while we talk")]
    if route == "clarify":
        return [trace_step("route", "One clarifying question — canvas held")]
    return [trace_step("route", f"Turn route · {route}")]


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
    pipeline = dict(state.get("turn_pipeline") or {})
    planned = await plan_turn_pipeline(
        (state.get("query") or "").strip(),
        current_spec=prior_spec(state),
        prior_dev_meta=state.get("answer_dev_meta"),
    )
    pipeline.update(planned)
    patch: dict[str, Any] = {
        "turn_pipeline": pipeline,
        "reasoning_trace": _route_trace(pipeline),
    }
    if pipeline.get("route") == "showcase":
        patch["answer_dev_meta"] = dev_meta_stage(
            state.get("answer_dev_meta"),
            stage="showcase",
            active=False,
            extra=pipeline.get("showcase_meta") or {},
        )
    return patch


def route_after_route(state: dict[str, Any]) -> str:
    route = (state.get("turn_pipeline") or {}).get("route", "chat")
    if route == "substantive":
        return "gather"
    return "finalize"


def route_after_gather(state: dict[str, Any]) -> str:
    route = (state.get("turn_pipeline") or {}).get("route", "substantive")
    if route == "corpus_blocked":
        return "finalize"
    return "stream_spine"


async def gather_evidence(state: dict[str, Any]) -> dict[str, Any]:
    pipeline = dict(state.get("turn_pipeline") or {})
    revision = int(pipeline.get("revision") or 1)
    result = await gather_substantive_evidence(
        pipeline,
        prior_dev_meta=state.get("answer_dev_meta"),
        thread_id=state.get("thread_id"),
        case_entity_id=state.get("case_entity_id"),
    )

    if result.get("blocked"):
        return {
            "turn_pipeline": pipeline,
            "turn_active": False,
            "answer_dev_meta": (pipeline.get("blocked_payload") or {}).get("dev_meta"),
            "reasoning_trace": [
                trace_step(
                    "gather",
                    "Corpus evidence insufficient — canvas withheld; consent offer in chat",
                ),
            ],
        }

    wide = result["wide"]
    decision = pipeline.get("decision") or {}
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
            result["skeleton"], revision=revision, stage="stats"
        ).model_dump(mode="json"),
        "canvas_cleared": False,
        "answer_dev_meta": dev_meta_stage(
            state.get("answer_dev_meta"),
            stage="gather",
            active=True,
            extra={
                "route": "substantive",
                "route_source": decision.get("source", "heuristic"),
                "outcome_hint": wide.outcome,
                "lane_mode": lane,
                "external_skipped": wide.retrieval_meta.get("external_skipped"),
                "partial_stage": "stats",
                "stage_ms": dict(pipeline.get("stage_ms") or {}),
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
    from agents.contracts.answer_spec import AnswerSpec

    pipeline = dict(state.get("turn_pipeline") or {})
    revision = int(pipeline.get("revision") or 1)
    skeleton_dump = pipeline.get("skeleton")
    if not skeleton_dump:
        return {}

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


def _payload_to_graph_patch(
    payload: dict[str, Any],
    *,
    revision: int,
    trace: list[dict[str, Any]],
) -> dict[str, Any]:
    dev_meta = {
        **(payload.get("dev_meta") or {}),
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
    reply = payload.get("reply") or ""
    if reply:
        patch["messages"] = [AIMessage(content=reply, id=str(uuid.uuid4()))]
    if payload.get("clear_canvas"):
        patch["canvas_cleared"] = True
        patch["answer_spec_envelope"] = {"revision": revision, "status": "final"}
    elif payload.get("update_canvas") and payload.get("envelope"):
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


async def synthesize_turn(state: dict[str, Any]) -> dict[str, Any]:
    pipeline = dict(state.get("turn_pipeline") or {})
    revision = int(pipeline.get("revision") or 1)

    payload = await execute_substantive_turn(
        pipeline,
        current_spec=prior_spec(state),
        prior_dev_meta=state.get("answer_dev_meta"),
        thread_id=state.get("thread_id"),
        case_entity_id=state.get("case_entity_id"),
    )

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
    return _payload_to_graph_patch(payload, revision=revision, trace=trace)


async def finalize_turn(state: dict[str, Any]) -> dict[str, Any]:
    pipeline = dict(state.get("turn_pipeline") or {})
    revision = int(pipeline.get("revision") or 1)
    q = state.get("query") or ""

    payload = await finalize_turn_payload(
        q,
        pipeline,
        current_spec=prior_spec(state),
        prior_dev_meta=state.get("answer_dev_meta"),
        session_history=state.get("session_history"),
        thread_id=state.get("thread_id"),
        case_entity_id=state.get("case_entity_id"),
    )

    route = pipeline.get("route", "chat")
    if route == "corpus_blocked":
        trace = [trace_step("complete", "Corpus gate — canvas withheld")]
    elif route == "clear":
        trace = [trace_step("complete", "Canvas cleared")]
    elif route == "showcase":
        trace = [trace_step("complete", "Showcase menu ready")]
    elif payload.get("update_canvas"):
        trace = [
            trace_step("route", "Online-only consent — substantive pipeline"),
            trace_step("complete", "Canvas ready"),
        ]
    else:
        trace = [trace_step("complete", "Reply ready — canvas unchanged")]

    patch = _payload_to_graph_patch(payload, revision=revision, trace=trace)
    if route == "clear":
        patch["canvas_cleared"] = True
    if route == "showcase":
        patch["answer_dev_meta"] = dev_meta_stage(
            state.get("answer_dev_meta"),
            stage="showcase",
            active=False,
            extra=pipeline.get("showcase_meta") or {},
        )
    elif route in ("chat", "clarify") and not payload.get("update_canvas"):
        patch["answer_dev_meta"] = dev_meta_stage(
            state.get("answer_dev_meta"),
            stage="chat",
            active=False,
            extra=payload.get("dev_meta") or {},
        )
    return patch
