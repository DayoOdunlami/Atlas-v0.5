"""
agents.orchestrator.graph
=========================

Atlas 5 — Tool-calling orchestrator (ADR-0001).

LangGraph StateGraph replacing the legacy workbench hard-router.
Activated when ATLAS5_ORCHESTRATOR_V1=true (agents/feature_flags.py).

Graph topology
--------------
    extract_query
         ↓
      triage
         ↓
      [gate]  ← HITL interrupt (effort=deep + needs_gate=True only)
         ↓
       loop   ← tool-calling loop (claude-sonnet-4-6 with bound tools)
         ↓
      verify  ← trust spine: citation_guard + [falsification] + artifact_qa
         ↓
      format  ← block/document layout selection (render registry)
         ↓
        END

State fields
------------
All fields are defined in OrchestratorState.  Nodes write their outputs
by returning a partial state dict — they never mutate state directly.
"""
from __future__ import annotations

import json
import os
import re
from typing import Annotated, Any, Literal

from typing_extensions import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.types import interrupt

from agents.base import extract_latest_query
from agents.orchestrator.intent_router import (
    node_intent_router,
    route_after_intent_router,
)
from agents.orchestrator.context import merge_render_models, node_assemble_context
from agents.orchestrator.triage import triage_query, TriageResult
from agents.orchestrator.gate import build_gate_payload, interpret_gate_response
from agents.orchestrator.tools import STANDARD_TOOLS, DEEP_TOOLS
from agents.registry.render_model import build_atlas_render_model, validate_render_model
from agents.spine.verify import run_verify_spine


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

class OrchestratorState(TypedDict, total=False):
    """LangGraph state — messages use add_messages reducer for multi-turn sessions."""

    messages: Annotated[list, add_messages]
    query: str
    effort: str
    outcome: str
    needs_gate: bool
    gate_confirmed: bool
    render_model: dict[str, Any] | None
    _prior_render_model: dict[str, Any] | None
    error: str | None
    _triage: dict[str, Any] | None
    _intent: dict[str, Any] | None
    _is_conversational: bool
    _context: dict[str, Any] | None
    active_scope: str | None
    thread_id: str | None
    reasoning_steps: list[dict[str, Any]] | None
    _pending_clarify: str | None
    _intent_history: list[dict[str, Any]] | None
    lens: str | None


def _default_state() -> dict[str, Any]:
    return {
        "messages": [],
        "query": "",
        "effort": "analyze",
        "outcome": "orient",
        "needs_gate": False,
        "gate_confirmed": False,
        "render_model": None,
        "error": None,
        "_triage": None,
    }


# ---------------------------------------------------------------------------
# Node: extract_query
# ---------------------------------------------------------------------------

def node_extract_query(state: dict[str, Any]) -> dict[str, Any]:
    """Extract the latest user query; stash prior artifact for multi-turn augment."""
    query = extract_latest_query(state)
    prior = state.get("render_model")
    updates: dict[str, Any] = {
        "query": query,
        "_prior_render_model": prior if isinstance(prior, dict) else None,
        "error": None,
        "gate_confirmed": False,
        "_triage": None,
    }
    # Fresh render_model for this turn — merged back in loop after build
    if prior:
        updates["render_model"] = None
    return updates


# ---------------------------------------------------------------------------
# Node: triage
# ---------------------------------------------------------------------------

