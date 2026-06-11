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
import re
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
    "explore",      # M1.4 — corpus-wide questions, no match requirement
    "propose",
    "economic_analysis",
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
            "You are running a Five Case economic analysis for this match.\n"
            "Apply Green Book methodology (NPV at 3.5% STPR, Five Case Model).\n"
            "Be explicit about evidence quality — cap confidence at Indicative when claims are self-reported.\n"
            "Produce a structured economic case with value drivers and assumptions."
        ),
        "explore": (
            "You are exploring the CPC corpus beyond this match.\n"
            "Answer the user's question using corpus search results.\n"
            "Where relevant, note connections back to the current match context.\n"
            "Do not restrict yourself to the current match — answer the broader question."
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
  explain         — asking about THIS match: its evidence, gaps, confidence, recommendation
  search          — wants corpus evidence for THIS match: comparators, analogues, corroboration
  explore         — wants to browse/discover BEYOND this match: other projects, general domain questions, "what else is in the corpus", "tell me about X technology", "what other projects deal with Y"
  propose         — wants to update, edit, add, or remove something from the artifact
  economic_analysis — asks about NPV, BCR, value, cost-benefit, Five Case, "is this worth it", "build business case"
  conversational  — greeting, thank you, meta question about the assistant

Key distinction:
  search = "find evidence FOR this match"
  explore = "show me other things / broader questions / not about this specific match"

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

    valid_routes = {"explain", "search", "explore", "propose", "economic_analysis", "conversational"}
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
    "last_output": None,
})

classify_intent, _route_after_intent = make_classify_intent_node(
    agent_name="Workbench",
    agent_description=(
        "Atlas Workbench assistant — explain match evidence, search the CPC corpus, "
        "and propose artifact updates for analyst review."
    ),
    pipeline_start_node="classify_route",
)

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
        enriched_query = (
            f"{query} "
            f"{model_summary.get('source_label', '')} "
            f"{model_summary.get('target_label', '')}"
        ).strip()
        tool_output = search_corpus_projects.invoke({"query": enriched_query, "k": 8})
        # Tool returns {"results": [...], "coverage": {...}} or bare list
        if isinstance(tool_output, dict):
            raw_results = tool_output.get("results", [])
        elif isinstance(tool_output, list):
            raw_results = tool_output
    except Exception as exc:
        trace.append({"label": "Corpus search failed", "status": "error", "detail": str(exc)})

    trace.append({"label": f"Found {len(raw_results)} results", "status": "active"})

    # Deduplicate — search results are DB-verified rows, no secondary lookup needed
    seen: set[str] = set()
    verified: list[dict[str, Any]] = []
    for r in raw_results:
        proj_id = r.get("id") or r.get("project_id", "")
        if not proj_id or proj_id in seen:
            continue
        seen.add(proj_id)
        verified.append({
            "id": proj_id,
            "title": r.get("title", ""),
            "organisation": r.get("organisation", ""),
            "relevance_note": r.get("relevance_note", ""),
            "score": float(r.get("similarity", 0)),
        })

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
# Node: economic_analysis (M1.0 — Five Case Model)
# ---------------------------------------------------------------------------

