"""
Atlas Workbench Agent — LangGraph StateGraph
=============================================

PURPOSE
-------
A purpose-built agent for the /workbench chat panel.  Unlike the general
ATLAS agent this graph is tightly scoped: it answers questions about the
current AtlasRenderModel, searches the corpus on demand, and proposes
model_patches the user can confirm to update the artifact.

It does NOT default to Five Case Model on every query — that was the main
liability of the old ATLAS agent.  Five Case is staged as an explicit
"economic_analysis" route (see STAGED section below).

ROUTES
------
explain         — Read model_summary from context, answer with citations.
                  No corpus search, no model_patch.  Cheap and fast.

search          — User explicitly asked for evidence/corpus search.
                  Calls search_corpus_projects, cites verified IDs.
                  No model_patch.

propose         — Agent proposes a model_patch to update the artifact.
                  Emits a ModelPatchProposal the frontend shows as a diff.
                  User must confirm; WorkbenchContext applies the patch.

conversational  — Greetings / meta / off-topic.  Instant reply, no tools.

STAGED — economic_analysis (M1.0)
----------------------------------
When a user asks a value/economic question the agent will:
  1.  Detect route = "economic_analysis"
  2.  Load green-book.md + evidence-triage.md skills from context_packet
  3.  Run Five Case analysis with match + passport context
  4.  Produce ModelPatchProposal with EconomicCaseBlock (npv_waterfall visual)
      containing: npv_value, discount_rate, section_scores, BCR
  5.  Frontend shows EconomicCaseBlock diff → user confirms → patch applied

Mapping of Five Case to workbench surfaces:
  Strategic Case  → RecommendationConfidence (already rendered — no new block)
  Economic Case   → EconomicCaseBlock (new block, M1.0)
  Commercial Case → CommercialCaseBlock (new block, M1.1 — needs new passport data)
  Financial Case  → FinancialCaseBlock (new block, M1.1 — needs new passport data)
  Management Case → ActionPlanBlock (partial fit — extend in M1.0)

DO NOT implement economic_analysis route until:
  - model_patch pattern is proven end-to-end (M0.9)
  - EconomicCaseBlock added to atlas-render-model.ts
  - npv_waterfall visual wired to block-vocabulary.ts (already listed as ready)

TRANSPORT
---------
Frontend connects via assistant-ui → LangGraph CLI (port 2024).
Thread persistence: MemorySaver (thread_id per workbench session).
Artifact sync: onValues callback reads agent_state["artifact"].

Model: claude-sonnet-4-6 (NEVER OpenAI)
Skills: evidence-triage (inject into system prompt, never call as tool)
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Annotated, Any, Literal
from typing_extensions import TypedDict

_root = Path(__file__).resolve().parent.parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from dotenv import load_dotenv
load_dotenv()

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from agents.llm_factory import get_llm as _get_llm
from agents.mcp_client import search_corpus_projects
from mcps.cpc_corpus.queries import get_project as _verify_project
from agents.base import make_extract_query_node, make_classify_intent_node

# ---------------------------------------------------------------------------
# Skills loader
# ---------------------------------------------------------------------------

_SKILLS_DIR = _root / "skills"


def _load_skill(filename: str) -> str:
    """Load a skill file from /skills/. Returns empty string if missing."""
    p = _SKILLS_DIR / filename
    return p.read_text(encoding="utf-8") if p.exists() else ""


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

WorkbenchRoute = Literal[
    "explain",
    "search",
    "propose",
    "economic_analysis",  # STAGED — M1.0
    "conversational",
]

ConfidenceTier = Literal["Speculative", "Indicative", "Supported", "Robust"]


class ModelSummary(TypedDict):
    artifact_id: str
    match_id: str
    canonical_question_id: str
    source_label: str
    target_label: str
    recommendation: str
    confidence_tier: str
    confidence_cap_reason: str | None
    top_gaps: list[str]
    evidence_counts: dict[str, int]


class WorkbenchState(TypedDict):
    # AG-UI messages — assistant-ui streams these
    messages: Annotated[list, add_messages]
    # Extracted query (reset each turn by extract_query node)
    query: str
    # Slim model summary — injected from WorkbenchAgentInput
    model_summary: ModelSummary | None
    # Full render model JSON (stored in thread state, not sent every turn)
    artifact: dict[str, Any] | None
    # Active lens
    lens: str
    # Routing decision
    route: WorkbenchRoute
    # Output fields
    chat_response: str
    corpus_citations: list[dict[str, Any]]
    model_patch: dict[str, Any] | None  # ModelPatchProposal | None
    confidence_tier: ConfidenceTier
    reasoning_trace: list[dict[str, Any]]
    error: str | None
    # Internal: set by classify_intent
    _is_conversational: bool


# ---------------------------------------------------------------------------
# LLM
# ---------------------------------------------------------------------------

def _llm():
    return _get_llm()  # returns claude-sonnet-4-6 via llm_factory.py


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

_EVIDENCE_TRIAGE_SKILL = _load_skill("evidence-triage.md")


def _build_system_prompt(
    model_summary: ModelSummary | None,
    lens: str,
    route: WorkbenchRoute,
) -> str:
    summary_block = ""
    if model_summary:
        summary_block = f"""