def node_triage(state: dict[str, Any]) -> dict[str, Any]:
    """Classify query effort + outcome without calling a large model."""
    query = (state.get("query") or extract_latest_query(state) or "").strip()
    result: TriageResult = triage_query(query)

    intent = state.get("_intent") or {}
    if intent.get("outcome_hint"):
        result = TriageResult(
            effort=intent.get("effort_hint") or result.effort,
            outcome=intent["outcome_hint"],
            needs_gate=result.needs_gate,
            notes=f"{result.notes} Intent hint: {intent.get('outcome_hint')}.",
            raw_query=query,
        )
    elif intent.get("effort_hint"):
        result = TriageResult(
            effort=intent["effort_hint"],
            outcome=result.outcome,
            needs_gate=result.needs_gate,
            notes=result.notes,
            raw_query=query,
        )

    ctx = state.get("_context") or {}
    q_lower = query.lower()
    if any(w in q_lower for w in ("compare", "versus", "vs ", "drill into", "second one", "that one")):
        if ctx.get("last_outcome") in ("orient", "connect", "diagnose"):
            result = TriageResult(
                effort=result.effort if result.effort != "clarify" else "analyze",
                outcome="diagnose" if "drill" in q_lower or "translation" in q_lower else result.outcome,
                needs_gate=result.needs_gate,
                notes="Follow-up on prior turn — routing with session context.",
                raw_query=query,
            )

    return {
        "effort": result.effort,
        "outcome": result.outcome,
        "needs_gate": result.needs_gate,
        "_triage": {
            "effort": result.effort,
            "outcome": result.outcome,
            "needs_gate": result.needs_gate,
            "notes": result.notes,
        },
    }


def _route_after_triage(state: dict[str, Any]) -> str:
    """Route: clarify → END (ask for more info), deep → gate, else → loop."""
    effort = state.get("effort", "analyze")
    needs_gate = state.get("needs_gate", False)

    if effort == "clarify":
        return "clarify"
    if needs_gate:
        return "gate"
    return "loop"


# ---------------------------------------------------------------------------
# Node: clarify  (dead-end for too-short queries)
# ---------------------------------------------------------------------------

def node_clarify(state: dict[str, Any]) -> dict[str, Any]:
    """Return a clarification request message."""
    query = (state.get("query") or "").strip()
    if re.match(r"^\s*(hi|hello|hey)\s*[!.?]*\s*$", query, re.I):
        msg = AIMessage(content=(
            "Hello! I'm the Atlas workbench — I help CPC strategists explore corpus evidence, "
            "funding fit, and investment cases.\n\n"
            "Ask something specific, for example:\n"
            "• What evidence does CPC have in smart mobility that would transfer to the "
            "Innovate UK Smart City Challenge?\n"
            "• What are our biggest evidence gaps in rail decarbonisation?"
        ))
    else:
        msg = AIMessage(content=(
            "I need a bit more detail to help you well. Could you tell me:\n"
            "- What topic or entity are you researching?\n"
            "- What kind of output would be most useful (overview, evidence gaps, funding calls)?"
        ))
    return {"messages": [msg]}


# ---------------------------------------------------------------------------
# Node: gate  (HITL interrupt)
# ---------------------------------------------------------------------------

def node_gate(state: dict[str, Any]) -> dict[str, Any]:
    """
    HITL interrupt — ask the user to confirm deep research before proceeding.

    LangGraph's interrupt() pauses execution and surfaces the payload
    to the CopilotKit frontend via useLangGraphInterrupt.
    """
    triage_data = state.get("_triage") or {}

    from agents.orchestrator.triage import TriageResult
    fake_triage = TriageResult(
        effort=triage_data.get("effort", "deep"),
        outcome=triage_data.get("outcome", "orient"),  # type: ignore[arg-type]
        needs_gate=True,
        notes=triage_data.get("notes", ""),
        raw_query=state.get("query", ""),
    )
    payload = build_gate_payload(fake_triage)

    user_reply = interrupt({
        "type": "gate",
        "question": payload.question,
        "research_plan": payload.research_plan,
        "effort": payload.effort,
        "outcome": payload.outcome,
    })

    decision = interpret_gate_response(str(user_reply or "confirm"))

    if decision == "decline":
        # Return a minimal response without deep research
        msg = AIMessage(content=(
            "Understood — I'll skip the deep research. "
            "Let me know if you'd like a lighter overview instead."
        ))
        return {"messages": [msg], "gate_confirmed": False}

    if decision == "refine":
        # Surface the refinement prompt — next user message restarts the graph
        msg = AIMessage(content=(
            "Sure — what would you like me to focus on instead? "
            "Just describe the refined question and I'll adjust the plan."
        ))
        return {"messages": [msg], "gate_confirmed": False}

    # confirm — proceed to loop
    return {"gate_confirmed": True}


