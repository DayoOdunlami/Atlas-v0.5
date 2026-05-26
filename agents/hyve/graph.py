"""
Atlas 5 — HYVE Agent (LangGraph StateGraph)

HYVE is the climate adaptation agent. It:
1. Searches the HIVE climate adaptation corpus for relevant articles
2. Uses claude-sonnet-4-6 to select relevant articles, determine transport mode,
   and assign a confidence_tier per the evidence-triage skill
3. Resolves chunk-level results to parent article IDs (HIVE citation model)
4. Verifies all article_ids exist in hive.articles (NO fabricated IDs)
5. Returns structured hive_citations with article_id, title, score

Model: claude-sonnet-4-6 (NOT OpenAI)
Skills loaded: evidence-triage (from context packet)
Citation model: article-level (hive.articles.id) — locked per ATLAS5.md
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

from agents.mcp_client import search_hive
from mcps.cpc_corpus.queries import _conn

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

ConfidenceTier = Literal["Speculative", "Indicative", "Supported", "Robust"]


class HiveCitation(TypedDict):
    article_id: str
    title: str
    score: float
    chunk_id: str | None   # optional provenance — may be None


class HyveState(TypedDict):
    query: str
    context_packet: dict[str, Any]
    raw_hive_results: list[dict[str, Any]]
    hive_citations: list[HiveCitation]
    transport_mode: str
    confidence_tier: ConfidenceTier
    analysis: str
    error: str | None


class HyveResponse(TypedDict):
    hive_citations: list[HiveCitation]
    transport_mode: str
    confidence_tier: str
    analysis: str


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

_MODEL = "claude-sonnet-4-6"
_MAX_RESULTS = 10


def _verify_hive_ids(ids: list[str]) -> set[str]:
    """
    Check which article IDs actually exist in hive.articles.
    Returns a set of verified ID strings.
    Uses psycopg2 directly per ATLAS5.md instruction for HYVE verification.
    """
    if not ids:
        return set()
    conn = _conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id::text FROM hive.articles WHERE id = ANY(%s::uuid[])",
            (ids,),
        )
        return {r[0] for r in cur.fetchall()}
    except Exception:
        return set()
    finally:
        conn.close()


def _llm() -> ChatAnthropic:
    return ChatAnthropic(
        model=_MODEL,
        api_key=os.environ["ANTHROPIC_API_KEY"],
        max_tokens=4096,
    )


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

def search_hive_corpus(state: HyveState) -> HyveState:
    """
    Node 1: Search the HIVE climate adaptation corpus.
    Returns raw results with article_id and title from hive.articles.
    """
    query = state["query"]
    try:
        results = search_hive.invoke({"query": query, "limit": _MAX_RESULTS})
        # Normalise: ensure each result has article_id and title
        normalised = []
        for r in (results if isinstance(results, list) else []):
            normalised.append({
                "article_id": r.get("article_id", ""),
                "title": r.get("title", ""),
                "score": float(r.get("score", 0.0)),
                "chunk_id": r.get("chunk_id"),  # may be None
            })
        state["raw_hive_results"] = normalised
    except Exception as e:
        state["raw_hive_results"] = []
        state["error"] = f"search_hive_corpus error: {e}"
    return state


def reason_and_cite(state: HyveState) -> HyveState:
    """
    Node 2: Use claude-sonnet-4-6 to select relevant HIVE articles.

    Determines:
    - hive_citations: relevant articles from raw_hive_results ONLY
    - transport_mode: e.g. "rail", "active travel", "road", "multi-modal"
    - confidence_tier: per evidence-triage skill
    - analysis: 2–3 sentence synthesis

    ALL article_ids must come from raw_hive_results.
    """
    ctx = state.get("context_packet", {})
    skills_text = "\n\n".join(
        f"=== SKILL: {s['name']} ===\n{s['content']}"
        for s in ctx.get("active_skills", [])
    )

    results_json = json.dumps(state["raw_hive_results"], indent=2)
    query = state["query"]

    system = f"""You are HYVE, the Atlas 5 climate adaptation agent for Connected Places Catapult.

Your task is to identify relevant climate adaptation evidence from the HIVE corpus and
provide a structured assessment for the given query.

MANDATORY RULES:
1. Every hive_citation.article_id MUST come from the HIVE SEARCH RESULTS provided below.
2. NEVER fabricate or invent article IDs. Only use article_ids from the results list.
3. transport_mode: one of "rail", "road", "active travel", "maritime", "aviation", "multi-modal", or "unspecified".
4. confidence_tier: assigned per the evidence-triage skill.
5. analysis: 2–3 sentences summarising the climate adaptation evidence.
6. Cite at article level (article_id) — this is the locked HIVE citation model.

{skills_text}

HIVE SEARCH RESULTS (these are the ONLY valid article_ids to cite):
{results_json}