_ECONOMIC_ANALYSIS_SCHEMA = """{
  "type": "object",
  "properties": {
    "chat_response": {"type": "string", "description": "1-3 sentence summary for the chat panel explaining what the analysis found"},
    "economic_case_block": {
      "type": "object",
      "properties": {
        "id": {"type": "string"},
        "type": {"const": "EconomicCase"},
        "visual": {"type": "string", "enum": ["npv_waterfall", "value_driver_cards"]},
        "state": {"const": "core"},
        "headline": {"type": "string"},
        "content": {
          "type": "object",
          "required": ["verdict", "verdict_summary", "confidence_tier", "discount_rate",
                       "section_scores", "value_drivers", "assumptions", "sensitivity_note",
                       "corpus_citations", "skills_applied"],
          "properties": {
            "verdict": {"type": "string", "enum": ["positive", "neutral", "negative", "insufficient_data"]},
            "verdict_summary": {"type": "string"},
            "confidence_tier": {"type": "string", "enum": ["Speculative", "Indicative", "Supported", "Robust"]},
            "confidence_cap_reason": {"type": "string"},
            "npv_value": {"type": ["number", "null"]},
            "bcr": {"type": ["number", "null"]},
            "discount_rate": {"type": "number"},
            "appraisal_period_years": {"type": "integer"},
            "section_scores": {
              "type": "array",
              "items": {
                "type": "object",
                "required": ["case", "label", "score", "summary", "evidence_state"],
                "properties": {
                  "case": {"type": "string", "enum": ["strategic","economic","commercial","financial","management"]},
                  "label": {"type": "string"},
                  "score": {"type": "number", "minimum": 0, "maximum": 1},
                  "summary": {"type": "string"},
                  "evidence_state": {"type": "string"}
                }
              }
            },
            "value_drivers": {
              "type": "array",
              "items": {
                "type": "object",
                "required": ["name","description","direction","magnitude","evidence_state"],
                "properties": {
                  "name": {"type": "string"},
                  "description": {"type": "string"},
                  "direction": {"type": "string", "enum": ["benefit","cost","uncertain"]},
                  "magnitude": {"type": "string", "enum": ["high","medium","low"]},
                  "quantified_value": {"type": "number"},
                  "evidence_state": {"type": "string"},
                  "assumption": {"type": "string"}
                }
              }
            },
            "npv_waterfall": {
              "type": "array",
              "items": {
                "type": "object",
                "required": ["label","value","type","evidence_state"],
                "properties": {
                  "label": {"type": "string"},
                  "value": {"type": "number"},
                  "type": {"type": "string", "enum": ["benefit","cost","npv"]},
                  "evidence_state": {"type": "string"}
                }
              }
            },
            "assumptions": {
              "type": "array",
              "items": {
                "type": "object",
                "required": ["name","value","sensitivity","evidence_state"],
                "properties": {
                  "name": {"type": "string"},
                  "value": {"type": "string"},
                  "sensitivity": {"type": "string", "enum": ["high","medium","low"]},
                  "evidence_state": {"type": "string"},
                  "note": {"type": "string"}
                }
              }
            },
            "sensitivity_note": {"type": "string"},
            "corpus_citations": {"type": "array", "items": {"type": "object"}},
            "skills_applied": {"type": "array", "items": {"type": "string"}}
          }
        }
      },
      "required": ["id","type","visual","state","headline","content"]
    }
  },
  "required": ["chat_response", "economic_case_block"]
}"""


