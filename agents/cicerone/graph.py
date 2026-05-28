"""
Atlas 5 — CICERONE Agent (LangGraph StateGraph)

CICERONE is the cross-sector transfer agent. It:
1. Searches the CPC corpus for projects relevant to source and target contexts
2. Uses claude-sonnet-4-6 to score transferability (0–100) between contexts
3. Identifies sector analogues and evidence gaps (HAVE/PARTIAL/MISSING)
4. Verifies all citation IDs exist in atlas.projects (NO fabricated IDs)
5. Assigns a confidence_tier per the evidence-triage skill

Model: claude-sonnet-4-6 (NOT OpenAI)
Skills loaded: analogue-method + green-book + evidence-triage (from context packet)
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Annotated, Any, Literal, TypedDict

# Ensure project root on sys.path
_root = Path(__file__).resolve().parent.parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from dotenv import load_dotenv
load_dotenv()

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from agents.mcp_client import search_projects
from mcps.cpc_corpus.queries import get_project as _verify_project
# Shared base utilities — use these for extraction and intent, never re-implement
from agents.base import make_extract_query_node, make_classify_intent_node

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

ConfidenceTier = Literal["Speculative", "Indicative", "Supported", "Robust"]
EvidenceStatus = Literal["HAVE", "PARTIAL", "MISSING"]


class EvidenceGap(TypedDict):
    area: str
    status: EvidenceStatus
    note: str


class CorpusCitation(TypedDict):
    id: str
    title: str
    organisation: str
    score: float


class CiceroneState(TypedDict):
    # AG-UI messages — primary input via CopilotKit/HttpAgent;
    # add_messages reducer handles deduplication by message ID.
    messages: Annotated[list, add_messages]
    # query — extracted from messages (AG-UI path) or passed directly (REST path)
    query: str
    context_packet: dict[str, Any]
    source_context: str       # the "from" context (e.g. "autonomous last-mile delivery")
    target_context: str       # the "to" context (e.g. "NHS patient transport")
    raw_search_results: list[dict[str, Any]]
    transferability_score: int | None   # 0–100
    sector_analogues: list[str]
    evidence_gaps: list[EvidenceGap]
    corpus_citations: list[CorpusCitation]
    confidence_tier: ConfidenceTier
    analysis: str
    error: str | None
    # Set True by classify_intent when the message is conversational (greeting /
    # meta / off-topic). Routes graph directly to END without calling any tools.
    _is_conversational: bool


class CiceroneResponse(TypedDict):
    transferability_score: int
    sector_analogues: list[str]
    evidence_gaps: list[EvidenceGap]
    corpus_citations: list[CorpusCitation]
    confidence_tier: str
    analysis: str


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

_MODEL = "claude-sonnet-4-6"
_MAX_RESULTS = 10


def _llm() -> ChatAnthropic:
    return ChatAnthropic(
        model=_MODEL,
        api_key=os.environ["ANTHROPIC_API_KEY"],
        max_tokens=4096,
    )


# ---------------------------------------------------------------------------
# Node 0 — query extraction (shared base)
# ---------------------------------------------------------------------------
extract_query = make_extract_query_node({
    "raw_search_results": [],
    "corpus_citations": [],
    "transferability_score": None,
    "sector_analogues": [],
    "evidence_gaps": [],
    "confidence_tier": "Speculative",
    "analysis": "",
    "_is_conversational": False,
    "error": None,
})

# ---------------------------------------------------------------------------
# Node 0b — intent classification (shared base)
# ---------------------------------------------------------------------------
classify_intent, _route_after_intent = make_classify_intent_node(
    agent_name="CICERONE",
    agent_description=(
        "CPC's cross-sector transfer agent — scores how well innovations from one "
        "sector transfer to another, with HAVE/PARTIAL/MISSING evidence gaps."
    ),
    pipeline_start_node="search_corpus",
)


def search_corpus(state: CiceroneState) -> CiceroneState:
    """
    Node 1: Search atlas.projects for evidence spanning source and target contexts.
    Combines the query with source/target context for richer retrieval.
    """
    query = state["query"]
    source = state.get("source_context", "")
    target = state.get("target_context", "")

    # Build a combined search query incorporating source and target contexts
    combined_query = query
    if source and target:
        combined_query = f"{query} {source} {target}"
    elif source:
        combined_query = f"{query} {source}"
    elif target:
        combined_query = f"{query} {target}"

    try:
        results = search_projects.invoke({"query": combined_query, "limit": _MAX_RESULTS})
        state["raw_search_results"] = results if isinstance(results, list) else []
    except Exception as e:
        state["raw_search_results"] = []
        state["error"] = f"search_corpus error: {e}"
    return state


def assess_transferability(state: CiceroneState) -> CiceroneState:
    """
    Node 2: Use claude-sonnet-4-6 to assess cross-sector transferability.

    Produces:
    - transferability_score 0–100 (100 = identical contexts, 0 = no transfer)
    - sector_analogues (e.g. "Rail digitalisation → NHS patient transport")
    - evidence_gaps with HAVE/PARTIAL/MISSING status
    - confidence_tier per evidence-triage skill
    - 2–3 sentence analysis
    All citation IDs must come from raw_search_results ONLY.
    """
    ctx = state.get("context_packet", {})
    skills_text = "\n\n".join(
        f"=== SKILL: {s['name']} ===\n{s['content']}"
        for s in ctx.get("active_skills", [])
    )

    results_json = json.dumps(state["raw_search_results"], indent=2)
    query = state["query"]
    source = state.get("source_context", "unspecified source sector")
    target = state.get("target_context", "unspecified target sector")

    system = f"""You are CICERONE, the Atlas 5 cross-sector transfer agent for Connected Places Catapult.