def _route_after_gate(state: dict[str, Any]) -> str:
    """Route: confirmed → loop, otherwise → END (already replied)."""
    return "loop" if state.get("gate_confirmed") else "__end__"


# ---------------------------------------------------------------------------
# Node: loop  (tool-calling)
# ---------------------------------------------------------------------------

_ORCHESTRATOR_SYSTEM = """You are the Atlas 5 orchestrator for Connected Places Catapult (CPC).

Your job is to answer strategic intelligence questions by calling the available tools
to search the CPC corpus and synthesise evidence-backed responses.

Guidelines:
- Call search_corpus first for any question about CPC's evidence or projects.
- Call search_hive for climate adaptation and transport resilience questions.
- Call load_passport when you need structured entity capability data.
- Call search_external ONLY when effort=deep has been confirmed and you need external context.
- Never invent citations — only use IDs returned by the tools.
- Always include a confidence_tier in your synthesis: Speculative | Indicative | Supported | Robust.
- Tier rules: 0 citations = Speculative, 1-2 = Indicative, 3-4 = Supported, 5+ = Robust.
- Produce a JSON synthesis at the end of your response with this structure:
  {"headline": "...", "insight_card": "...", "sections": {}, "corpus_citations": [...], "confidence_tier": "..."}
"""


async def node_loop(state: dict[str, Any]) -> dict[str, Any]:
    """
    Tool-calling loop — runs until the LLM stops calling tools.

    Deterministic paths (no LLM required):
      - diagnose / connect+transfer → Value Translation (Phase 3)
      - orient / connect / act / defend → corpus-backed outcome builders (Phase 4)

    Falls back to LLM loop when ANTHROPIC_API_KEY is set; stub otherwise.
    """
    from agents.llm_factory import get_llm
    from agents.orchestrator.diagnose import run_value_translation_pipeline
    from agents.orchestrator.outcome_builders import build_outcome_model
    from agents.orchestrator.reasoning_trace import steps_for_pipeline

    query = state.get("query", "")
    effort = state.get("effort", "analyze")
    outcome = state.get("outcome", "orient")
    prior = state.get("_prior_render_model")
    scope = state.get("active_scope")

    def _finalize(model: dict[str, Any], insight: str, steps: list | None = None) -> dict[str, Any]:
        merged = merge_render_models(prior, model, outcome=outcome) if prior else model
        if scope and isinstance(merged, dict):
            merged["active_scope"] = scope
        chat = _chat_message_for_surface(merged, insight, outcome)
        return {
            "render_model": merged,
            "reasoning_steps": steps or merged.get("reasoning_steps") or [],
            "messages": [AIMessage(content=chat)],
        }

    # Phase 3 — Value Translation (diagnose + connect+transfer)
    vt_model = run_value_translation_pipeline(
        query=query,
        outcome=outcome,
        thread_id=state.get("thread_id"),
    )
    if vt_model is not None:
        insight = vt_model.get("insight_card", "")
        steps = steps_for_pipeline(outcome=outcome, effort=effort, path="value_translation")
        vt_model["reasoning_steps"] = steps
        return _finalize(vt_model, insight, steps)

    # Phase 4 — deterministic outcome builders (all five outcomes except diagnose-only VT)
    if outcome in ("orient", "connect", "act", "defend"):
        built = build_outcome_model(
            query=query,
            outcome=outcome,
            thread_id=state.get("thread_id"),
            scope=scope,
        )
        insight = built.get("insight_card", "")
        steps = steps_for_pipeline(outcome=outcome, effort=effort, path=f"{outcome}_builder")
        built["reasoning_steps"] = steps
        return _finalize(built, insight, steps)

    tools = DEEP_TOOLS if effort == "deep" else STANDARD_TOOLS

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        stub = build_atlas_render_model(
            outcome=outcome,  # type: ignore[arg-type]
            headline=f"[STUB] {query[:60]}",
            insight_card="Stub response — ANTHROPIC_API_KEY not set.",
            confidence_tier="Speculative",
            query=query,
            effort=effort,  # type: ignore[arg-type]
        )
        return {"render_model": stub}

    llm = get_llm(streaming=True).bind_tools(tools)

    from agents.orchestrator.subagents.outcomes import get_outcome_prompt
    outcome_prompt = get_outcome_prompt(outcome)  # type: ignore[arg-type]

    messages = [
        SystemMessage(content=_ORCHESTRATOR_SYSTEM + f"\n\nQuery effort: {effort}. Outcome mode: {outcome}.\n" + outcome_prompt),
        HumanMessage(content=query),
    ]

    from agents.orchestrator.latency import LatencyBudget
    budget = LatencyBudget(effort=effort)
    budget.start()

    tool_results: list[dict[str, Any]] = []
    max_iterations = 6

    for _ in range(max_iterations):
        response = await llm.ainvoke(messages)
        messages.append(response)

        if not hasattr(response, "tool_calls") or not response.tool_calls:
            break

        # Early-exit if latency budget exceeded
        if budget.is_exceeded():
            break

        for tc in response.tool_calls:
            tool_fn = next((t for t in tools if t.name == tc["name"]), None)
            if tool_fn is None:
                tool_results.append({"tool": tc["name"], "error": "unknown tool"})
                continue
            try:
                result = await tool_fn.ainvoke(tc["args"])
                tool_results.append({"tool": tc["name"], "result": result})
                from langchain_core.messages import ToolMessage
                messages.append(ToolMessage(
                    content=json.dumps(result, default=str),
                    tool_call_id=tc["id"],
                ))
            except Exception as exc:
                tool_results.append({"tool": tc["name"], "error": str(exc)})
                from langchain_core.messages import ToolMessage
                messages.append(ToolMessage(
                    content=f"Error: {exc}",
                    tool_call_id=tc["id"],
                ))

    # Extract synthesis from final AI message
    final_text = str(messages[-1].content if hasattr(messages[-1], "content") else "")
    synthesis = _extract_synthesis(final_text)

    render_model = build_atlas_render_model(
        outcome=synthesis.get("outcome", outcome),  # type: ignore[arg-type]
        headline=synthesis.get("headline", f"Analysis: {query[:60]}"),
        insight_card=synthesis.get("insight_card", final_text[:400]),
        sections=synthesis.get("sections", {}),
        corpus_citations=synthesis.get("corpus_citations", []),
        confidence_tier=synthesis.get("confidence_tier", "Speculative"),  # type: ignore[arg-type]
        query=query,
        effort=effort,  # type: ignore[arg-type]
        extra={"elapsed_seconds": round(budget.elapsed, 1)},
    )

    # Apply early-exit cap if budget exceeded
    if budget.is_exceeded():
        render_model = budget.early_exit_model(render_model)

    return {"render_model": render_model, "messages": [AIMessage(content=final_text)]}