def economic_analysis_node(state: WorkbenchState) -> dict:
    """
    Five Case economic analysis — M1.0.

    Loads green-book.md + evidence-triage.md skills, runs a structured
    appraisal using the model_summary as context, and emits a
    ModelPatchProposal containing EconomicCaseBlock.

    The frontend shows the block as an add_block patch diff.
    User confirms → EconomicCaseBlock appears in the artifact canvas.
    """
    trace = state.get("reasoning_trace", [])
    model_summary = state.get("model_summary") or {}

    trace.append({"label": "Loading Green Book + evidence-triage skills", "status": "active"})

    # Load skills
    green_book    = _load_skill("green-book.md")
    ev_triage     = _load_skill("evidence-triage.md")

    trace.append({"label": "Searching CPC corpus for economic evidence", "status": "active"})

    # Corpus search for economic / value evidence
    search_query = (
        f"economic case value NPV benefits "
        f"{model_summary.get('source_label', '')} "
        f"{model_summary.get('target_label', '')}"
    ).strip()
    raw_results: list[dict[str, Any]] = []
    try:
        tool_output = search_corpus_projects.invoke({"query": search_query, "k": 6})
        if isinstance(tool_output, dict):
            raw_results = tool_output.get("results", [])
        elif isinstance(tool_output, list):
            raw_results = tool_output
    except Exception:
        pass

    seen_ec: set[str] = set()
    verified_citations: list[dict[str, Any]] = []
    for r in raw_results:
        proj_id = r.get("id") or r.get("project_id", "")
        if not proj_id or proj_id in seen_ec:
            continue
        seen_ec.add(proj_id)
        verified_citations.append({
            "id": proj_id,
            "title": r.get("title", ""),
            "organisation": r.get("organisation", ""),
            "score": float(r.get("similarity", 0)),
        })

    trace.append({
        "label": f"Found {len(verified_citations)} economic evidence items",
        "status": "active",
    })

    # Build the model context summary for the prompt
    ev_counts = model_summary.get("evidence_counts", {})
    gaps_text = "\n".join(f"  - {g}" for g in model_summary.get("top_gaps", []))
    citations_text = "\n".join(
        f"  - [{c['id'][:8]}] {c['title']} ({c['organisation']}) — {int(c['score']*100)}% match"
        for c in verified_citations
    ) or "  - No corpus matches found"

    system = f"""You are the Atlas economic analysis engine applying HM Treasury Green Book methodology.

## Green Book Skill
{green_book[:3000] if green_book else "Apply standard Green Book Five Case Model."}

## Evidence Triage Skill
{ev_triage[:1500] if ev_triage else "Classify evidence states: verified / self-reported / inferred / unknown / contested."}

## Current match context
Source: {model_summary.get('source_label', 'Unknown')}
Target: {model_summary.get('target_label', 'Unknown')}
Recommendation: {model_summary.get('recommendation', 'N/A')}
Current confidence: {model_summary.get('confidence_tier', 'Speculative')}
Confidence cap reason: {model_summary.get('confidence_cap_reason', 'None')}

Evidence summary:
  Verified: {ev_counts.get('verified', 0)}
  Self-reported: {ev_counts.get('partial', ev_counts.get('self-reported', 0))}
  Missing: {ev_counts.get('missing', 0)}
  Total: {ev_counts.get('total', 0)}

Top gaps:
{gaps_text or '  - No gaps recorded'}

Corpus citations for economic case:
{citations_text}

## Instructions
Produce a Five Case economic analysis for this source→target technology transfer.
Use Green Book methodology: Five Case Model, 3.5% STPR, optimism bias awareness.
Given all claims are self-reported, the economic case confidence is capped at Indicative.
Be honest about data limitations. Do NOT invent quantified NPV figures unless the corpus
evidence clearly supports them — use value_driver_cards visual instead.

You MUST respond with ONLY valid JSON matching this schema:
{_ECONOMIC_ANALYSIS_SCHEMA}

Rules:
- If NPV cannot be quantified, set npv_value=null, bcr=null, visual="value_driver_cards"
- If NPV can be estimated (corpus evidence present), set visual="npv_waterfall"  
- confidence_tier must never exceed the current match confidence ({model_summary.get('confidence_tier', 'Speculative')})
- discount_rate = 0.035 (3.5% STPR)
- Include all 5 section scores (strategic/economic/commercial/financial/management)
- Minimum 3 value drivers, minimum 3 assumptions
- corpus_citations = the verified citations list provided above
- skills_applied = ["green-book", "evidence-triage"]
"""

    trace.append({"label": "Running Five Case analysis", "status": "active"})
    llm = _llm()
    response = llm.invoke([
        SystemMessage(content=system),
        HumanMessage(content=f"Run Five Case economic analysis for this match."),
    ])

    # Parse the JSON response — multiple extraction strategies for robustness
    model_patch = None
    default_chat = (
        f"Five Case economic analysis complete for "
        f"**{model_summary.get('source_label', 'this passport')} → "
        f"{model_summary.get('target_label', 'this project')}**. "
        "Review the proposed artifact update in the confirmation panel below."
    )
    chat_text = default_chat
    parsed = None

    raw_content = response.content.strip()

    # Strategy 1: strip outermost ```json … ``` fences then parse
    fenced = re.sub(r"^```(?:json)?\s*", "", raw_content)
    fenced = re.sub(r"\s*```$", "", fenced).strip()
    for candidate in (fenced, raw_content):
        try:
            parsed = json.loads(candidate)
            break
        except Exception:
            pass

    # Strategy 2: extract first {...} block (handles prose + JSON combos)
    if parsed is None:
        m = re.search(r"\{[\s\S]*\}", raw_content)
        if m:
            try:
                parsed = json.loads(m.group(0))
            except Exception:
                pass

    if parsed:
        chat_text = parsed.get("chat_response", default_chat)
        # Ensure chat_text is prose, not JSON
        if chat_text.strip().startswith("{") or chat_text.strip().startswith("["):
            chat_text = default_chat
        ec_block = parsed.get("economic_case_block")
        if ec_block:
            ec_block.setdefault("id", f"ec-{model_summary.get('artifact_id','')[:8]}-001")
            ec_block.setdefault("type", "EconomicCase")
            ec_block.setdefault("state", "core")
            content = ec_block.get("content", {})
            content.setdefault("corpus_citations", verified_citations)
            content.setdefault("skills_applied", ["green-book", "evidence-triage"])
            ec_block["content"] = content
            model_patch = {
                "rationale": (
                    f"Five Case economic analysis for "
                    f"{model_summary.get('source_label','')} → "
                    f"{model_summary.get('target_label','')}. "
                    f"Verdict: {content.get('verdict', 'unknown')}."
                ),
                "ops": [{"op": "add_block", "block": ec_block}],
                "confidence_tier": content.get("confidence_tier", "Indicative"),
                "corpus_citations": verified_citations,
            }
    else:
        # Full parse failure — respond with clean prose, no JSON leaked
        trace.append({"label": "JSON parse failed — returning prose summary", "status": "error"})
        chat_text = (
            f"I've completed the Five Case analysis for "
            f"**{model_summary.get('source_label', 'this passport')} → "
            f"{model_summary.get('target_label', 'this project')}**.\n\n"
            "The structured block couldn't be formatted for the artifact panel this time. "
            "Try asking again — the analysis is often successful on a second attempt. "
            "In the meantime, I can explain any aspect of the economic case in chat."
        )

    trace.append({"label": "Economic analysis complete", "status": "complete"})

    return {
        "chat_response": chat_text,
        "model_patch": model_patch,
        "confidence_tier": "Indicative",
        "reasoning_trace": trace,
        "messages": [AIMessage(content=chat_text)],
    }


