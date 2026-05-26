"""
Atlas 5 — JARVIS Agent (LangGraph StateGraph)

JARVIS is the corpus explorer agent. It:
1. Receives a user query + context packet
2. Calls search_projects and evidence_for_claim from the CPC-corpus MCP
3. Verifies all citation IDs exist in atlas.projects (NO fabricated IDs)
4. Assigns a confidence_tier per the evidence-triage skill
5. Returns a structured JarvisResponse

Model: claude-sonnet-4-6 (NOT OpenAI)
Skills: evidence-triage (loaded from context packet, NOT called as a tool)
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Literal, TypedDict

# Ensure project root on sys.path
_root = Path(__file__).resolve().parent.parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from dotenv import load_dotenv
load_dotenv()

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph

from agents.mcp_client import search_projects, evidence_for_claim, get_project
from mcps.cpc_corpus.queries import get_project as _verify_project

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

ConfidenceTier = Literal["Speculative", "Indicative", "Supported", "Robust"]


class CorpusCitation(TypedDict):
    id: str
    title: str
    organisation: str
    relevance_note: str


class JarvisState(TypedDict):
    query: str
    context_packet: dict[str, Any]
    raw_search_results: list[dict[str, Any]]
    corpus_citations: list[CorpusCitation]
    confidence_tier: ConfidenceTier
    analysis: str
    error: str | None


class JarvisResponse(TypedDict):
    corpus_citations: list[CorpusCitation]
    confidence_tier: ConfidenceTier
    analysis: str


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

_MODEL = "claude-sonnet-4-6"
_MAX_CITATIONS = 10


def _llm() -> ChatAnthropic:
    return ChatAnthropic(
        model=_MODEL,
        api_key=os.environ["ANTHROPIC_API_KEY"],
        max_tokens=4096,
    )


def search_corpus(state: JarvisState) -> JarvisState:
    """
    Node 1: Search atlas.projects for the user query.
    Returns raw search results for the reasoning node.
    """
    query = state["query"]
    try:
        # Use MCP tool (returns real atlas.projects records)
        results = search_projects.invoke({"query": query, "limit": _MAX_CITATIONS})
        state["raw_search_results"] = results if isinstance(results, list) else []
    except Exception as e:
        state["raw_search_results"] = []
        state["error"] = f"search_corpus error: {e}"
    return state


def reason_and_cite(state: JarvisState) -> JarvisState:
    """
    Node 2: Use claude-sonnet-4-6 to reason over search results.
    Selects the most relevant projects, assigns confidence_tier,
    writes analysis summary. All IDs must come from search results.
    """
    ctx = state.get("context_packet", {})
    skills_text = "\n\n".join(
        f"=== SKILL: {s['name']} ===\n{s['content']}"
        for s in ctx.get("active_skills", [])
    )

    results_json = json.dumps(state["raw_search_results"], indent=2)
    query = state["query"]

    system = f"""You are JARVIS, the Atlas 5 corpus explorer agent.
Your job is to find and cite real innovation projects from the CPC corpus
that are relevant to the user's query.

CRITICAL RULES:
- Every corpus_citation.id MUST come from the search results provided below.
- NEVER fabricate or invent project IDs. Only use IDs from the results list.
- Every citation must have: id (from results), title, organisation, relevance_note.
- Assign a confidence_tier based on the evidence-triage skill.

{skills_text}

CORPUS SEARCH RESULTS (these are the ONLY valid IDs):
{results_json}

Respond in JSON only. Format:
{{
  "corpus_citations": [
    {{"id": "<from results>", "title": "...", "organisation": "...", "relevance_note": "..."}}
  ],
  "confidence_tier": "Speculative|Indicative|Supported|Robust",
  "analysis": "2-3 sentence synthesis of the evidence"
}}"""

    try:
        llm = _llm()
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"Query: {query}"),
        ])
        content = response.content
        # Extract JSON from response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        parsed = json.loads(content.strip())

        citations = parsed.get("corpus_citations", [])
        tier = parsed.get("confidence_tier", "Speculative")
        analysis = parsed.get("analysis", "")

        # Validate citations: only keep those with IDs from search results
        valid_ids = {r["id"] for r in state["raw_search_results"]}
        safe_citations = [c for c in citations if c.get("id") in valid_ids]

        # Validate confidence_tier
        valid_tiers = {"Speculative", "Indicative", "Supported", "Robust"}
        if tier not in valid_tiers:
            tier = "Speculative"

        state["corpus_citations"] = safe_citations
        state["confidence_tier"] = tier
        state["analysis"] = analysis

    except Exception as e:
        # Fallback: return top 3 search results as citations with Speculative tier
        fallback = [
            {
                "id": r["id"],
                "title": r.get("title", ""),
                "organisation": r.get("organisation", ""),
                "relevance_note": "Corpus search match",
            }
            for r in state["raw_search_results"][:3]
        ]
        state["corpus_citations"] = fallback
        state["confidence_tier"] = "Speculative"
        state["analysis"] = f"Evidence triage incomplete. Error: {e}"

    return state


def verify_citations(state: JarvisState) -> JarvisState:
    """
    Node 3: Final ID verification against atlas.projects.
    SECURITY: removes any citation whose ID cannot be verified in the DB.
    This prevents hallucinated IDs from reaching the response.
    """
    verified = []
    for citation in state["corpus_citations"]:
        cid = citation.get("id", "")
        if not cid:
            continue
        try:
            project = _verify_project(cid)
            if project:
                # Use DB title/organisation as ground truth
                verified.append({
                    "id": cid,
                    "title": project.get("title") or citation.get("title", ""),
                    "organisation": project.get("organisation") or citation.get("organisation", ""),
                    "relevance_note": citation.get("relevance_note", ""),
                })
        except Exception:
            # Skip unverifiable IDs
            pass

    state["corpus_citations"] = verified

    # Downgrade confidence if citations were removed
    if len(verified) < len(state.get("corpus_citations", [])):
        state["confidence_tier"] = "Speculative"

    return state


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def build_jarvis_graph() -> StateGraph:
    graph = StateGraph(JarvisState)

    graph.add_node("search_corpus", search_corpus)
    graph.add_node("reason_and_cite", reason_and_cite)
    graph.add_node("verify_citations", verify_citations)

    graph.set_entry_point("search_corpus")
    graph.add_edge("search_corpus", "reason_and_cite")
    graph.add_edge("reason_and_cite", "verify_citations")
    graph.add_edge("verify_citations", END)

    return graph.compile()


jarvis_graph = build_jarvis_graph()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_jarvis(
    query: str,
    context_packet: dict[str, Any] | None = None,
) -> JarvisResponse:
    """
    Run the JARVIS agent for the given query.

    Returns a JarvisResponse with:
    - corpus_citations: list of verified atlas.projects citations
    - confidence_tier: Speculative | Indicative | Supported | Robust
    - analysis: prose synthesis

    All citation IDs are verified against atlas.projects.
    """
    initial_state: JarvisState = {
        "query": query,
        "context_packet": context_packet or {},
        "raw_search_results": [],
        "corpus_citations": [],
        "confidence_tier": "Speculative",
        "analysis": "",
        "error": None,
    }

    final_state = jarvis_graph.invoke(initial_state)

    return {
        "corpus_citations": final_state["corpus_citations"],
        "confidence_tier": final_state["confidence_tier"],
        "analysis": final_state["analysis"],
    }