Respond in JSON ONLY. Format:
{{
  "hive_citations": [
    {{
      "article_id": "<from results>",
      "title": "...",
      "score": 0.85
    }}
  ],
  "transport_mode": "rail",
  "confidence_tier": "Speculative|Indicative|Supported|Robust",
  "analysis": "2–3 sentence synthesis of climate adaptation evidence."
}}"""

    try:
        llm = _llm()
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"Climate adaptation query: {query}"),
        ])
        content = response.content

        # Extract JSON from response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        parsed = json.loads(content.strip())

        # Validate citations — only article_ids from raw_hive_results
        valid_ids = {r["article_id"] for r in state["raw_hive_results"]}
        raw_citations = parsed.get("hive_citations", [])
        safe_citations: list[HiveCitation] = []
        for c in raw_citations:
            if not isinstance(c, dict):
                continue
            aid = c.get("article_id", "")
            if aid not in valid_ids:
                continue
            # Find original result to get chunk_id provenance if available
            orig = next(
                (r for r in state["raw_hive_results"] if r["article_id"] == aid),
                {},
            )
            safe_citations.append({
                "article_id": aid,
                "title": str(c.get("title", orig.get("title", ""))),
                "score": float(c.get("score", orig.get("score", 0.0))),
                "chunk_id": orig.get("chunk_id"),
            })

        # Validate transport_mode
        valid_modes = {
            "rail", "road", "active travel", "maritime",
            "aviation", "multi-modal", "unspecified",
        }
        transport_mode = str(parsed.get("transport_mode", "unspecified"))
        if transport_mode not in valid_modes:
            transport_mode = "unspecified"

        # Validate confidence_tier
        tier = parsed.get("confidence_tier", "Speculative")
        valid_tiers = {"Speculative", "Indicative", "Supported", "Robust"}
        if tier not in valid_tiers:
            tier = "Speculative"

        state["hive_citations"] = safe_citations
        state["transport_mode"] = transport_mode
        state["confidence_tier"] = tier
        state["analysis"] = str(parsed.get("analysis", ""))

    except Exception as e:
        # Fallback: return top 3 raw results as citations with Speculative tier
        fallback: list[HiveCitation] = [
            {
                "article_id": r["article_id"],
                "title": r.get("title", ""),
                "score": r.get("score", 0.0),
                "chunk_id": r.get("chunk_id"),
            }
            for r in state["raw_hive_results"][:3]
        ]
        state["hive_citations"] = fallback
        state["transport_mode"] = "unspecified"
        state["confidence_tier"] = "Speculative"
        state["analysis"] = f"Climate adaptation assessment incomplete. Error: {e}"
        state["error"] = f"reason_and_cite error: {e}"

    return state


def verify_hive_citations(state: HyveState) -> HyveState:
    """
    Node 3: Verify every hive_citation.article_id against hive.articles.
    Uses psycopg2 directly to query hive.articles — no ORM.
    Strips any article_id not found in the DB.
    """
    candidate_ids = [c["article_id"] for c in state["hive_citations"] if c.get("article_id")]
    if not candidate_ids:
        return state

    pre_verify_count = len(state["hive_citations"])
    try:
        verified_ids = _verify_hive_ids(candidate_ids)
    except Exception:
        # If DB check fails entirely, keep citations but downgrade confidence
        verified_ids = set()

    verified: list[HiveCitation] = [
        c for c in state["hive_citations"]
        if c.get("article_id") in verified_ids
    ]
    state["hive_citations"] = verified

    # Downgrade confidence tier if citations were removed
    if len(verified) < pre_verify_count:
        valid_tiers = ["Speculative", "Indicative", "Supported", "Robust"]
        current = state.get("confidence_tier", "Speculative")
        current_idx = valid_tiers.index(current) if current in valid_tiers else 3
        state["confidence_tier"] = valid_tiers[max(0, current_idx - 1)]

    return state


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def build_hyve_graph() -> StateGraph:
    graph = StateGraph(HyveState)

    graph.add_node("search_hive_corpus", search_hive_corpus)
    graph.add_node("reason_and_cite", reason_and_cite)
    graph.add_node("verify_hive_citations", verify_hive_citations)

    graph.set_entry_point("search_hive_corpus")
    graph.add_edge("search_hive_corpus", "reason_and_cite")
    graph.add_edge("reason_and_cite", "verify_hive_citations")
    graph.add_edge("verify_hive_citations", END)

    return graph.compile()


hyve_graph = build_hyve_graph()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_hyve(
    query: str,
    context_packet: dict[str, Any] | None = None,
) -> HyveResponse:
    """
    Run the HYVE agent for the given climate adaptation query.

    Args:
        query: The user's climate adaptation question.
        context_packet: Atlas 5 context packet with active_skills, lens, etc.

    Returns a HyveResponse with:
    - hive_citations: verified hive.articles citations [{article_id, title, score, chunk_id}]
    - transport_mode: one of rail / road / active travel / maritime / aviation / multi-modal / unspecified
    - confidence_tier: Speculative | Indicative | Supported | Robust
    - analysis: prose synthesis

    All article_ids are verified against hive.articles.
    Citation model: article-level (locked per ATLAS5.md).
    """
    initial_state: HyveState = {
        "query": query,
        "context_packet": context_packet or {},
        "raw_hive_results": [],
        "hive_citations": [],
        "transport_mode": "unspecified",
        "confidence_tier": "Speculative",
        "analysis": "",
        "error": None,
    }

    final_state = hyve_graph.invoke(initial_state)

    return {
        "hive_citations": final_state["hive_citations"],
        "transport_mode": final_state["transport_mode"],
        "confidence_tier": final_state["confidence_tier"],
        "analysis": final_state["analysis"],
    }