# ---------------------------------------------------------------------------
# Node: explore (M1.4 — corpus-wide questions, no match requirement)
# ---------------------------------------------------------------------------


def explore_node(state: WorkbenchState) -> dict:
    """
    Handle corpus-wide exploration questions that go beyond the current match.

    Unlike search_node (which finds evidence *for* this match), explore_node
    answers broader questions: "what other projects deal with X?", "tell me
    about Y technology", "what's in the corpus on Z?".

    The current match is available as secondary context but is not required.
    Results are anchored back to the match where relevant.
    """
    trace = state.get("reasoning_trace", [])
    query = state.get("query", "")
    model_summary = state.get("model_summary") or {}

    trace.append({"label": "Searching CPC corpus (broad exploration)", "status": "active"})

    # Corpus search — raw query, no match-enrichment, so we get results
    # beyond the current match context.
    # search_corpus_projects returns DB-verified rows so no secondary verify needed.
    raw_results: list[dict[str, Any]] = []
    try:
        tool_output = search_corpus_projects.invoke({"query": query, "k": 10})
        # Tool returns {"results": [...], "coverage": {...}} or bare list
        if isinstance(tool_output, dict):
            raw_results = tool_output.get("results", [])
        elif isinstance(tool_output, list):
            raw_results = tool_output
    except Exception as exc:
        trace.append({"label": f"Corpus search failed: {exc}", "status": "error"})

    # Deduplicate — results are already DB-verified by the search query
    verified: list[dict[str, Any]] = []
    seen: set[str] = set()
    for r in raw_results:
        proj_id = r.get("id") or r.get("project_id", "")
        if not proj_id or proj_id in seen:
            continue
        seen.add(proj_id)
        verified.append({
            "id": proj_id,
            "title": r.get("title", ""),
            "organisation": r.get("organisation", ""),
            "relevance_note": r.get("relevance_note", ""),
            "score": float(r.get("similarity", 0)),
        })

    trace.append({
        "label": f"Found {len(verified)} projects in corpus",
        "status": "active" if verified else "error",
    })

    # Build context-aware system prompt
    match_context = ""
    if model_summary.get("source_label"):
        match_context = (
            f"\nFor context, the analyst is currently viewing: "
            f"{model_summary.get('source_label')} → {model_summary.get('target_label')}. "
            "Relate your answer back to this match where relevant, but do not limit "
            "yourself to it — answer the broader question fully."
        )

    citations_block = "\n".join(
        f"- [{c['id'][:8]}] **{c['title']}** ({c['organisation']}) — {int(c['score']*100)}% match"
        for c in verified
    ) or "No matching projects found in the current corpus."

    system = (
        "You are the Atlas Workbench assistant exploring the CPC Connected Places corpus.\n"
        "Answer the user's question using the corpus results below.\n"
        "Be specific: cite project titles and IDs. Identify patterns and themes.\n"
        "Do not confabulate projects — only reference what is in the corpus results.\n"
        f"{match_context}\n\n"
        f"Corpus results for this query:\n{citations_block}"
    )

    llm = _llm()
    response = llm.invoke(
        [SystemMessage(content=system)] + list(state.get("messages", []))
    )

    trace.append({"label": "Corpus exploration complete", "status": "complete"})

    return {
        "chat_response": response.content,
        "corpus_citations": verified,
        "confidence_tier": "Indicative" if verified else "Speculative",
        "reasoning_trace": trace,
        "messages": [AIMessage(content=response.content)],
    }


