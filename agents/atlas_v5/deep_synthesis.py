"""
Atlas v5 — heavy-model deep pass (Sonnet).

Disposition → judgement → optional free composition (merge + gate).
"""

from __future__ import annotations

import logging
import os
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from agents.atlas_v5.chat_router import build_canvas_update_reply, build_chat_only_reply
from agents.atlas_v5.composition_policy import (
    RecipeRecommendation,
    build_recipe_lock_addendum,
    recommend_worthy_recipe,
    should_use_recipe,
)
from agents.atlas_v5.composition_pipeline import apply_composition_to_spec
from agents.atlas_v5.composition_skill import load_visual_composition_skill
from agents.atlas_v5.deep_pass_models import DeepPassOutput
from agents.atlas_v5.chart_spec import attach_charts_with_meta
from agents.atlas_v5.session_context import format_session_history
from agents.atlas_v5.visual_templates import build_template_markup
from agents.atlas_v5.deep_pass_prompt import (
    CHAT_ONLY_TASK_PROMPT,
    CORPUS_ONLY_EVIDENCE_ADDENDUM,
    DUAL_LANE_EVIDENCE_ADDENDUM,
    DEEP_PASS_DISPOSITION_BLOCKS,
    DEEP_PASS_SYSTEM_PROMPT,
    DISPOSITION_JUDGEMENT_TASK_PROMPT,
)
from agents.atlas_v5.disposition_heuristic import infer_disposition_heuristic
from agents.atlas_v5.disposition_models import TurnDispositionOutput
from agents.atlas_v5.judgement_merge import (
    merge_chat_complement,
    merge_judgement_onto_skeleton,
    merge_keyed_figures_into_spec,
)
from agents.atlas_v5.judgement_models import JudgementFieldsOutput
from agents.atlas_v5.keyed_figures import KeyedFigureIndex, build_keyed_index
from agents.atlas_v5.case_file import (
    CaseClaim,
    bootstrap_declared_claims_heuristic,
    case_claims_from_model_items,
    load_case_file,
    merge_case_claims,
    prepend_declared_markup,
    save_case_file,
)
from agents.atlas_v5.reconcile_spec import apply_declared_claims_to_spec, attach_corpus_proof_to_provenance
from agents.atlas_v5.wide_pass import WidePassResult
from agents.contracts.answer_spec import AnswerSpec

logger = logging.getLogger(__name__)

SYNTHESIS_MODEL = os.getenv("MODEL_NAME", "claude-sonnet-4-6")
DEEP_PASS_MAX_TOKENS = int(os.getenv("ATLAS_V5_DEEP_MAX_TOKENS", "8192"))
FREE_COMPOSE_ENABLED = os.getenv("ATLAS_V5_FREE_COMPOSE", "1").strip().lower() in (
    "1",
    "true",
    "yes",
)


class ChatOnlyOutput(BaseModel):
    reply: str = Field(description="Markdown chat reply; canvas unchanged")


def _has_api_key() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY", "").strip())


def _load_chart_skill() -> str:
    from pathlib import Path

    root = Path(__file__).resolve().parent.parent.parent
    path = root / "skills" / "atlas-chart-encoding.md"
    if path.is_file():
        return path.read_text(encoding="utf-8")[:3000]
    return ""


def _lane_addendum(wide: WidePassResult) -> str:
    if wide.retrieval_meta.get("external_skipped") or wide.retrieval_meta.get("lane_mode") == "corpus_only":
        return CORPUS_ONLY_EVIDENCE_ADDENDUM
    return DUAL_LANE_EVIDENCE_ADDENDUM