## Current Workbench Context

Source: {model_summary.get("source_label", "Unknown")}
Target: {model_summary.get("target_label", "Unknown")}
Recommendation: {model_summary.get("recommendation", "—")}
Confidence Tier: {model_summary.get("confidence_tier", "Speculative")}
Cap Reason: {model_summary.get("confidence_cap_reason") or "None"}
Top Gaps:
{chr(10).join(f"- {g}" for g in model_summary.get("top_gaps", []))}
Evidence: {model_summary.get("evidence_counts", {})}
"""

    route_instructions = {
        "explain": (
            "You are answering a question about the current match evidence.\n"
            "Use the workbench context above. Cite specific claims, gaps, or evidence.\n"
            "Do NOT search the corpus. Do NOT propose a model patch.\n"
            "Keep your answer concise — under 200 words unless detail is required."
        ),
        "search": (
            "The user wants corpus evidence. You have already called search_corpus_projects.\n"
            "Summarise the results with corpus citations (real IDs only — verified below).\n"
            "Do NOT propose a model patch unless the user explicitly asks."
        ),
        "propose": (
            "You are proposing a structured update to the workbench artifact.\n"
            "Your response MUST include a model_patch in your final JSON output.\n"
            "State clearly what you are changing and why (rationale).\n"
            "Never apply the patch yourself — the user must confirm in the UI."
        ),
        "economic_analysis": (
            # STAGED M1.0 — placeholder prompt, route not yet wired
            "ECONOMIC ANALYSIS ROUTE — NOT YET IMPLEMENTED (M1.0).\n"
            "Respond: 'Economic case analysis is coming in the next release. "
            "I can currently show you the gap_value_estimate from the match record.'"
        ),
        "conversational": (
            "This is a greeting or meta question. Respond naturally and briefly."
        ),
    }

    return f"""You are the Atlas Workbench assistant, a strategic intelligence tool
for Connected Places Catapult analysts.

Lens: {lens}
Route: {route}

{summary_block}

## Your role for this turn
{route_instructions.get(route, "")}

## Evidence triage skill (always apply)
{_EVIDENCE_TRIAGE_SKILL[:1500] if _EVIDENCE_TRIAGE_SKILL else "Apply rigorous evidence standards. Never hallucinate citations."}

## Critical rules
- Confidence tier: NEVER emit a tier higher than the model's existing tier.
- Citations: Only cite IDs that were verified to exist in atlas.projects.
- Model patches: Only when route = "propose". User must confirm before applying.
- Five Case / economic analysis: Staged for M1.0. Do not run spontaneously.
- SUPABASE_SERVICE_KEY: Never reference in any output.
"""


# ---------------------------------------------------------------------------
# Route classifier
# ---------------------------------------------------------------------------

_ROUTE_PROMPT = """Classify the user's intent into exactly one of these routes.