# ---------------------------------------------------------------------------
# Node: conversational
# ---------------------------------------------------------------------------

def conversational_node(state: WorkbenchState) -> dict:
    """Handle greetings, meta, and off-topic messages."""
    llm = _llm()
    messages = [
        SystemMessage(content=(
            "You are the Atlas Workbench assistant — a strategic intelligence tool "
            "for Connected Places Catapult analysts.\n\n"
            "You can handle ANY question an analyst would ask:\n"
            "- Explain evidence and gaps in the current match\n"
            "- Search the CPC corpus for evidence or comparators\n"
            "- Explore the corpus broadly — other projects, technologies, sectors\n"
            "- Propose updates to the artifact for analyst review\n"
            "- Run a Five Case economic analysis ('run economic case')\n\n"
            "Respond naturally to this message."
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
        "explain":           "explain",
        "search":            "search",
        "explore":           "explore",
        "propose":           "propose",
        "economic_analysis": "economic_analysis",
        "conversational":    "conversational",
    }.get(route, "explain")


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------

def build_graph():
    graph = StateGraph(WorkbenchState)

    # Nodes
    graph.add_node("extract_query", extract_query)
    graph.add_node("classify_intent", classify_intent)
    graph.add_node("classify_route", classify_route)
    graph.add_node("explain", explain_node)
    graph.add_node("search", search_node)
    graph.add_node("explore", explore_node)
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
            "explain":           "explain",
            "search":            "search",
            "explore":           "explore",
            "propose":           "propose",
            "economic_analysis": "economic_analysis",
            "conversational":    "conversational",
        },
    )

    # All processing nodes → END
    for node in ["explain", "search", "explore", "propose", "economic_analysis", "conversational"]:
        graph.add_edge(node, END)

    # LangGraph API provides its own persistence; MemorySaver is for direct uvicorn use.
    _checkpointer = None if "langgraph_api" in sys.modules else MemorySaver()
    return graph.compile(checkpointer=_checkpointer)


# ---------------------------------------------------------------------------
# Exported graph (used by agents/server.py + langgraph.json)
# ---------------------------------------------------------------------------

graph = build_graph()

__all__ = ["graph"]