def _build_evidence_block(
    skeleton: AnswerSpec,
    wide: WidePassResult,
    index: KeyedFigureIndex,
) -> str:
    lines = [
        f"outcome_hint: {wide.outcome}",
        f"lane: {wide.retrieval_meta.get('lane_mode', 'corpus_only')}",
        f"external_skipped: {index.external_skipped}",
        f"available_keys: {', '.join(index.keys())}",
    ]
    if index.web_keys_absent_reason:
        lines.append(f"LANE_CAVEAT: {index.web_keys_absent_reason}")
    if skeleton.stats:
        lines.append("SQL_LOCKED_STATS:")
        for s in skeleton.stats:
            lines.append(f"  - {s.value} | {s.label}")
    if wide.evidence_bag:
        lines.append(
            f"web_sources: {len(wide.evidence_bag.external)} external · "
            f"{len(wide.evidence_bag.candidates)} candidates"
        )
    if wide.graph:
        lines.append(
            f"graph: {len(wide.graph.nodes)} nodes, {len(wide.graph.edges)} edges"
        )
    if wide.session_claims:
        lines.append("SESSION_CASE_FILE (declared — max Indicative):")
        for c in wide.session_claims[:8]:
            lines.append(f"  - [{c.kind}] {c.text[:160]}")
    return "\n".join(lines)


def _resolve_session_claims(
    query: str,
    wide: WidePassResult,
    *,
    thread_id: str | None,
    case_entity_id: str | None = None,
    deep: DeepPassOutput | None,
) -> list[CaseClaim]:
    prior = (
        list(wide.session_claims)
        if wide.session_claims
        else load_case_file(thread_id, case_entity_id)
    )
    if deep and deep.case_claims:
        updates = case_claims_from_model_items(
            [c.model_dump(mode="json") for c in deep.case_claims]
        )
        return merge_case_claims(prior, updates)
    boot = bootstrap_declared_claims_heuristic(query)
    if boot:
        return merge_case_claims(prior, boot)
    return prior


def _format_canvas_context(current_spec: dict[str, Any] | None) -> str:
    if not current_spec:
        return ""
    verdict = (current_spec.get("verdict") or {}).get("sentence", "")
    return (
        f"\n## Current canvas\nmode={current_spec.get('mode')} "
        f"instrument={(current_spec.get('instrument') or {}).get('recipe')}\n"
        f"verdict: {verdict[:240]}\n"
    )


def _normalize_claim_source(source: str) -> str:
    if source in ("synthesised", "synthesized"):
        return "synthesized"
    return source


def _normalize_deep_pass_output(result: DeepPassOutput) -> DeepPassOutput:
    claims = []
    for claim in result.judgement.claims:
        patched = claim.model_copy(
            update={"source": _normalize_claim_source(str(claim.source))},
        )
        claims.append(patched)
    judgement = result.judgement.model_copy(update={"claims": claims})
    return result.model_copy(update={"judgement": judgement})


def _invoke_structured(system: str, user: str, schema: type[BaseModel]) -> BaseModel | None:
    try:
        from langchain_anthropic import ChatAnthropic

        llm = ChatAnthropic(
            model=SYNTHESIS_MODEL,
            api_key=os.environ["ANTHROPIC_API_KEY"],
            max_tokens=DEEP_PASS_MAX_TOKENS,
            temperature=0.35,
        )
        structured = llm.with_structured_output(schema)
        result = structured.invoke(
            [SystemMessage(content=system), HumanMessage(content=user)],
        )
        if isinstance(result, DeepPassOutput):
            return _normalize_deep_pass_output(result)
        return result
    except Exception as exc:
        logger.warning("Deep pass structured call failed: %s", exc)
        return None