Routes:
  explain         — asking about the current match/evidence/gaps/confidence
  search          — explicitly wants corpus search, new evidence, or comparators
  propose         — wants to update, edit, add, or remove something from the artifact
  economic_analysis — asks about NPV, BCR, value, cost-benefit, Five Case, economic case
  conversational  — greeting, thank you, meta, or off-topic

User message: {query}

Reply with ONLY the route word. Nothing else."""


def classify_route(state: WorkbenchState) -> dict:
    """Classify the user's query into a workbench route."""
    query = state.get("query", "")
    if not query.strip():
        return {"route": "conversational"}

    llm = _llm()
    msg = llm.invoke([HumanMessage(content=_ROUTE_PROMPT.format(query=query))])
    raw = msg.content.strip().lower().split()[0] if msg.content else "explain"

    valid_routes = {"explain", "search", "propose", "economic_analysis", "conversational"}
    route: WorkbenchRoute = raw if raw in valid_routes else "explain"  # type: ignore[assignment]

    return {
        "route": route,
        "reasoning_trace": [
            {"label": f"Route classified: {route}", "status": "complete"},
        ],
    }


# ---------------------------------------------------------------------------
# Node: extract_query (from base.py factory)
# ---------------------------------------------------------------------------

extract_query = make_extract_query_node({
    "route": "explain",
    "chat_response": "",
    "corpus_citations": [],
    "model_patch": None,
    "confidence_tier": "Speculative",
    "reasoning_trace": [],
    "error": None,
    "_is_conversational": False,
})

# ---------------------------------------------------------------------------
# Node: explain
# ---------------------------------------------------------------------------


def explain_node(state: WorkbenchState) -> dict:
    """Answer a question about the current artifact. No corpus search."""
    trace = state.get("reasoning_trace", [])
    trace.append({"label": "Reading workbench context", "status": "active"})

    system = _build_system_prompt(
        state.get("model_summary"),
        state.get("lens", "CPC"),
        "explain",
    )

    messages = [SystemMessage(content=system)] + list(state.get("messages", []))
    llm = _llm()
    response = llm.invoke(messages)

    trace.append({"label": "Generating explanation", "status": "complete"})

    return {
        "chat_response": response.content,
        "confidence_tier": state.get("confidence_tier", "Speculative"),
        "reasoning_trace": trace,
        "messages": [AIMessage(content=response.content)],
    }


# ---------------------------------------------------------------------------
# Node: search
# ---------------------------------------------------------------------------


def search_node(state: WorkbenchState) -> dict:
    """Search the corpus and summarise results with verified citations."""
    trace = state.get("reasoning_trace", [])
    query = state.get("query", "")
    model_summary = state.get("model_summary") or {}

    trace.append({"label": "Searching CPC corpus", "status": "active"})

    # --- corpus search ---
    raw_results: list[dict[str, Any]] = []
    try:
        # Enrich query with source/target labels for better recall
        enriched_query = (
            f"{query} "
            f"{model_summary.get('source_label', '')} "
            f"{model_summary.get('target_label', '')}"
        ).strip()
        raw_results = search_corpus_projects.invoke({"query": enriched_query, "k": 8})
        if not isinstance(raw_results, list):
            raw_results = []
    except Exception as exc:
        trace.append({"label": "Corpus search failed", "status": "error", "detail": str(exc)})

    trace.append({"label": f"Found {len(raw_results)} results", "status": "active"})

    # --- citation verification ---
    verified: list[dict[str, Any]] = []
    for r in raw_results:
        proj_id = r.get("id") or r.get("project_id", "")
        if not proj_id:
            continue
        try:
            proj = _verify_project(proj_id)
            if proj:
                verified.append({
                    "id": proj_id,
                    "title": r.get("title", proj.get("project_title", "")),
                    "organisation": r.get("organisation", proj.get("organisation", "")),
                    "relevance_note": r.get("relevance_note", ""),
                    "score": float(r.get("similarity", 0)),
                })
        except Exception:
            continue  # skip unverifiable IDs

    trace.append({"label": f"Verified {len(verified)} citations", "status": "complete"})

    # --- LLM synthesis ---
    system = _build_system_prompt(
        state.get("model_summary"),
        state.get("lens", "CPC"),
        "search",
    )
    citations_json = json.dumps(verified, indent=2)
    synthesis_prompt = (
        f"Based on these corpus search results, answer the user's question.\n\n"
        f"Search results:\n{citations_json}\n\n"
        f"User question: {query}"
    )
    messages = [
        SystemMessage(content=system),
        HumanMessage(content=synthesis_prompt),
    ]
    llm = _llm()
    response = llm.invoke(messages)

    return {
        "chat_response": response.content,
        "corpus_citations": verified,
        "confidence_tier": _derive_search_tier(verified),
        "reasoning_trace": trace,
        "messages": [AIMessage(content=response.content)],
    }