def _chat_message_for_surface(model: dict[str, Any], insight: str, outcome: str) -> str:
    """Chat vs artifact routing — short ack for dense artifacts."""
    surface = model.get("chat_surface") or "hybrid"
    blocks = model.get("blocks_data") or {}
    headline = model.get("headline") or insight[:120]

    if surface == "artifact_primary" or len(blocks) >= 4:
        return f"**{headline}**\n\nSee the artifact panel for the full {outcome} analysis — citations and blocks are updated there."
    if surface == "chat_only" or not blocks:
        return insight or headline
    # hybrid — headline + short insight
    return f"**{headline}**\n\n{insight[:500]}"


def _extract_synthesis(text: str) -> dict[str, Any]:
    """Try to parse a JSON synthesis block from the LLM response."""
    import re
    # Look for a JSON block at the end of the response
    match = re.search(r"\{[^{}]*\"headline\"[^{}]*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return {}


# ---------------------------------------------------------------------------
# Node: verify  (trust spine)
# ---------------------------------------------------------------------------

def node_verify(state: dict[str, Any]) -> dict[str, Any]:
    """Run citation_guard + [falsification] + artifact_qa on the render model."""
    model = state.get("render_model")
    if not model:
        return {}

    effort = state.get("effort", "analyze")
    outcome = state.get("outcome", "orient")

    # Defend mode always runs falsification regardless of effort level (D4.4 quality bar)
    effective_effort = "deep" if outcome == "defend" else effort

    verified = run_verify_spine(
        artifact=model,
        query=state.get("query", ""),
        headline=model.get("headline", ""),
        effort=effective_effort,  # type: ignore[arg-type]
    )
    return {"render_model": verified}


# ---------------------------------------------------------------------------
# Node: format  (block/document layout selection)
# ---------------------------------------------------------------------------

def node_format(state: dict[str, Any]) -> dict[str, Any]:
    """Apply the format pass: select blocks, render mode, chart spec, and gap signals."""
    model = state.get("render_model")
    if not model:
        return {}

    from agents.orchestrator.format_pass import run_format_pass
    updated = run_format_pass(model, query=state.get("query", ""))

    # Emit gap signals from the completed verified model (D2.1)
    try:
        from agents.instrumentation.signals import extract_signals_from_model
        signals = extract_signals_from_model(
            updated,
            query=state.get("query", ""),
            format_node_render_mode=updated.get("render_mode", "blocks"),
        )
        updated["gap_signals"] = [
            {
                "signal_type": s.signal_type,
                "severity": s.severity,
                "message": s.message,
                "node": s.node,
            }
            for s in signals
        ]
    except Exception:
        updated["gap_signals"] = []

    # U7 — propagate reasoning steps to coAgent state
    steps = state.get("reasoning_steps") or (model.get("reasoning_steps") if model else None)
    if steps:
        updated["reasoning_steps"] = steps

    return {"render_model": updated, "reasoning_steps": steps or []}


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------

def _build_graph() -> Any:
    builder = StateGraph(OrchestratorState)

    builder.add_node("extract_query", node_extract_query)
    builder.add_node("assemble_context", node_assemble_context)
    builder.add_node("intent_router", node_intent_router)
    builder.add_node("triage", node_triage)
    builder.add_node("clarify", node_clarify)
    builder.add_node("gate", node_gate)
    builder.add_node("loop", node_loop)
    builder.add_node("verify", node_verify)
    builder.add_node("format", node_format)

    builder.add_edge(START, "extract_query")
    builder.add_edge("extract_query", "assemble_context")
    builder.add_edge("assemble_context", "intent_router")

    builder.add_conditional_edges(
        "intent_router",
        route_after_intent_router,
        {
            END: END,
            "triage": "triage",
        },
    )

    builder.add_conditional_edges(
        "triage",
        _route_after_triage,
        {
            "clarify": "clarify",
            "gate": "gate",
            "loop": "loop",
        },
    )

    builder.add_edge("clarify", END)

    builder.add_conditional_edges(
        "gate",
        _route_after_gate,
        {
            "loop": "loop",
            "__end__": END,
        },
    )

    builder.add_edge("loop", "verify")
    builder.add_edge("verify", "format")
    builder.add_edge("format", END)

    memory = MemorySaver()
    return builder.compile(checkpointer=memory, interrupt_before=["gate"])


orchestrator_graph = _build_graph()