Your task is to assess how well innovations from a SOURCE context can transfer to a TARGET context,
using evidence from the CPC corpus.

SOURCE context: {source}
TARGET context: {target}

MANDATORY RULES:
1. Every corpus_citation.id MUST come from the CORPUS SEARCH RESULTS provided below.
2. NEVER fabricate or invent project IDs. Only use IDs from the results list.
3. transferability_score: integer 0–100 (100 = contexts are identical / perfect transfer, 0 = no viable transfer).
4. sector_analogues: concrete transfer examples, e.g. "Rail predictive maintenance → NHS equipment servicing".
5. evidence_gaps: list areas with status HAVE, PARTIAL, or MISSING and a brief explanatory note.
6. confidence_tier: assigned per the evidence-triage skill.
7. analysis: 2–3 sentences summarising the transferability assessment.

{skills_text}

CORPUS SEARCH RESULTS (these are the ONLY valid IDs to cite):
{results_json}

Respond in JSON ONLY. Format:
{{
  "transferability_score": 65,
  "sector_analogues": [
    "Autonomous last-mile delivery → NHS patient transport routing",
    "Rail real-time tracking → ambulance fleet management"
  ],
  "evidence_gaps": [
    {{"area": "Regulatory compliance", "status": "MISSING", "note": "No evidence of NHS regulatory pathway in corpus"}},
    {{"area": "Route optimisation", "status": "HAVE", "note": "Multiple projects demonstrate transferable algorithms"}},
    {{"area": "Patient safety protocols", "status": "PARTIAL", "note": "Limited evidence from analogous transport modes"}}
  ],
  "corpus_citations": [
    {{"id": "<from results>", "title": "...", "organisation": "...", "score": 0.82}}
  ],
  "confidence_tier": "Speculative|Indicative|Supported|Robust",
  "analysis": "2–3 sentence synthesis of the transferability assessment."
}}"""

    try:
        llm = _llm()
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"Transferability query: {query}"),
        ])
        content = response.content

        # Extract JSON from response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        parsed = json.loads(content.strip())

        # Validate transferability_score
        score = parsed.get("transferability_score", 0)
        try:
            score = max(0, min(100, int(score)))
        except (TypeError, ValueError):
            score = 0

        # Validate sector_analogues
        analogues = parsed.get("sector_analogues", [])
        if not isinstance(analogues, list):
            analogues = []

        # Validate evidence_gaps
        gaps = parsed.get("evidence_gaps", [])
        valid_statuses = {"HAVE", "PARTIAL", "MISSING"}
        safe_gaps: list[EvidenceGap] = []
        for g in gaps:
            if isinstance(g, dict):
                status = g.get("status", "MISSING")
                if status not in valid_statuses:
                    status = "MISSING"
                safe_gaps.append({
                    "area": str(g.get("area", "")),
                    "status": status,
                    "note": str(g.get("note", "")),
                })

        # Validate citations — only IDs from search results
        valid_ids = {r["id"] for r in state["raw_search_results"]}
        citations = parsed.get("corpus_citations", [])
        safe_citations: list[CorpusCitation] = [
            {
                "id": c["id"],
                "title": str(c.get("title", "")),
                "organisation": str(c.get("organisation", "")),
                "score": float(c.get("score", 0.0)),
            }
            for c in citations
            if isinstance(c, dict) and c.get("id") in valid_ids
        ]

        # Validate confidence_tier
        tier = parsed.get("confidence_tier", "Speculative")
        valid_tiers = {"Speculative", "Indicative", "Supported", "Robust"}
        if tier not in valid_tiers:
            tier = "Speculative"

        state["transferability_score"] = score
        state["sector_analogues"] = analogues
        state["evidence_gaps"] = safe_gaps
        state["corpus_citations"] = safe_citations
        state["confidence_tier"] = tier
        state["analysis"] = str(parsed.get("analysis", ""))

    except Exception as e:
        # Fallback: minimal output with Speculative tier
        fallback_citations: list[CorpusCitation] = [
            {
                "id": r["id"],
                "title": r.get("title", ""),
                "organisation": r.get("organisation", ""),
                "score": 0.0,
            }
            for r in state["raw_search_results"][:3]
        ]
        state["transferability_score"] = 0
        state["sector_analogues"] = []
        state["evidence_gaps"] = [
            {"area": "All areas", "status": "MISSING", "note": f"Assessment incomplete: {e}"}
        ]
        state["corpus_citations"] = fallback_citations
        state["confidence_tier"] = "Speculative"
        state["analysis"] = f"Transferability assessment could not be completed. Error: {e}"
        state["error"] = f"assess_transferability error: {e}"

    return state


def verify_citations(state: CiceroneState) -> CiceroneState:
    """
    Node 3: Final ID verification against atlas.projects.
    Removes any citation whose ID cannot be confirmed in the DB.
    Uses DB title/organisation as ground truth.
    """
    pre_verify_count = len(state["corpus_citations"])
    verified: list[CorpusCitation] = []

    for citation in state["corpus_citations"]:
        cid = citation.get("id", "")
        if not cid:
            continue
        try:
            project = _verify_project(cid)
            if project:
                verified.append({
                    "id": cid,
                    "title": project.get("title") or citation.get("title", ""),
                    "organisation": project.get("organisation") or citation.get("organisation", ""),
                    "score": citation.get("score", 0.0),
                })
        except Exception:
            # Skip unverifiable IDs — never include them
            pass

    state["corpus_citations"] = verified

    # Downgrade confidence if citations were removed
    if len(verified) < pre_verify_count:
        valid_tiers = ["Speculative", "Indicative", "Supported", "Robust"]
        current = state.get("confidence_tier", "Speculative")
        current_idx = valid_tiers.index(current) if current in valid_tiers else 3
        # Step down one tier if we lost citations
        state["confidence_tier"] = valid_tiers[max(0, current_idx - 1)]

    return state


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def build_cicerone_graph() -> StateGraph:
    graph = StateGraph(CiceroneState)

    # Node 0: extract latest query from AG-UI messages (no-op on REST path)
    graph.add_node("extract_query", extract_query)
    # Node 0b: intent gate — instant reply for greetings / meta / off-topic
    graph.add_node("classify_intent", classify_intent)
    graph.add_node("search_corpus", search_corpus)
    graph.add_node("assess_transferability", assess_transferability)
    graph.add_node("verify_citations", verify_citations)

    graph.set_entry_point("extract_query")
    graph.add_edge("extract_query", "classify_intent")
    # Conversational → END immediately; domain query → full pipeline
    graph.add_conditional_edges(
        "classify_intent",
        _route_after_intent,
        {END: END, "search_corpus": "search_corpus"},
    )
    graph.add_edge("search_corpus", "assess_transferability")
    graph.add_edge("assess_transferability", "verify_citations")
    graph.add_edge("verify_citations", END)

    # MemorySaver required for AG-UI state snapshots (aget_state() calls).
    # Swap for PostgresSaver in production.
    return graph.compile(checkpointer=MemorySaver())


cicerone_graph = build_cicerone_graph()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_cicerone(
    query: str,
    context_packet: dict[str, Any] | None = None,
    source_context: str = "",
    target_context: str = "",
) -> CiceroneResponse:
    """
    Run the CICERONE agent for the given cross-sector transfer query.

    Args:
        query: The user's question about cross-sector knowledge transfer.
        context_packet: Atlas 5 context packet with active_skills, lens, etc.
        source_context: The "from" sector (e.g. "autonomous last-mile delivery").
        target_context: The "to" sector (e.g. "NHS patient transport").

    Returns a CiceroneResponse with:
    - transferability_score: 0–100 integer
    - sector_analogues: list of transfer example strings
    - evidence_gaps: list of {area, status, note} dicts
    - corpus_citations: verified atlas.projects citations
    - confidence_tier: Speculative | Indicative | Supported | Robust
    - analysis: prose synthesis

    All citation IDs are verified against atlas.projects.
    """
    # Extract source/target from context_packet if not supplied directly
    cp = context_packet or {}
    resolved_source = source_context or cp.get("source_context", "")
    resolved_target = target_context or cp.get("target_context", "")

    initial_state: CiceroneState = {
        "messages": [],            # empty on REST path; AG-UI path sets via input
        "query": query,
        "context_packet": cp,
        "source_context": resolved_source,
        "target_context": resolved_target,
        "raw_search_results": [],
        "transferability_score": None,
        "sector_analogues": [],
        "evidence_gaps": [],
        "corpus_citations": [],
        "confidence_tier": "Speculative",
        "analysis": "",
        "error": None,
        "_is_conversational": False,
    }

    final_state = cicerone_graph.invoke(initial_state)

    return {
        "transferability_score": final_state["transferability_score"] or 0,
        "sector_analogues": final_state["sector_analogues"],
        "evidence_gaps": final_state["evidence_gaps"],
        "corpus_citations": final_state["corpus_citations"],
        "confidence_tier": final_state["confidence_tier"],
        "analysis": final_state["analysis"],
    }