def synthesize_deep_pass_sync(
    query: str,
    skeleton: AnswerSpec,
    wide: WidePassResult,
    index: KeyedFigureIndex,
    *,
    current_spec: dict[str, Any] | None = None,
    recipe_rec: RecipeRecommendation | None = None,
) -> DeepPassOutput | None:
    if not _has_api_key():
        return None
    skill = load_visual_composition_skill()
    chart_skill = _load_chart_skill()
    system = DEEP_PASS_SYSTEM_PROMPT + DEEP_PASS_DISPOSITION_BLOCKS + _lane_addendum(wide)
    if skill and FREE_COMPOSE_ENABLED:
        system += f"\n\n## Visual composition skill\n{skill[:4000]}"
    if chart_skill:
        system += f"\n\n## Chart encoding skill\n{chart_skill}"
    system += build_recipe_lock_addendum(
        recipe_rec,
        free_compose_enabled=FREE_COMPOSE_ENABLED,
    )
    user = (
        f"{DISPOSITION_JUDGEMENT_TASK_PROMPT}\n\n"
        f"User message:\n{query}\n"
        f"{_format_canvas_context(current_spec)}\n"
        f"Evidence:\n{_build_evidence_block(skeleton, wide, index)}"
    )
    result = _invoke_structured(system, user, DeepPassOutput)
    return result if isinstance(result, DeepPassOutput) else None


def synthesize_chat_only_sync(
    query: str,
    *,
    current_spec: dict[str, Any] | None = None,
    clarify: bool = False,
    session_history: list[dict[str, Any]] | None = None,
) -> str | None:
    if not _has_api_key():
        return None
    system = DEEP_PASS_SYSTEM_PROMPT + DEEP_PASS_DISPOSITION_BLOCKS + CORPUS_ONLY_EVIDENCE_ADDENDUM
    task = CHAT_ONLY_TASK_PROMPT
    if clarify:
        task += "\nAsk ONE focused clarifying question — no canvas update."
    history_block = format_session_history(session_history)
    user = f"{task}\n\n{history_block}\n\nUser message:\n{query}{_format_canvas_context(current_spec)}".strip()
    result = _invoke_structured(system, user, ChatOnlyOutput)
    if isinstance(result, ChatOnlyOutput) and result.reply.strip():
        return result.reply.strip()
    return None


def _attach_chart(
    spec: AnswerSpec, wide: WidePassResult, index: KeyedFigureIndex, query: str
) -> tuple[AnswerSpec, dict[str, Any]]:
    result = attach_charts_with_meta(spec, wide, index, query)
    return result.spec, result.meta


def _template_kwargs(wide: WidePassResult) -> dict[str, str]:
    return {
        "object_label": wide.object_label,
        "outcome": wide.outcome,
    }