def _derive_search_tier(citations: list[dict]) -> ConfidenceTier:
    """Derive a confidence tier from search result scores."""
    if not citations:
        return "Speculative"
    top = max(c.get("score", 0) for c in citations)
    if top >= 0.85:
        return "Supported"
    if top >= 0.70:
        return "Indicative"
    return "Speculative"


# ---------------------------------------------------------------------------
# Node: propose
# ---------------------------------------------------------------------------

_PROPOSE_SYSTEM_SUFFIX = """
## Model patch output format

You MUST include a `model_patch` key in your response JSON with this shape:
{
  "rationale": "Human-readable explanation of the change",
  "ops": [
    {"op": "add_block", "block": {...RenderBlock...}, "at_index": null},
    {"op": "update_block", "block_id": "...", "patch": {...}},
    {"op": "remove_block", "block_id": "..."},
    {"op": "update_spine", "patch": {...}}
  ],
  "confidence_tier": "Indicative",
  "corpus_citations": [...]
}

IMPORTANT: Only one patch per response. User must confirm before it is applied.
"""


def propose_node(state: WorkbenchState) -> dict:
    """Propose a structured model_patch for the user to confirm."""
    trace = state.get("reasoning_trace", [])
    trace.append({"label": "Analysing proposed change", "status": "active"})

    system = _build_system_prompt(
        state.get("model_summary"),
        state.get("lens", "CPC"),
        "propose",
    ) + _PROPOSE_SYSTEM_SUFFIX

    messages = [SystemMessage(content=system)] + list(state.get("messages", []))
    llm = _llm()
    response = llm.invoke(messages)

    # --- parse model_patch from response ---
    model_patch = None
    chat_text = response.content
    try:
        # Expect the LLM to embed JSON in a ```json block or as raw JSON
        import re
        m = re.search(r"```json\s*(\{.*?\})\s*```", response.content, re.DOTALL)
        if not m:
            m = re.search(r"(\{[^{]*\"model_patch\".*\})", response.content, re.DOTALL)
        if m:
            parsed = json.loads(m.group(1))
            model_patch = parsed.get("model_patch") or parsed
            # Extract prose before the JSON block as the chat response
            chat_text = response.content[:m.start()].strip() or (
                "I've prepared a patch proposal — see the confirmation panel below."
            )
    except Exception:
        pass  # non-JSON response: treat entire response as chat_text

    trace.append({"label": "Patch proposal ready", "status": "complete"})

    return {
        "chat_response": chat_text,
        "model_patch": model_patch,
        "confidence_tier": "Indicative",
        "reasoning_trace": trace,
        "messages": [AIMessage(content=response.content)],
    }


# ---------------------------------------------------------------------------
# Node: economic_analysis (STAGED — M1.0 placeholder)
# ---------------------------------------------------------------------------