def _build_dev_meta(
    disposition: TurnDispositionOutput,
    index: KeyedFigureIndex,
    wide: WidePassResult,
    *,
    gate_status: str | None = None,
    gate_errors: list[str] | None = None,
    fallback_rung: str | None = None,
    visual_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    meta = {
        "disposition": disposition.model_dump(mode="json"),
        "keyed_keys": index.keys(),
        "web_keys_absent_reason": index.web_keys_absent_reason,
        "research_keys_absent_reason": index.research_keys_absent_reason,
        "lane_mode": wide.retrieval_meta.get("lane_mode"),
        "external_skipped": index.external_skipped,
        "gate_status": gate_status,
        "gate_errors": gate_errors or [],
        "fallback_rung": fallback_rung,
        "free_compose_enabled": FREE_COMPOSE_ENABLED,
    }
    if visual_meta:
        meta.update(visual_meta)
    return meta


def _apply_composition_policy(
    disposition: TurnDispositionOutput,
    recipe_rec: RecipeRecommendation | None,
) -> TurnDispositionOutput:
    """Free compose by default; reference recipe only when policy locks one."""
    if not FREE_COMPOSE_ENABLED:
        if disposition.composition_mode in ("free_compose", "reference_recipe"):
            return disposition.model_copy(
                update={
                    "composition_mode": "reference_recipe",
                    "reasoning": f"{disposition.reasoning}; recipes-only mode",
                },
            )
        return disposition

    if should_use_recipe(recipe_rec, free_compose_enabled=True):
        assert recipe_rec is not None
        return disposition.model_copy(
            update={
                "composition_mode": "reference_recipe",
                "reasoning": f"{disposition.reasoning}; RECIPE_LOCK: {recipe_rec.reason}",
            },
        )

    if disposition.composition_mode in ("reference_recipe", "none"):
        return disposition.model_copy(
            update={
                "composition_mode": "free_compose",
                "reasoning": f"{disposition.reasoning}; default free compose",
            },
        )
    return disposition


async def apply_deep_pass(
    query: str,
    skeleton: AnswerSpec,
    wide: WidePassResult,
    *,
    current_spec: dict[str, Any] | None = None,
    substantive: bool = True,
    thread_id: str | None = None,
    case_entity_id: str | None = None,
) -> tuple[AnswerSpec | None, str, dict[str, Any], bool]:
    """
    Returns (spec_or_none, reply, dev_meta, update_canvas).
    spec is None when canvas_action is none (chat-only from disposition).
    """
    import asyncio

    index = build_keyed_index(wide, skeleton)
    recipe_rec = recommend_worthy_recipe(query, wide, skeleton)
    deep = await asyncio.to_thread(
        synthesize_deep_pass_sync,
        query,
        skeleton,
        wide,
        index,
        current_spec=current_spec,
        recipe_rec=recipe_rec,
    )

    session_claims = _resolve_session_claims(
        query, wide, thread_id=thread_id, case_entity_id=case_entity_id, deep=deep
    )
    if session_claims:
        save_case_file(thread_id, session_claims, case_entity_id)

    def _finish(spec: AnswerSpec) -> AnswerSpec:
        spec = attach_corpus_proof_to_provenance(spec)
        return apply_declared_claims_to_spec(spec, session_claims)

    def _markup(markup: str | None) -> str | None:
        return prepend_declared_markup(markup, session_claims)

    if deep is None:
        disposition = infer_disposition_heuristic(
            query,
            current_spec=current_spec,
            substantive=substantive,
            recipe_rec=recipe_rec,
            free_compose_enabled=FREE_COMPOSE_ENABLED,
        )
        disposition = _apply_composition_policy(disposition, recipe_rec)
        if disposition.canvas_action == "none":
            reply = build_chat_only_reply(query, current_spec)
            meta = _build_dev_meta(disposition, index, wide, fallback_rung="chat")
            return None, reply, meta, False

        template_markup = build_template_markup(
            query,
            JudgementFieldsOutput(
                mode=skeleton.mode,
                tier=skeleton.tier,
                verdict=skeleton.verdict,
                soWhat=skeleton.soWhat,
                instrument_recipe=(skeleton.instrument.recipe if skeleton.instrument else "IncommensurableMagnitudes"),
                chat_complement="",
            ),
            index,
            session_claims=session_claims,
            **_template_kwargs(wide),
        )
        if template_markup:
            merged, gate_status, gate_errors, fallback_rung = apply_composition_to_spec(
                skeleton, _markup(template_markup), index
            )
            merged, visual_meta = _attach_chart(merged, wide, index, query)
            reply = build_canvas_update_reply(merged, query)
            meta = _build_dev_meta(
                disposition,
                index,
                wide,
                gate_status=gate_status,
                gate_errors=gate_errors,
                fallback_rung=fallback_rung or "template",
                visual_meta=visual_meta,
            )
            return _finish(merged), reply, meta, True

        reply = build_canvas_update_reply(skeleton, query)
        out, visual_meta = _attach_chart(skeleton, wide, index, query)
        meta = _build_dev_meta(
            disposition, index, wide, fallback_rung="recipe", visual_meta=visual_meta
        )
        return _finish(out), reply, meta, True

    disposition = _apply_composition_policy(deep.disposition, recipe_rec)

    if disposition.canvas_action == "none" or disposition.primary_surface == "chat_only":
        raw = deep.judgement.chat_complement.strip()
        reply = merge_chat_complement(raw, index) if raw else build_chat_only_reply(
            query, current_spec
        )
        meta = _build_dev_meta(disposition, index, wide, fallback_rung="chat")
        return None, reply, meta, False

    merged = merge_judgement_onto_skeleton(skeleton, deep.judgement)
    merged = merge_keyed_figures_into_spec(merged, index, skeleton=skeleton)
    merged, visual_meta = _attach_chart(merged, wide, index, query)

    def _dev_meta(**kwargs: Any) -> dict[str, Any]:
        return _build_dev_meta(disposition, index, wide, visual_meta=visual_meta, **kwargs)

    def _reply(complement: str | None, fallback_spec: AnswerSpec) -> str:
        raw = (complement or "").strip()
        if raw:
            return merge_chat_complement(raw, index)
        return build_canvas_update_reply(fallback_spec, query)

    if disposition.composition_mode == "degrade_prose":
        if merged.instrument is None:
            merged = merged.model_copy(update={"instrument": None})
        reply = _reply(deep.judgement.chat_complement, merged)
        meta = _dev_meta(gate_status="degrade_prose", fallback_rung="prose")
        return _finish(merged), reply, meta, True

    if disposition.composition_mode == "free_compose":
        if deep.canvas_markup:
            merged, gate_status, gate_errors, fallback_rung = apply_composition_to_spec(
                merged, _markup(deep.canvas_markup), index
            )
            meta = _dev_meta(
                gate_status=gate_status,
                gate_errors=gate_errors,
                fallback_rung=fallback_rung,
            )
            reply = _reply(deep.judgement.chat_complement, merged)
            return _finish(merged), reply, meta, True

        template_markup = build_template_markup(
            query,
            deep.judgement,
            index,
            session_claims=session_claims,
            **_template_kwargs(wide),
        )
        if template_markup:
            merged, gate_status, gate_errors, fallback_rung = apply_composition_to_spec(
                merged, _markup(template_markup), index
            )
            meta = _dev_meta(
                gate_status=gate_status,
                gate_errors=gate_errors,
                fallback_rung=fallback_rung or "template",
            )
            reply = _reply(deep.judgement.chat_complement, merged)
            return _finish(merged), reply, meta, True

        if merged.instrument is not None:
            meta = _dev_meta(
                gate_status="fallback_recipe",
                gate_errors=["free_compose: no canvas_markup; skeleton recipe"],
                fallback_rung="recipe",
            )
            reply = _reply(deep.judgement.chat_complement, merged)
            return _finish(merged), reply, meta, True

        merged = merged.model_copy(update={"instrument": None})
        meta = _dev_meta(
            gate_status="degrade_prose",
            gate_errors=["free_compose: no markup, template, or recipe"],
            fallback_rung="prose",
        )
        reply = _reply(deep.judgement.chat_complement, merged)
        return _finish(merged), reply, meta, True

    reply = _reply(deep.judgement.chat_complement, merged)
    meta = _dev_meta(fallback_rung="recipe")
    return _finish(merged), reply, meta, True


async def apply_deep_judgement(
    query: str,
    skeleton: AnswerSpec,
    wide: WidePassResult,
    *,
    current_spec: dict[str, Any] | None = None,
) -> tuple[AnswerSpec, str]:
    """Legacy wrapper — always updates canvas."""
    spec, reply, _meta, _update = await apply_deep_pass(
        query, skeleton, wide, current_spec=current_spec, substantive=True
    )
    return spec or skeleton, reply


async def synthesize_chat_reply(
    query: str,
    *,
    current_spec: dict[str, Any] | None = None,
    clarify: bool = False,
    session_history: list[dict[str, Any]] | None = None,
) -> str:
    import asyncio

    reply = await asyncio.to_thread(
        synthesize_chat_only_sync,
        query,
        current_spec=current_spec,
        clarify=clarify,
        session_history=session_history,
    )
    if reply:
        return reply
    return build_chat_only_reply(query, current_spec)