def economic_analysis_node(state: WorkbenchState) -> dict:
    """
    STAGED placeholder for M1.0.

    Full implementation will:
      1. Load green-book.md + evidence-triage.md skills
      2. Run Five Case Model with match + passport context
      3. Emit ModelPatchProposal with EconomicCaseBlock (npv_waterfall visual)
         containing: npv_value (at 3.5% STPR), discount_rate, section_scores, BCR
      4. Frontend shows EconomicCaseBlock diff → user confirms → patch applied

    Five Case blocks staged:
      Economic Case   → EconomicCaseBlock  (needs: type in atlas-render-model.ts)
      Commercial Case → CommercialCaseBlock (M1.1 — needs new passport fields)
      Financial Case  → FinancialCaseBlock  (M1.1 — needs new passport fields)
      Management Case → extend ActionPlanBlock (M1.0)
      Strategic Case  → already in RecommendationConfidence (no new block needed)
    """
    model_summary = state.get("model_summary") or {}
    gap_value = "not yet available in this release"

    trace = [{"label": "Economic analysis route (staged M1.0)", "status": "complete"}]

    chat_response = (
        "Full Five Case economic analysis is staged for the next release (M1.0).\n\n"
        "What I can show you now from the current match record:\n"
        f"- Match score: {model_summary.get('confidence_tier', 'not available')}\n"
        f"- Gap value estimate: {gap_value}\n\n"
        "When M1.0 is live, asking 'run economic case' will trigger a Five Case "
        "analysis (Strategic, Economic, Commercial, Financial, Management) and "
        "propose an update to this artifact with an NPV waterfall and section scores."
    )

    return {
        "chat_response": chat_response,
        "reasoning_trace": trace,
        "confidence_tier": state.get("confidence_tier", "Speculative"),
        "messages": [AIMessage(content=chat_response)],
    }


# ---------------------------------------------------------------------------
# Node: conversational
# ---------------------------------------------------------------------------

def conversational_node(state: WorkbenchState) -> dict:
    """Handle greetings / meta / off-topic messages instantly."""
    llm = _llm()
    messages = [
        SystemMessage(content=(
            "You are the Atlas Workbench assistant. "
            "Respond briefly to this conversational message."
        )),
    ] + list(state.get("messages", []))
    response = llm.invoke(messages)
    return {
        "chat_response": response.content,
        "confidence_tier": "Speculative",
        "reasoning_trace": [{"label": "Conversational response", "status": "complete"}],
        "messages": [AIMessage(content=response.content)],
    }


# ---------------------------------------------------------------------------
# Routing edge
# ---------------------------------------------------------------------------

def route_to_node(state: WorkbenchState) -> str:
    """Edge function: dispatch to the appropriate processing node."""
    if state.get("_is_conversational"):
        return "conversational"
    route = state.get("route", "explain")
    return {
        "explain": "explain",
        "search": "search",
        "propose": "propose",
        "economic_analysis": "economic_analysis",
        "conversational": "conversational",
    }.get(route, "explain")


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------

def build_graph():
    graph = StateGraph(WorkbenchState)

    # Nodes
    graph.add_node("extract_query", extract_query)
    graph.add_node("classify_intent", make_classify_intent_node())
    graph.add_node("classify_route", classify_route)
    graph.add_node("explain", explain_node)
    graph.add_node("search", search_node)
    graph.add_node("propose", propose_node)
    graph.add_node("economic_analysis", economic_analysis_node)
    graph.add_node("conversational", conversational_node)

    # Entry
    graph.set_entry_point("extract_query")

    # Edge: extract_query → classify_intent
    graph.add_edge("extract_query", "classify_intent")

    # Edge: classify_intent → classify_route (domain) or conversational
    graph.add_conditional_edges(
        "classify_intent",
        lambda s: "conversational" if s.get("_is_conversational") else "classify_route",
        {"conversational": "conversational", "classify_route": "classify_route"},
    )

    # Edge: classify_route → processing nodes
    graph.add_conditional_edges(
        "classify_route",
        route_to_node,
        {
            "explain": "explain",
            "search": "search",
            "propose": "propose",
            "economic_analysis": "economic_analysis",
            "conversational": "conversational",
        },
    )

    # All processing nodes → END
    for node in ["explain", "search", "propose", "economic_analysis", "conversational"]:
        graph.add_edge(node, END)

    return graph.compile(checkpointer=MemorySaver())


# ---------------------------------------------------------------------------
# Exported graph (used by agents/server.py + langgraph.json)
# ---------------------------------------------------------------------------

graph = build_graph()

__all__ = ["graph"]
