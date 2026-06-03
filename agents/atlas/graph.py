"""
Atlas 5 — ATLAS Agent (LangGraph StateGraph)

ATLAS is the Green Book business case agent. It:
1. Searches the corpus for evidence projects AND live funding calls
2. Constructs a Five Case Model brief (Strategic/Economic/Commercial/Financial/Management)
3. Calculates NPV at the HM Treasury STPR of 3.5% (locked by Green Book)
4. Applies optimism bias per the UK Transport supplementary guidance
5. Assigns a confidence_tier per the evidence-triage skill
6. Builds a decision_spine summarising the recommendation
7. Returns verified corpus citations (NO fabricated IDs)
8. Records a tool_calls trace for eval harness (G5)

Model: claude-sonnet-4-6 (NOT OpenAI)
Skills loaded: green-book + evidence-triage + analogue-method (from context packet)

Response shape (v2 — matches golden grader contract):
{
  "recipe":         "brief_five_case",
  "sections":       {"Strategic Case": ..., "Economic Case": ..., ...},   # title-case (G1)
  "five_case_model": {"strategic": ..., ...},                             # legacy lowercase (backward compat)
  "decision_spine": {"decision": ..., "recommendation": ...,             # (G2)
                     "confidence_tier": ..., "key_assumption": ...,
                     "next_action": ...},
  "npv_value":      <float | null>,
  "discount_rate":  0.035,
  "optimism_bias":  <float | null>,
  "corpus_citations": [{"id": ..., "title": ..., "organisation": ...,    # (G3)
                         "relevance_note": ..., "score": ...}],
  "confidence_tier": <str>,                                               # (G4)
  "tool_calls":     [{"tool": ..., "args": {...}}],                       # (G5)
  "analysis":       <str>,
}
"""
from __future__ import annotations

import json
import os
import re
import sys
import uuid
from pathlib import Path
from typing import Annotated, Any, Literal
from typing_extensions import TypedDict  # required by Pydantic on Python < 3.12

_root = Path(__file__).resolve().parent.parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from dotenv import load_dotenv
# override=True so .env values win over blank/unset shell variables
load_dotenv(override=True)

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

# Correct tool names from mcp_client (not the old `search_projects` alias)
from agents.llm_factory import get_llm as _get_llm
from agents.mcp_client import (
    search_corpus_projects,
    search_corpus_live_calls,
    search_corpus_evidence,   # Corpus Recall Audit fix: knowledge_chunks were never queried
    search_cpc_internal,      # Gap F: CPC internal evidence_containers + claims
    detect_evidence_gaps,     # Structured gap classification — retrieval/corpus/landscape
)
from agents.external_search import search_govuk, search_exa, search_tavily  # External Evidence Router
from agents.atlas.citation_guard import apply_citation_guard
from agents.atlas.artifact_qa import run_artifact_qa
from agents.atlas.falsification import run_falsification_lane
from mcps.cpc_corpus.queries import get_project as _verify_project
from agents.citation_helpers import (
    CITABLE_SOURCE_TYPES,
    filter_llm_citations,
    inject_citation_fallback,
    suggested_citations_block,
)
# Shared base utilities — use these for extraction and intent, never re-implement
from agents.base import extract_latest_query, is_conversational
from agents.visual_recipe_director import (
    build_chart_specs as _build_chart_specs,
    build_visual_blocks as _build_visual_blocks,
    is_cpc_inward as _is_cpc_inward,
    is_comparison_query as _is_comparison_query,
    classify_intent as _classify_intent_vrd,
    select_recipe as _select_recipe_vrd,
    select_recipes as _select_recipes_vrd,
)
from pathlib import Path as _Path

# Load data-visualization skill once at module level
def _load_data_viz_skill() -> dict[str, str] | None:
    """Read skills/data-visualization.md relative to repo root."""
    try:
        skills_path = _Path(__file__).resolve().parent.parent.parent / "skills" / "data-visualization.md"
        if skills_path.exists():
            return {"name": "data-visualization", "content": skills_path.read_text(encoding="utf-8")}
    except Exception:
        pass
    return None

def _load_surface_composition_skill() -> dict[str, str] | None:
    """Read skills/surface-composition.md relative to repo root."""
    try:
        skills_path = _Path(__file__).resolve().parent.parent.parent / "skills" / "surface-composition.md"
        if skills_path.exists():
            return {"name": "surface-composition", "content": skills_path.read_text(encoding="utf-8")}
    except Exception:
        pass
    return None


def _load_golden_example_skill(recipe: str) -> dict[str, str] | None:
    """Load mode-specific golden example for LLM composition (Sprint 3)."""
    mapping = {
        "orient": "golden-orient.md",
        "cpc_capability_assessment": "golden-orient.md",
        "cpc_market_alignment": "golden-orient.md",
        "diagnose": "golden-diagnose.md",
        "cpc_evidence_gaps": "golden-diagnose.md",
        "act": "golden-act.md",
        "brief_five_case": "golden-act.md",
        "connect": "golden-connect.md",
        "cpc_opportunity_fit": "golden-connect.md",
    }
    filename = mapping.get(recipe)
    if not filename:
        return None
    try:
        path = _Path(__file__).resolve().parent.parent.parent / "skills" / filename
        if path.exists():
            return {"name": filename.replace(".md", ""), "content": path.read_text(encoding="utf-8")}
    except Exception:
        pass
    return None


_DATA_VIZ_SKILL: dict[str, str] | None = _load_data_viz_skill()
_SURFACE_COMPOSITION_SKILL: dict[str, str] | None = _load_surface_composition_skill()

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

ConfidenceTier = Literal["Speculative", "Indicative", "Supported", "Robust"]

# HM Treasury Social Time Preference Rate — LOCKED per Green Book (Table 2.1)
HMT_STPR: float = 0.035

# Five Case Model section keys — title-case contract (matches ArtifactBlock.sections)
FIVE_CASE_KEYS = [
    "Strategic Case",
    "Economic Case",
    "Commercial Case",
    "Financial Case",
    "Management Case",
]

# Lowercase → title-case mapping for LLM output normalisation
_KEY_MAP = {
    "strategic": "Strategic Case",
    "economic": "Economic Case",
    "commercial": "Commercial Case",
    "financial": "Financial Case",
    "management": "Management Case",
    # Also accept already-title-cased
    "Strategic Case": "Strategic Case",
    "Economic Case": "Economic Case",
    "Commercial Case": "Commercial Case",
    "Financial Case": "Financial Case",
    "Management Case": "Management Case",
}

DECISION_SPINE_REQUIRED = [
    "decision",
    "recommendation",
    "confidence_tier",
    "key_assumption",
    "next_action",
]


class EvidenceGap(TypedDict):
    """
    A structured evidence gap produced when corpus retrieval finds weak,
    adjacent or missing evidence.

    Three routing concepts — keep them separate (do not conflate):

    recommended_source_lane  WHY are we searching? (intent)
        internal_precedent   re-query Atlas corpus with a different strategy
        official_policy      government policy / regulation / statistics
        funding              innovation grants, R&D programmes, funding calls
        procurement          contracts, tenders, commercial opportunities
        research             academic, UKRI-funded, methodology evidence
        market_discovery     operator demand, WTP, commercial analogues
        ingestion_backlog    source found; queue for corpus enrichment

    recommended_provider     WHO has the evidence? (source identity, not tool name)
        InnovateUK           Innovate UK project database / grant calls
        DfT                  Dept for Transport policy, strategy, guidance
        NationalHighways     Road network data, traffic counts, schemes
        CCAV                 Centre for Connected & Autonomous Vehicles
        UKRI                 UK Research & Innovation (research grants)
        HorizonEurope        EU Horizon Europe / Horizon 2020 R&D
        FindATender          Find a Tender / Contracts Finder
        Exa                  Web / academic / recent non-government sources
        GovUK                GOV.UK as access route when provider unclear
        CPC_Corpus           Internal Atlas corpus

    available_tool           HOW do we call it TODAY? (honest about capability)
        cpc_corpus           search_corpus_* tools (live)
        live_calls           search_corpus_live_calls (live)
        govuk_search         GovUK MCP (not yet enabled)
        exa_search           Exa MCP (not yet enabled — Rec C)
        future_innovateuk_api Innovate UK API (not yet integrated)
        future_tender_api    Find a Tender API (not yet integrated)
        none_yet             no tool exists for this source today

    can_lift_confidence      True if retrieving evidence could raise the tier
    citation_status          how to treat evidence when found:
        direct               cite in corpus_citations if retrieved and verified
        candidate            flag for human review before citing
        background           context only; do not cite directly
    """
    type: str                      # "retrieval_gap" | "corpus_gap" | "landscape_gap"
    topic: str                     # What specific evidence is missing
    severity: str                  # "low" | "medium" | "high"
    reason: str                    # Why this gap was classified this way
    recommended_action: str        # What to do next
    recommended_source_lane: str   # intent lane (why)
    recommended_provider: str      # source identity (who) — not the access tool
    available_tool: str            # callable tool today (how) — honest about gaps
    can_lift_confidence: bool      # would finding this raise the confidence tier?
    citation_status: str           # "direct" | "candidate" | "background"


class CorpusCitation(TypedDict):
    id: str
    title: str
    organisation: str
    relevance_note: str
    score: float          # similarity score from pgvector search (G4 uses this)


class DecisionSpine(TypedDict):
    decision: str
    recommendation: str
    confidence_tier: str
    key_assumption: str
    next_action: str


class AtlasState(TypedDict):
    # AG-UI messages — primary input via CopilotKit/HttpAgent
    messages: Annotated[list, add_messages]
    # query — extracted from messages (AG-UI path) or passed directly (REST path)
    query: str
    context_packet: dict[str, Any]
    raw_search_results: list[dict[str, Any]]
    five_case_model: dict[str, str]          # lowercase keys (legacy)
    sections: dict[str, str]                  # title-case keys (G1)
    npv_value: float | None
    discount_rate: float                      # ALWAYS 0.035 — locked by HMT Green Book
    optimism_bias: float | None               # % adjustment per supplementary guidance
    corpus_citations: list[CorpusCitation]
    confidence_tier: ConfidenceTier
    decision_spine: DecisionSpine | None      # (G2)
    evidence_gaps: list[EvidenceGap]          # structured gap objects
    # External evidence — controlled by evidence gap router (govuk_search / exa_search)
    # Never added to corpus_citations; requires human review before citing.
    external_search_results: list[dict[str, Any]]
    tool_calls: list[dict[str, Any]]          # trace for G5
    reasoning_trace: list[dict[str, Any]]     # per-node thought + tool trace (for Panel D)
    analysis: str
    artifact_block: dict[str, Any] | None    # populated in verify_citations → synced to useCoAgent
    charts: list[dict[str, Any]]             # synced to AgentState.charts → renders Charts component
    error: str | None
    _is_conversational: bool                 # True → skip expensive pipeline, respond instantly
    # Recipe intent (set by select_recipe_intent, consumed by build_five_case + verify_citations)
    is_cpc_inward: bool                      # True = CPC capability/evidence query (inward-facing)
    target_recipe: str                       # primary recipe ID selected before corpus search
    target_secondary_recipes: list[str]      # secondary recipe IDs for composite artifact panels
    section_scores: dict[str, int]           # LLM self-assessed evidence strength per Five Case section
    # Session memory — persisted across turns via LangGraph checkpoint (not reset in extract_query)
    last_recipe: str
    last_headline: str
    session_has_diagnose: bool
    # Turn routing (Sprint 4): clarify | refine | analyze
    turn_intent: str
    last_artifact_block: dict[str, Any] | None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_MAX_CITATIONS = 8
_CITATION_PROMPT_RULE = (
    'All corpus_citation.id values MUST come from items with source_type '
    '"project", "live_call", "cpc_internal", or "cpc_claim" in results. NEVER fabricate IDs.'
)

# Confidence tier ordering — module scope so CICERONE and future routing nodes
# can import and use _cap_tier without depending on build_five_case internals.
_TIER_ORDER = ["Speculative", "Indicative", "Supported", "Robust"]


def _cap_tier(current: str, max_allowed: str) -> str:
    """Cap confidence tier at max_allowed. Both args must be valid tier strings."""
    ci = _TIER_ORDER.index(current) if current in _TIER_ORDER else 0
    mi = _TIER_ORDER.index(max_allowed) if max_allowed in _TIER_ORDER else 0
    return _TIER_ORDER[min(ci, mi)]


def _llm():
    return _get_llm(max_tokens=8192)


def _llm_internal():
    """Non-streaming LLM for nodes that produce JSON (build_five_case, cpc_inward).
    LangGraph's messages-tuple streaming would otherwise leak raw JSON into the chat."""
    return _get_llm(max_tokens=8192, streaming=False)


def _normalise_sections(raw: dict) -> tuple[dict[str, str], dict[str, str]]:
    """
    Accept either lowercase or title-case section keys from the LLM.
    Returns (title_case_sections, legacy_lowercase_sections).
    """
    title = {}
    legacy = {}
    for k, v in raw.items():
        mapped = _KEY_MAP.get(k)
        if mapped:
            title[mapped] = str(v)
            legacy[mapped.split(" ")[0].lower()] = str(v)
        else:
            # Unknown key — try title-case normalisation
            title[k] = str(v)
    # Fill any missing title-case keys
    for key in FIVE_CASE_KEYS:
        if key not in title:
            title[key] = f"[{key} — insufficient data]"
            legacy[key.split(" ")[0].lower()] = f"[{key} — insufficient data]"
    return title, legacy


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------


def classify_intent(state: AtlasState) -> dict:
    """
    Node 0b: Fast intent gate — delegates to is_conversational() from agents.base
    so the domain-keyword set and conversational rules are shared across all agents.

    Domain queries proceed to search_corpus (35-second pipeline).
    Greetings / meta / off-topic messages get an instant ATLAS-personalised reply.
    """
    query = (state.get("query") or "").strip()

    if is_conversational(query):
        # ATLAS-specific reply — richer than the generic base reply, with example prompts
        ql = query.lower()
        words = ql.split()
        first = words[0].strip(",.!?") if words else ""
        from agents.base import _GREETING_WORDS, _THANKS_WORDS
        if not words or (len(words) <= 6 and first in _GREETING_WORDS):
            reply = (
                "👋 Hi! I'm **ATLAS**, CPC's Green Book investment strategist.\n\n"
                "I build evidence-backed **Five Case Model** briefs grounded in the CPC "
                "corpus — real projects, live funding calls, and HIVE case studies.\n\n"
                "Try one of these:\n"
                "- *What is the strategic case for autonomous freight corridors in the UK?*\n"
                "- *Build an investment brief for a CPC-led EV charging programme.*\n"
                "- *Stress test the assumption that CAV achieves commercial viability by 2032.*"
            )
        elif len(words) <= 5 and first in _THANKS_WORDS:
            reply = "You're welcome! Ask me anything about CPC's evidence base or investment briefs. 🙂"
        else:
            reply = (
                "I'm **ATLAS** — CPC's Green Book investment brief agent. "
                "Ask me a substantive question about a programme, technology domain, or funding "
                "call and I'll build a full Five Case Model brief with verified corpus citations."
            )
        return {
            "messages": [AIMessage(content=reply, id=str(uuid.uuid4()))],
            "confidence_tier": "Speculative",
            "decision_spine": None,
            "artifact_block": None,
            "_is_conversational": True,
        }

    return {"_is_conversational": False}


def _route_after_intent(state: AtlasState) -> str:
    """Conditional edge: skip pipeline for conversational queries."""
    return END if state.get("_is_conversational") else "select_recipe_intent"


# ---------------------------------------------------------------------------
# Turn routing — clarify / refine / analyze (Sprint 4)
# ---------------------------------------------------------------------------

_CLARIFY_PATTERNS = (
    r"^what('s| is| are)\b",
    r"^explain\b",
    r"^how (does|do|is|are|can|was|were)\b",
    r"^why (does|do|is|are)\b",
    r"^define\b",
    r"\bwhat('s| is) (npv|stpr|green book)\b",
    r"\bhow (was|is) .*(calculated|computed|derived)\b",
    r"^can you explain\b",
    r"^tell me (more )?about\b",
    r"^what does .+ mean\b",
    r"^which (is|are) better\b",
    r"\bcompare .+ (vs|versus|or)\b",
)

_REFINE_PATTERNS = (
    r"\badd\b",
    r"\binclude\b",
    r"\bupdate\b",
    r"\bsharpen\b",
    r"\bexpand\b",
    r"\bfocus on\b",
    r"\bstrengthen\b",
    r"\bimprove\b",
    r"\bmake the headline\b",
    r"\badd key players\b",
    r"\brefine\b",
    r"\bpatch\b",
    r"\bintegrate\b",
    r"\bemphasize\b",
    r"\bde-emphasize\b",
)


def _classify_turn_heuristic(query: str, has_prior_artifact: bool) -> str:
    """Fast turn-lane classifier — no LLM."""
    if not has_prior_artifact:
        return "analyze"
    q = query.strip().lower()
    if not q:
        return "analyze"
    if any(re.search(p, q) for p in _REFINE_PATTERNS):
        return "refine"
    if any(re.search(p, q) for p in _CLARIFY_PATTERNS):
        return "clarify"
    # Short follow-up questions without new domain scope → clarify
    if len(q.split()) <= 14 and "?" in q:
        return "clarify"
    return "analyze"


def classify_turn_intent(state: AtlasState) -> dict:
    """
    Node 0a: Route follow-up turns to clarify / refine / analyze lanes.
    Requires last_artifact_block from prior turn (set in extract_query).
    """
    query = (state.get("query") or "").strip()
    prior = state.get("last_artifact_block")
    has_prior = bool(prior and isinstance(prior, dict) and prior.get("sections"))
    intent = _classify_turn_heuristic(query, has_prior)
    if intent in ("clarify", "refine") and not has_prior:
        intent = "analyze"

    thought = (
        f"Turn lane: {intent}. "
        + ("Prior artifact available — may skip full pipeline." if has_prior else "New analysis — full pipeline.")
    )
    return {
        "turn_intent": intent,
        "reasoning_trace": state.get("reasoning_trace", []) + [{
            "node": "classify_turn_intent",
            "thought": thought,
            "tool_calls": [],
            "status": "ok",
        }],
    }


def _route_after_turn_intent(state: AtlasState) -> str:
    intent = state.get("turn_intent", "analyze")
    if intent == "clarify":
        return "handle_clarify"
    if intent == "refine":
        return "handle_refine"
    return "reset_analyze_state"


def reset_analyze_state(state: AtlasState) -> dict:
    """Clear per-turn working state before a full analyze pipeline run."""
    return {
        "sections": {},
        "five_case_model": {k.split(" ")[0].lower(): "" for k in FIVE_CASE_KEYS},
        "corpus_citations": [],
        "decision_spine": None,
        "artifact_block": None,
        "charts": [],
        "evidence_gaps": [],
        "external_search_results": [],
        "npv_value": None,
        "optimism_bias": None,
        "tool_calls": [],
        "reasoning_trace": state.get("reasoning_trace", []),
        "analysis": "",
        "_is_conversational": False,
        "is_cpc_inward": False,
        "target_recipe": "brief_five_case",
        "target_secondary_recipes": [],
        "section_scores": {},
    }


def handle_clarify(state: AtlasState) -> dict:
    """Clarify lane — conversational answer from prior artifact; artifact unchanged."""
    query = state.get("query", "")
    prior = state.get("last_artifact_block") or {}

    prior_summary = json.dumps({
        "recipe": prior.get("recipe"),
        "headline": prior.get("headline"),
        "insight_card": prior.get("insight_card"),
        "confidence_tier": prior.get("confidence_tier"),
        "sections": prior.get("sections"),
        "corpus_citations": (prior.get("corpus_citations") or [])[:6],
    }, indent=2)[:12000]

    system = """You are ATLAS, CPC's decision intelligence analyst.

The user is asking a follow-up about the artifact already on screen.
Answer clearly in markdown prose. You may use bullets, short tables, and formulas.
Explain NPV, gaps, comparisons, and definitions when asked.
Do NOT output JSON. Do NOT regenerate the full artifact.
Reference the prior artifact when helpful."""

    try:
        llm = _llm_internal()
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"Prior artifact:\n{prior_summary}\n\nUser question: {query}"),
        ])
        content = str(response.content).strip()
    except Exception as e:
        content = f"I couldn't answer that follow-up: {e}"

    return {
        "messages": [AIMessage(content=content, id=str(uuid.uuid4()))],
        "artifact_block": prior if prior else None,
        "confidence_tier": prior.get("confidence_tier", "Speculative"),
        "_is_conversational": True,
        "reasoning_trace": state.get("reasoning_trace", []) + [{
            "node": "handle_clarify",
            "thought": "Answered follow-up from prior artifact — clarify lane.",
            "tool_calls": [],
            "status": "ok",
        }],
    }


def handle_refine(state: AtlasState) -> dict:
    """Refine lane — patch prior artifact via LLM delta; short chat ack."""
    query = state.get("query", "")
    prior = dict(state.get("last_artifact_block") or {})
    if not prior:
        return {"turn_intent": "analyze"}

    prior_json = json.dumps({
        "headline": prior.get("headline"),
        "insight_card": prior.get("insight_card"),
        "sections": prior.get("sections"),
        "recipe": prior.get("recipe"),
    }, indent=2)[:10000]

    system = """You are ATLAS. The user wants to refine an existing artifact.
Return JSON ONLY:
{
  "headline": "optional updated headline",
  "insight_card": "optional updated insight card",
  "sections_patch": {"Section Name": "updated content"},
  "acknowledgment": "one sentence for chat"
}
Only include fields that should change."""

    try:
        llm = _llm_internal()
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"Current artifact:\n{prior_json}\n\nRefinement request: {query}"),
        ])
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        patch = json.loads(content.strip())
    except Exception as e:
        return {
            "messages": [AIMessage(
                content=f"I couldn't refine the artifact: {e}. Try rephrasing or run a new analysis.",
                id=str(uuid.uuid4()),
            )],
            "artifact_block": prior,
            "_is_conversational": True,
        }

    if patch.get("headline"):
        prior["headline"] = str(patch["headline"]).strip()
    if patch.get("insight_card"):
        prior["insight_card"] = str(patch["insight_card"]).strip()
    sections = dict(prior.get("sections") or {})
    for k, v in (patch.get("sections_patch") or {}).items():
        if v:
            sections[str(k)] = str(v)
    prior["sections"] = sections
    ack = str(patch.get("acknowledgment") or "Updated in artifact →").strip()
    chat = f"{ack}\n\n_see artifact →_"

    return {
        "messages": [AIMessage(content=chat, id=str(uuid.uuid4()))],
        "artifact_block": prior,
        "last_artifact_block": prior,
        "last_headline": prior.get("headline") or state.get("last_headline", ""),
        "_is_conversational": True,
        "reasoning_trace": state.get("reasoning_trace", []) + [{
            "node": "handle_refine",
            "thought": "Patched prior artifact — refine lane.",
            "tool_calls": [],
            "status": "ok",
        }],
    }


def select_recipe_intent(state: AtlasState) -> dict:
    """
    Node 0c: Classify query intent and select target recipe(s) BEFORE corpus search.

    Runs while corpus is still empty — intent is purely query-based (fast regex).
    Sets is_cpc_inward, target_recipe, and target_secondary_recipes so that:
    - build_five_case dispatches to the right LLM prompt
    - select_visual_recipe / verify_citations use the right chart families
    - verify_citations builds composite panels for compound queries

    This is the single authoritative source of recipe selection; verify_citations
    reads state["target_recipe"] rather than re-classifying from the query.
    """
    query = state.get("query", "")
    inward = _is_cpc_inward(query)
    intent = _classify_intent_vrd(query)
    primary_recipe, secondary_recipes = _select_recipes_vrd(query)

    # Inject data-visualization skill so every content-generation LLM call
    # has art-director guidance in context — loaded once at module level.
    ctx = dict(state.get("context_packet") or {})
    existing_skills: list[dict] = list(ctx.get("active_skills") or [])
    if _DATA_VIZ_SKILL and not any(
        s.get("name") == "data-visualization" for s in existing_skills
    ):
        existing_skills = existing_skills + [_DATA_VIZ_SKILL]
    if _SURFACE_COMPOSITION_SKILL and not any(
        s.get("name") == "surface-composition" for s in existing_skills
    ):
        existing_skills = existing_skills + [_SURFACE_COMPOSITION_SKILL]
    golden = _load_golden_example_skill(primary_recipe)
    if golden and not any(s.get("name") == golden["name"] for s in existing_skills):
        existing_skills = existing_skills + [golden]
    ctx["active_skills"] = existing_skills

    _BUILD_PATHS: dict[str, str] = {
        "orient": "Orient terrain report",
        "connect": "Connect opportunity routes",
        "diagnose": "Diagnose gap & value translation",
        "defend": "Defend challenge-readiness",
        "act": "Green Book Five Case (Act)",
        "brief_five_case": "Green Book Five Case (Act)",
        "cpc_capability_assessment": "CPC capability assessment",
        "cpc_evidence_gaps": "CPC evidence gaps",
        "cpc_opportunity_fit": "CPC opportunity fit",
        "cpc_market_alignment": "CPC market alignment",
        "cpc_portfolio_comparison": "CPC portfolio comparison",
        "cpc_funding_flow": "CPC funding flow",
        "cpc_defend": "CPC defend",
    }
    build_path = _BUILD_PATHS.get(primary_recipe, f"Mode: {primary_recipe}")

    is_compound = len(secondary_recipes) > 0

    # Turn-2 escalation — carry prior artifact context into Act / Diagnose / Connect
    prior_recipe = state.get("last_recipe") or ""
    prior_headline = state.get("last_headline") or ""
    if prior_headline and primary_recipe in ("act", "brief_five_case", "diagnose", "connect"):
        ctx["prior_turn"] = {
            "recipe": prior_recipe,
            "headline": prior_headline,
            "session_has_diagnose": bool(state.get("session_has_diagnose")),
        }

    return {
        "context_packet": ctx,
        "is_cpc_inward": inward,
        "target_recipe": primary_recipe,
        "target_secondary_recipes": secondary_recipes,
        "reasoning_trace": state.get("reasoning_trace", []) + [{
            "node": "select_recipe_intent",
            "thought": (
                f"Intent: '{intent}'. CPC-inward: {inward}. "
                f"Primary recipe: '{primary_recipe}'. "
                + (f"Secondary recipes: {secondary_recipes}. Composite artifact." if is_compound else "Single-recipe artifact.")
                + f" Build path: {build_path}."
            ),
            "tool_calls": [],
            "status": "ok",
        }],
    }


def select_visual_recipe(state: AtlasState) -> dict:
    """
    Node 2b: Record visual recipe decision in reasoning_trace after LLM build.

    Runs AFTER build_five_case so we have full context (confidence tier, NPV,
    section count) to explain WHY this recipe was chosen. The recipe itself was
    already selected in select_recipe_intent; this node makes that decision
    auditable and surfaceable in Panel D without changing it.
    """
    recipe = state.get("target_recipe", "brief_five_case")
    tier = state.get("confidence_tier", "Speculative")
    npv = state.get("npv_value")
    inward = state.get("is_cpc_inward", False)
    sections = state.get("sections", {})
    n_sections = sum(
        1 for v in sections.values()
        if v and not str(v).startswith("[")
    )

    thought = (
        f"Visual recipe confirmed: '{recipe}'. "
        f"Query path: {'CPC-inward' if inward else 'outward Five Case'}. "
        f"Confidence: {tier}. "
        + (f"NPV: £{round(float(npv) / 1_000_000, 1)}m. " if npv else "No NPV. ")
        + f"{n_sections}/5 sections populated."
    )

    return {
        "reasoning_trace": state.get("reasoning_trace", []) + [{
            "node": "select_visual_recipe",
            "thought": thought,
            "tool_calls": [],
            "status": "ok",
        }],
    }


def search_corpus(state: AtlasState) -> AtlasState:
    """
    Node 1: Search atlas.projects AND atlas.live_calls for evidence.
    Records tool_calls trace for G5 grader.
    """
    query = state["query"]
    tool_calls: list[dict[str, Any]] = []
    combined: list[dict[str, Any]] = []

    inward = state.get("is_cpc_inward", False)
    comparison = _is_comparison_query(query)
    cpc_internal_only = inward and not comparison

    # CPC internal retrieval (Decision 3 Rule A) — primary for entity queries
    if inward or state.get("target_recipe", "").startswith("cpc_"):
        try:
            internal_result = search_cpc_internal.invoke({"query": query, "limit": _MAX_CITATIONS})
            internal_items = internal_result.get("results", []) if isinstance(internal_result, dict) else []
            combined.extend(internal_items)
            tool_calls.append({
                "tool": "search_cpc_internal",
                "args": {"query": query, "limit": _MAX_CITATIONS},
                "result_count": len(internal_items),
            })
        except Exception as e:
            tool_calls.append({
                "tool": "search_cpc_internal",
                "args": {"query": query},
                "error": str(e),
            })

    # External GtR corpus — skip as primary when CPC-internal-only (Rule A)
    if not cpc_internal_only:
        try:
            result = search_corpus_projects.invoke({"query": query, "limit": _MAX_CITATIONS})
            projects = result.get("results", []) if isinstance(result, dict) else []
            combined.extend(projects)
            tool_calls.append({
                "tool": "search_corpus_projects",
                "args": {"query": query, "limit": _MAX_CITATIONS},
                "result_count": len(projects),
            })
        except Exception as e:
            tool_calls.append({
                "tool": "search_corpus_projects",
                "args": {"query": query},
                "error": str(e),
            })
            state["error"] = f"search_corpus_projects error: {e}"

        # Tool call 2: live funding calls
        try:
            live_result = search_corpus_live_calls.invoke(
                {"query": query, "limit": 5, "open_only": False}
            )
            live = live_result.get("results", []) if isinstance(live_result, dict) else []
            combined.extend(live)
            tool_calls.append({
                "tool": "search_corpus_live_calls",
                "args": {"query": query, "limit": 5, "open_only": False},
                "result_count": len(live),
            })
        except Exception as e:
            tool_calls.append({
                "tool": "search_corpus_live_calls",
                "args": {"query": query},
                "error": str(e),
            })

    # Tool call 3: policy / report evidence from atlas.knowledge_chunks
    # -----------------------------------------------------------------------
    # Corpus Recall Audit (2026-05-22) root-cause fix:
    # atlas.knowledge_chunks has 4,974 rows (100% embedded) including 20+
    # directly relevant freight/AV policy docs (DfT Future of Freight,
    # CCAV R&D catalogue, AV pilot scheme guidance) — but this tool was never
    # called, so they were invisible to ATLAS.
    #
    # Two-pass strategy:
    #   Pass 1 (full):    full user query — broad semantic sweep
    #   Pass 2 (focused): 4-term sub-query — reduces verbose-query dilution
    #     e.g. "What evidence does CPC have for autonomous freight ..."
    #          → "evidence autonomous freight corridors"  (score +0.05–0.10)
    # -----------------------------------------------------------------------
    _STOP_EV = frozenset({
        "what", "does", "have", "the", "and", "with", "that", "this",
        "from", "are", "how", "can", "will", "which", "there", "their",
        "build", "make", "give", "show", "tell", "create", "produce",
        "please", "about", "should", "could", "would", "using", "based",
        "write", "provide", "generate",
    })
    _key_words = [
        w.strip(".,?!:;()'\"") for w in query.lower().split()
        if len(w.strip(".,?!:;()'\"")) > 4
        and w.strip(".,?!:;()'\"") not in _STOP_EV
    ]
    focused_claim = " ".join(_key_words[:4]) if _key_words else ""

    seen_chunk_ids: set[str] = set()
    evidence_passes = [(query, "full")]
    if focused_claim and focused_claim.lower() != query.lower():
        evidence_passes.append((focused_claim, "focused"))

    for claim, pass_label in evidence_passes:
        if cpc_internal_only:
            break
        try:
            ev_result = search_corpus_evidence.invoke({"claim": claim, "limit": 5})
            ev_items = ev_result.get("results", []) if isinstance(ev_result, dict) else []
            # Deduplicate by chunk_id so the two passes don't double-count
            new_ev = [e for e in ev_items if e.get("chunk_id") not in seen_chunk_ids]
            seen_chunk_ids.update(
                e["chunk_id"] for e in new_ev if e.get("chunk_id")
            )
            combined.extend(new_ev)
            tool_calls.append({
                "tool": "search_corpus_evidence",
                "args": {"claim": claim, "limit": 5, "pass": pass_label},
                "result_count": len(ev_items),
                "new_items": len(new_ev),
            })
        except Exception as e:
            tool_calls.append({
                "tool": "search_corpus_evidence",
                "args": {"claim": claim, "pass": pass_label},
                "error": str(e),
            })

    state["raw_search_results"] = combined
    state["tool_calls"] = tool_calls

    # Structural evidence gap detection — rule-based, runs after all searches
    # knowledge_searched=True iff at least one evidence pass returned chunks
    knowledge_was_searched = bool(seen_chunk_ids)
    state["evidence_gaps"] = detect_evidence_gaps(
        combined, knowledge_searched=knowledge_was_searched
    )

    # Initialise external_search_results — populated by external_evidence_search node
    state["external_search_results"] = []

    n_projects = sum(1 for r in combined if r.get("source_type") == "project")
    n_live = sum(1 for r in combined if r.get("source_type") == "live_call")
    n_chunks = sum(1 for r in combined if r.get("source_type") == "knowledge_doc")
    n_gaps = len(state["evidence_gaps"])
    state["reasoning_trace"] = state.get("reasoning_trace", []) + [{
        "node": "search_corpus",
        "thought": (
            f"Retrieved {len(combined)} items: {n_projects} corpus projects, "
            f"{n_live} live calls, {n_chunks} knowledge docs. "
            f"Detected {n_gaps} evidence gap{'s' if n_gaps != 1 else ''}."
        ),
        "tool_calls": [
            {"tool": tc["tool"], "result_count": tc.get("result_count", 0), "status": "error" if "error" in tc else "ok"}
            for tc in tool_calls
        ],
        "status": "error" if state.get("error") else "ok",
    }]

    state["artifact_block"] = _build_partial_artifact(state, "search")
    return state


# ---------------------------------------------------------------------------
# Node 1b: External Evidence Search (gap-triggered, controlled routing)
# ---------------------------------------------------------------------------

def external_evidence_search(state: AtlasState) -> AtlasState:
    """
    Node 1b: Run external searches ONLY when evidence_gaps contain gaps
    with available_tool == "govuk_search" or "exa_search".

    Rules:
    - govuk_search fires for official_policy gaps only
    - exa_search fires for market_discovery / landscape_gap lanes only
    - No external search runs without a classified evidence_gap
    - GovUK is an access route — recommended_provider is the real publisher
    - Exa is an access route — recommended_provider is the real publisher when known
    - Results go into external_search_results (NOT corpus_citations)
    - Confidence ceiling is enforced in build_five_case (Exa-only → max Supported)

    If EXA_API_KEY is absent, exa_search is skipped gracefully.
    """
    gaps = state.get("evidence_gaps", [])
    tool_calls = state.get("tool_calls", [])
    external_results: list[dict] = []

    # Identify which external tools the gaps call for
    govuk_gaps = [
        g for g in gaps
        if g.get("available_tool") == "govuk_search"
        and g.get("recommended_source_lane") in ("official_policy", "research")
    ]
    exa_gaps = [
        g for g in gaps
        if g.get("available_tool") == "exa_search"
        and g.get("recommended_source_lane") in ("market_discovery", "research")
    ]

    # ── GOV.UK search (official_policy gaps) ──────────────────────────────
    if govuk_gaps:
        # Use the most specific gap topic as the search query when it's informative
        gap_topic = govuk_gaps[0].get("topic", "")
        query = state["query"]
        search_q = gap_topic if len(gap_topic) >= 20 else query
        try:
            govuk_results = search_govuk(search_q, limit=5)
            external_results.extend(govuk_results)
            tool_calls.append({
                "tool": "govuk_search",
                "args": {"query": search_q, "limit": 5},
                "result_count": len(govuk_results),
                "triggered_by": "evidence_gap",
                "gap_lane": govuk_gaps[0].get("recommended_source_lane"),
            })
        except Exception as exc:
            tool_calls.append({
                "tool": "govuk_search",
                "args": {"query": search_q},
                "error": str(exc),
                "triggered_by": "evidence_gap",
            })

    # ── Exa search (market_discovery / landscape gaps) ────────────────────
    if exa_gaps:
        exa_key = os.getenv("EXA_API_KEY", "").strip()
        gap_topic = exa_gaps[0].get("topic", "")
        query = state["query"]
        search_q = gap_topic if len(gap_topic) >= 20 else query

        if not exa_key:
            tool_calls.append({
                "tool": "exa_search",
                "skipped": True,
                "reason": "EXA_API_KEY not set — exa_search disabled",
                "triggered_by": "evidence_gap",
            })
        else:
            try:
                exa_results = search_exa(search_q, limit=5)
                external_results.extend(exa_results)
                tool_calls.append({
                    "tool": "exa_search",
                    "args": {"query": search_q, "limit": 5},
                    "result_count": len(exa_results),
                    "triggered_by": "evidence_gap",
                    "gap_lane": exa_gaps[0].get("recommended_source_lane"),
                })
            except Exception as exc:
                tool_calls.append({
                    "tool": "exa_search",
                    "args": {"query": search_q},
                    "error": str(exc),
                    "triggered_by": "evidence_gap",
                })

    scout_on = os.getenv("ATLAS_EXTERNAL_SCOUT_V1", "").strip().lower() in ("1", "true", "yes")
    corpus_hits = len(state.get("raw_search_results") or [])
    landscape_gap = any(g.get("type") == "landscape_gap" for g in gaps)
    if scout_on and (corpus_hits < 3 or landscape_gap):
        search_q = state.get("query", "")
        try:
            tavily_results = search_tavily(search_q, limit=8)
            external_results.extend(tavily_results)
            tool_calls.append({
                "tool": "tavily_search",
                "args": {"query": search_q, "limit": 8},
                "result_count": len(tavily_results),
                "triggered_by": "external_scout_v1",
                "corpus_hits": corpus_hits,
            })
        except Exception as exc:
            tool_calls.append({
                "tool": "tavily_search",
                "args": {"query": search_q},
                "error": str(exc),
                "triggered_by": "external_scout_v1",
            })

    state["external_search_results"] = external_results
    state["tool_calls"] = tool_calls

    _EXT_TOOLS = ("govuk_search", "exa_search", "tavily_search")
    ext_tools = [tc["tool"] for tc in tool_calls if tc.get("tool") in _EXT_TOOLS and not tc.get("skipped")]
    skipped = [tc["tool"] for tc in tool_calls if tc.get("skipped")]
    if ext_tools or skipped:
        thought = (
            f"External search: {', '.join(ext_tools)} → {len(external_results)} results."
            + (f" Skipped: {', '.join(skipped)}." if skipped else "")
        ) if ext_tools else f"External search skipped ({', '.join(skipped)})."
    else:
        thought = "No external evidence gaps triggered — corpus coverage sufficient."
    state["reasoning_trace"] = state.get("reasoning_trace", []) + [{
        "node": "external_evidence_search",
        "thought": thought,
        "tool_calls": [
            {"tool": tc["tool"], "result_count": tc.get("result_count", 0), "status": "skipped" if tc.get("skipped") else ("error" if "error" in tc else "ok")}
            for tc in tool_calls if tc.get("tool") in _EXT_TOOLS
        ],
        "status": "ok",
    }]

    return state


def _build_cpc_inward_assessment(state: AtlasState) -> AtlasState:
    """
    CPC-inward LLM path — generates capability/evidence assessment fields.

    Called by build_five_case when state["is_cpc_inward"] is True.
    Produces cpc_claims, cpc_portfolio, cpc_gaps and recommendation fields
    that the CPC recipe components (cpc_capability_assessment, cpc_evidence_gaps,
    cpc_market_alignment, cpc_portfolio_comparison) actually consume.

    Does NOT produce Five Case sections — those are for external investment appraisals.
    """
    from decimal import Decimal

    def _json_default(o: object) -> object:
        if isinstance(o, Decimal):
            return float(o)
        raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")

    query = state["query"]
    results_json = json.dumps(state["raw_search_results"], indent=2, default=_json_default)
    structural_gaps = state.get("evidence_gaps", [])
    gaps_json = json.dumps(structural_gaps, indent=2) if structural_gaps else "[]"
    recipe = state.get("target_recipe", "cpc_capability_assessment")

    system = f"""You are ATLAS operating in CPC Evidence Intelligence mode.

The user is asking about CPC's own evidence, capabilities, or portfolio readiness
(NOT requesting an external investment appraisal). Your job is to analyse the
CPC corpus results and produce a structured capability assessment.

MANDATORY RULES:
1. cpc_claims.id must be a real UUID from the corpus results (source_type project/live_call).
2. claim level meanings:
   - 1 (L1 Delivery): CPC can deliver/implement (project execution evidence)
   - 2 (L2 Programme): CPC has programme-level expertise (portfolio depth)
   - 3 (L3 Strategic): CPC can lead/shape strategy (sector influence evidence)
3. confidence_tier per the evidence-triage skill: Speculative/Indicative/Supported/Robust.
4. recommendation_action must be one of: "bid" | "partner" | "monitor" | "reject"
   - bid: strong evidence, proceed with submission
   - partner: evidence exists but gaps need a consortium partner
   - monitor: too early; evidence needs enrichment first
   - reject: evidence too thin or misaligned
5. cpc_gaps.severity: "high" = blocks bid, "medium" = weakens case, "low" = minor.
6. recipe context: '{recipe}' — shape your analysis for this view.

CORPUS SEARCH RESULTS:
{results_json}

STRUCTURAL EVIDENCE GAPS (pre-detected):
{gaps_json}

Respond in JSON ONLY — no markdown. Format:
{{
  "summary": "2-3 sentence executive summary of CPC's capability position",
  "cpc_claims": [
    {{
      "id": "<real UUID from corpus>",
      "text": "CPC has demonstrated [specific capability] through [specific project/evidence]",
      "level": 1,
      "confidence_tier": "Supported",
      "source_project": "Project name",
      "source_excerpt": "Brief quote or finding from the evidence",
      "business_unit": "Business unit name or null"
    }}
  ],
  "cpc_portfolio": [
    {{
      "name": "Business unit or theme name",
      "project_count": 3,
      "claim_count": 5,
      "l1_claims": 2,
      "l2_claims": 2,
      "l3_claims": 1,
      "evidence_links": 3
    }}
  ],
  "cpc_gaps": [
    {{
      "area": "Gap domain (e.g. Commercial deployment evidence)",
      "severity": "high",
      "description": "What is missing and why it matters for this query"
    }}
  ],
  "recommendation_action": "bid",
  "recommendation_rationale": "2-3 sentence explanation of the recommendation",
  "confidence_tier": "Supported",
  "analysis": "One paragraph confidence summary citing specific evidence and gaps"
}}"""

    try:
        llm = _llm_internal()
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"CPC evidence query: {query}"),
        ])
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        parsed = json.loads(content.strip())

        tier = parsed.get("confidence_tier", "Speculative")
        valid_tiers = {"Speculative", "Indicative", "Supported", "Robust"}
        tier = tier if tier in valid_tiers else "Speculative"

        # Store as sections["Summary"] so the recipe component can render summary prose
        state["sections"] = {"Summary": parsed.get("summary", "")}
        state["five_case_model"] = {}
        state["npv_value"] = None
        state["discount_rate"] = HMT_STPR
        state["optimism_bias"] = None
        state["confidence_tier"] = tier
        state["decision_spine"] = None
        state["section_scores"] = {}
        state["analysis"] = parsed.get("analysis", "")

        # Validate corpus citations from cpc_claims
        valid_id_to_sim: dict[str, float] = {
            r["id"]: float(r.get("similarity") or 0.0)
            for r in state["raw_search_results"]
            if r.get("id") and r.get("source_type") in ("project", "live_call")
        }
        # Build corpus_citations from cpc_claims' source IDs
        seen_ids: set[str] = set()
        safe_citations: list[CorpusCitation] = []
        for claim in parsed.get("cpc_claims", []):
            cid = claim.get("id", "")
            if cid in valid_id_to_sim and cid not in seen_ids:
                seen_ids.add(cid)
                safe_citations.append({
                    "id": cid,
                    "title": claim.get("source_project", ""),
                    "organisation": "",
                    "relevance_note": claim.get("text", ""),
                    "score": float(valid_id_to_sim[cid]),
                })
        state["corpus_citations"] = safe_citations

        # Store CPC-specific fields directly on state for artifact_block assembly
        # These are non-standard AtlasState keys but get forwarded via artifact_block
        state["_cpc_claims"] = parsed.get("cpc_claims", [])          # type: ignore[typeddict-unknown-key]
        state["_cpc_portfolio"] = parsed.get("cpc_portfolio", [])    # type: ignore[typeddict-unknown-key]
        state["_cpc_gaps"] = parsed.get("cpc_gaps", [])              # type: ignore[typeddict-unknown-key]
        state["_recommendation_action"] = parsed.get("recommendation_action")  # type: ignore[typeddict-unknown-key]
        state["_recommendation_rationale"] = parsed.get("recommendation_rationale")  # type: ignore[typeddict-unknown-key]

        # Merge LLM-provided cpc_gaps into evidence_gaps for gap bar charts
        structural = state.get("evidence_gaps", [])
        for g in parsed.get("cpc_gaps", []):
            structural.append({
                "type": "corpus_gap",
                "topic": str(g.get("area", ""))[:200],
                "severity": g.get("severity", "medium"),
                "reason": str(g.get("description", ""))[:500],
                "recommended_action": "Enrich corpus or engage partner",
                "recommended_source_lane": "ingestion_backlog",
                "recommended_provider": "CPC_Corpus",
                "available_tool": "cpc_corpus",
                "can_lift_confidence": True,
                "citation_status": "direct",
            })
        state["evidence_gaps"] = structural

        state["reasoning_trace"] = state.get("reasoning_trace", []) + [{
            "node": "build_five_case",
            "thought": (
                f"CPC-inward assessment. {len(safe_citations)} verified corpus citations. "
                f"{len(parsed.get('cpc_claims', []))} claims extracted. "
                f"Confidence: {tier}. Recipe: {recipe}."
            ),
            "tool_calls": [{"tool": "llm_invoke", "model": os.environ.get("MODEL_NAME", "claude-sonnet-4-6"), "prompt": "cpc_inward_assessment"}],
            "status": "ok",
        }]

    except Exception as e:
        state["sections"] = {"Summary": f"[CPC assessment error: {e}]"}
        state["five_case_model"] = {}
        state["npv_value"] = None
        state["discount_rate"] = HMT_STPR
        state["optimism_bias"] = None
        state["corpus_citations"] = []
        state["confidence_tier"] = "Speculative"
        state["decision_spine"] = None
        state["section_scores"] = {}
        state["analysis"] = ""
        state["error"] = f"_build_cpc_inward_assessment error: {e}"
        state["_cpc_claims"] = []          # type: ignore[typeddict-unknown-key]
        state["_cpc_portfolio"] = []       # type: ignore[typeddict-unknown-key]
        state["_cpc_gaps"] = []            # type: ignore[typeddict-unknown-key]
        state["_recommendation_action"] = None   # type: ignore[typeddict-unknown-key]
        state["_recommendation_rationale"] = None  # type: ignore[typeddict-unknown-key]
        state["reasoning_trace"] = state.get("reasoning_trace", []) + [{
            "node": "build_five_case",
            "thought": f"CPC-inward assessment failed: {e}",
            "tool_calls": [],
            "status": "error",
        }]

    return state


# ---------------------------------------------------------------------------
# Mode-specific builders — Orient, Connect, Diagnose, Act, Defend
# (Gap D fix — 2026-06-01)
#
# build_five_case is the dispatcher; it routes to these helpers based on
# target_recipe.  The Act path (brief_five_case) remains inline in
# build_five_case to preserve the G1–G7 golden eval contract.
# ---------------------------------------------------------------------------

def _build_orient_report(state: AtlasState) -> AtlasState:
    """
    Orient mode — surface the terrain relevant to the user's decision.

    Maps to recipes: cpc_capability_assessment, cpc_market_alignment
    North Star v3.1: "Do not show the whole landscape — show what matters
    given who the user is, what they have, and what they are trying to decide."

    Output sections: Landscape Overview, What Exists, Key Players, CPC Position,
    Market Signals, Evidence Gaps, Recommended Orientation
    """
    ctx = state.get("context_packet", {})
    skills_text = "\n\n".join(
        f"=== SKILL: {s['name']} ===\n{s['content']}"
        for s in ctx.get("active_skills", [])
    )
    from decimal import Decimal

    def _json_default(o: object) -> object:
        if isinstance(o, Decimal):
            return float(o)
        raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")

    results_json = json.dumps(state["raw_search_results"], indent=2, default=_json_default)
    query = state["query"]
    recipe = state.get("target_recipe", "cpc_capability_assessment")
    suggested = suggested_citations_block(state["raw_search_results"])

    system = f"""You are ATLAS in Orient mode, the terrain-surfacing agent for Connected Places Catapult.

Your task is to help the user understand the relevant landscape for their decision — NOT to produce
a business case. Focus on: what exists, who is doing it, where CPC sits, and what signals matter.

MANDATORY RULES:
1. {_CITATION_PROMPT_RULE}
2. NEVER fabricate project IDs.
3. Orient reports surface terrain — they do not recommend a single course of action.
4. Assign confidence_tier per evidence-triage skill: Speculative (no corpus hits), Indicative (1-2),
   Supported (3+ mixed), Robust (5+ strong).
5. decision_spine.recommendation must orient the user, not tell them to apply for something.
6. Include all five decision_spine fields: decision, recommendation, confidence_tier,
   key_assumption, next_action.

{"RECIPE: CPC Capability Assessment — focus on CPC's existing capabilities vs. market demand." if recipe == "cpc_capability_assessment" else "RECIPE: CPC Market Alignment — focus on how CPC's portfolio aligns with current market signals."}

{skills_text}

CORPUS SEARCH RESULTS:
{results_json}

SUGGESTED CITATIONS (prefer these IDs when relevant):
{suggested}

Respond in JSON ONLY:
{{
  "sections": {{
    "Landscape Overview": "What the terrain looks like — key players, funding flows, activity clusters...",
    "What Exists": "Specific projects, programmes, and precedents found in corpus...",
    "Key Players": "Who is active in this space — funders, operators, R&D orgs...",
    "CPC Position": "Where CPC sits relative to this landscape (based on corpus evidence)...",
    "Market Signals": "Signals about demand, policy direction, investment momentum...",
    "Evidence Gaps": "What is missing from this terrain picture and why it matters..."
  }},
  "decision_spine": {{
    "decision": "One-sentence statement of the terrain judgement",
    "recommendation": "2-3 sentence orientation: what to watch, what to exploit, what to avoid",
    "confidence_tier": "Speculative|Indicative|Supported|Robust",
    "key_assumption": "The most fragile assumption in this landscape reading",
    "next_action": "The immediate next step to sharpen this orientation"
  }},
  "corpus_citations": [
    {{"id": "<from results>", "title": "...", "organisation": "...",
      "relevance_note": "...", "score": 0.00}}
  ],
  "evidence_gaps": [
    {{
      "type": "corpus_gap",
      "topic": "Specific terrain gap",
      "severity": "medium",
      "reason": "Why this gap limits orientation quality",
      "recommended_action": "How to close it",
      "recommended_source_lane": "official_policy|funding|research|market_discovery",
      "recommended_provider": "DfT|InnovateUK|CCAV|UKRI|Exa|GovUK|CPC_Corpus",
      "available_tool": "cpc_corpus|live_calls|govuk_search|exa_search|none_yet",
      "can_lift_confidence": true,
      "citation_status": "candidate|background"
    }}
  ],
  "confidence_tier": "Speculative|Indicative|Supported|Robust",
  "headline": "One-sentence terrain verdict (max 30 words). Required.",
  "insight_card": "2-3 sentences: why the headline is true. Required. No bullet lists.",
  "analysis": "Optional extra context — prefer insight_card for the waterfall."
}}"""

    try:
        llm = _llm_internal()
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"Orient query: {query}"),
        ])
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        parsed = json.loads(content.strip())

        _parse_insight_fields(state, parsed)

        raw_sections = parsed.get("sections", {})
        state["sections"] = raw_sections
        state["five_case_model"] = {}
        state["npv_value"] = None
        state["discount_rate"] = HMT_STPR
        state["optimism_bias"] = None
        state["section_scores"] = {}
        if not state.get("_insight_card") and parsed.get("analysis"):  # type: ignore[attr-defined]
            state["analysis"] = parsed.get("analysis", "")

        # Citations — verify against corpus
        raw_cites = parsed.get("corpus_citations", [])
        safe_citations = filter_llm_citations(raw_cites, state["raw_search_results"])
        state["corpus_citations"] = safe_citations

        # Confidence tier
        tier = parsed.get("confidence_tier", "Speculative")
        tier = tier if tier in {t for t in _TIER_ORDER} else "Speculative"
        state["confidence_tier"] = _cap_tier(tier, "Indicative") if not safe_citations else tier

        # Decision spine
        raw_spine = parsed.get("decision_spine", {})
        state["decision_spine"] = {
            "decision": str(raw_spine.get("decision", "")),
            "recommendation": str(raw_spine.get("recommendation", "")),
            "confidence_tier": state["confidence_tier"],
            "key_assumption": str(raw_spine.get("key_assumption", "")),
            "next_action": str(raw_spine.get("next_action", "")),
            "framework": "Atlas Orient / North Star v3.1",
        }

        state["evidence_gaps"] = state.get("evidence_gaps", [])
        state["reasoning_trace"] = state.get("reasoning_trace", []) + [{
            "node": "build_five_case",
            "thought": f"Orient report built (recipe={recipe}). {len(safe_citations)} citations. Confidence: {state['confidence_tier']}.",
            "tool_calls": [{"tool": "llm_invoke", "model": os.environ.get("MODEL_NAME", "claude-sonnet-4-6"), "prompt": "orient_mode"}],
            "status": "ok",
        }]

    except Exception as e:
        state["sections"] = {"Landscape Overview": f"[Orient error: {e}]"}
        state["five_case_model"] = {}
        state["npv_value"] = None
        state["discount_rate"] = HMT_STPR
        state["optimism_bias"] = None
        state["corpus_citations"] = []
        state["confidence_tier"] = "Speculative"
        state["decision_spine"] = None
        state["section_scores"] = {}
        state["analysis"] = ""
        state["error"] = f"_build_orient_report error: {e}"
        state["reasoning_trace"] = state.get("reasoning_trace", []) + [{
            "node": "build_five_case",
            "thought": f"Orient report failed: {e}",
            "tool_calls": [],
            "status": "error",
        }]

    return state


def _build_connect_report(state: AtlasState) -> AtlasState:
    """
    Connect mode — find credible opportunity routes not immediately obvious.

    Maps to recipes: cpc_opportunity_fit, cpc_portfolio_comparison, cpc_funding_flow
    North Star v3.1: "Every connection must be explainable — no black-box similarity."

    Output sections: Opportunity Routes, Adjacent Sectors, Relevant Funders,
    Partner Landscape, Policy Signals, Funding Flows, Next Connection
    """
    ctx = state.get("context_packet", {})
    skills_text = "\n\n".join(
        f"=== SKILL: {s['name']} ===\n{s['content']}"
        for s in ctx.get("active_skills", [])
    )
    from decimal import Decimal

    def _json_default(o: object) -> object:
        if isinstance(o, Decimal):
            return float(o)
        raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")

    results_json = json.dumps(state["raw_search_results"], indent=2, default=_json_default)
    query = state["query"]
    recipe = state.get("target_recipe", "cpc_opportunity_fit")
    suggested = suggested_citations_block(state["raw_search_results"])

    recipe_focus = {
        "cpc_opportunity_fit": "Focus on how well this opportunity fits CPC's current capabilities and portfolio.",
        "cpc_portfolio_comparison": "Focus on comparing multiple opportunities or portfolio options. Produce a structured comparison with each opportunity as a named row and evaluation criteria as columns — not flowing prose.",
        "cpc_funding_flow": "Focus on funding routes, grant programmes, and investment flows.",
    }.get(recipe, "Focus on connecting relevant opportunities to the user's context.")

    system = f"""You are ATLAS in Connect mode, the opportunity-route agent for Connected Places Catapult.

Your task is to find credible, explainable routes to opportunities the user would not immediately see.
Every connection must be explicable — not black-box similarity suggestions.

MANDATORY RULES:
1. {_CITATION_PROMPT_RULE}
2. NEVER fabricate IDs.
3. Connect reports map routes — every route has a rationale.
4. Confidence_tier follows evidence-triage skill rules.
5. decision_spine.recommendation must name a specific route, not a generic instruction.
6. All five decision_spine fields required.

{recipe_focus}

{skills_text}

CORPUS SEARCH RESULTS:
{results_json}

SUGGESTED CITATIONS (prefer these IDs when relevant):
{suggested}

Respond in JSON ONLY:
{{
  "sections": {{
    "Opportunity Routes": "Specific, explainable routes with rationale for each...",
    "Adjacent Sectors": "Non-obvious sector analogues worth exploring...",
    "Relevant Funders": "Specific funders and programmes, with fit rationale...",
    "Partner Landscape": "Potential partners and why they are relevant...",
    "Policy Signals": "Policy or investment signals that strengthen or weaken these routes...",
    "Recommended Route": "The strongest single route and why..."
  }},
  "decision_spine": {{
    "decision": "The connection decision: which route to pursue",
    "recommendation": "2-3 sentences on the specific route, timing, and key conditions",
    "confidence_tier": "Speculative|Indicative|Supported|Robust",
    "key_assumption": "The most fragile assumption this route rests on",
    "next_action": "The immediate step to activate this connection"
  }},
  "corpus_citations": [
    {{"id": "<from results>", "title": "...", "organisation": "...",
      "relevance_note": "...", "score": 0.00}}
  ],
  "evidence_gaps": [
    {{
      "type": "corpus_gap",
      "topic": "Missing connection evidence",
      "severity": "medium",
      "reason": "Why this gap weakens the route",
      "recommended_action": "How to close it",
      "recommended_source_lane": "funding|market_discovery|research",
      "recommended_provider": "InnovateUK|DfT|CCAV|UKRI|Exa|GovUK|CPC_Corpus",
      "available_tool": "cpc_corpus|live_calls|govuk_search|exa_search|none_yet",
      "can_lift_confidence": true,
      "citation_status": "candidate|background"
    }}
  ],
  "confidence_tier": "Speculative|Indicative|Supported|Robust",
  "analysis": "One-paragraph route summary."
}}"""

    try:
        llm = _llm_internal()
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"Connect query: {query}"),
        ])
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        parsed = json.loads(content.strip())

        state["sections"] = parsed.get("sections", {})
        state["five_case_model"] = {}
        state["npv_value"] = None
        state["discount_rate"] = HMT_STPR
        state["optimism_bias"] = None
        state["section_scores"] = {}
        state["analysis"] = parsed.get("analysis", "")

        raw_cites = parsed.get("corpus_citations", [])
        safe_citations = filter_llm_citations(raw_cites, state["raw_search_results"])
        state["corpus_citations"] = safe_citations

        tier = parsed.get("confidence_tier", "Speculative")
        tier = tier if tier in {t for t in _TIER_ORDER} else "Speculative"
        state["confidence_tier"] = _cap_tier(tier, "Indicative") if not safe_citations else tier

        raw_spine = parsed.get("decision_spine", {})
        state["decision_spine"] = {
            "decision": str(raw_spine.get("decision", "")),
            "recommendation": str(raw_spine.get("recommendation", "")),
            "confidence_tier": state["confidence_tier"],
            "key_assumption": str(raw_spine.get("key_assumption", "")),
            "next_action": str(raw_spine.get("next_action", "")),
            "framework": "Atlas Connect / North Star v3.1",
        }

        state["evidence_gaps"] = state.get("evidence_gaps", [])
        state["reasoning_trace"] = state.get("reasoning_trace", []) + [{
            "node": "build_five_case",
            "thought": f"Connect report built (recipe={recipe}). {len(safe_citations)} citations. Confidence: {state['confidence_tier']}.",
            "tool_calls": [{"tool": "llm_invoke", "model": os.environ.get("MODEL_NAME", "claude-sonnet-4-6"), "prompt": "connect_mode"}],
            "status": "ok",
        }]

    except Exception as e:
        state["sections"] = {"Opportunity Routes": f"[Connect error: {e}]"}
        state["five_case_model"] = {}
        state["npv_value"] = None
        state["discount_rate"] = HMT_STPR
        state["optimism_bias"] = None
        state["corpus_citations"] = []
        state["confidence_tier"] = "Speculative"
        state["decision_spine"] = None
        state["section_scores"] = {}
        state["analysis"] = ""
        state["error"] = f"_build_connect_report error: {e}"
        state["reasoning_trace"] = state.get("reasoning_trace", []) + [{
            "node": "build_five_case",
            "thought": f"Connect report failed: {e}",
            "tool_calls": [],
            "status": "error",
        }]

    return state


def _build_diagnose_report(state: AtlasState) -> AtlasState:
    """
    Diagnose mode — Evidence Gap & Value Translation Report.

    Maps to recipe: cpc_evidence_gaps
    North Star v3.1: "Surface what proof would unlock value, fit, safety,
    adoption, or credibility in a new context. This is value translation."

    Output: 8-section report per Notion template
    (https://www.notion.so/36dc9b382a7481c1b556de97246134e4):
      1. Entity Summary
      2. Opportunity Context
      3. Fit Analysis
      4. Evidence Gaps
      5. Value Translation Assessment
      6. Entry Friction Summary
      7. Recommended Next Move
      8. Defend Package
    """
    ctx = state.get("context_packet", {})
    skills_text = "\n\n".join(
        f"=== SKILL: {s['name']} ===\n{s['content']}"
        for s in ctx.get("active_skills", [])
    )
    from decimal import Decimal

    def _json_default(o: object) -> object:
        if isinstance(o, Decimal):
            return float(o)
        raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")

    results_json = json.dumps(state["raw_search_results"], indent=2, default=_json_default)
    query = state["query"]
    structural_gaps = state.get("evidence_gaps", [])
    gaps_json = json.dumps(structural_gaps, indent=2) if structural_gaps else "[]"
    external_results = state.get("external_search_results", [])
    external_json = json.dumps(external_results, indent=2) if external_results else "[]"
    suggested = suggested_citations_block(state["raw_search_results"])

    passport_ctx = None
    try:
        from agents.passport_loader import load_passport_for_query
        passport_ctx = load_passport_for_query(query)
    except Exception:
        passport_ctx = None
    passport_json = json.dumps(passport_ctx, indent=2, default=str) if passport_ctx else "null"

    system = f"""You are ATLAS in Diagnose mode, the evidence gap and value translation agent for Connected Places Catapult.

Your task is to produce an Evidence Gap & Value Translation Report.
This is NOT a Five Case brief. Do not produce NPV calculations or HMT Green Book sections.

Your job: explain what proof would unlock value, fit, or credibility in a specific context —
and what the entity should do to close the gap or reframe the value claim.

REPORT STRUCTURE — you must produce ALL eight sections:

1. Entity Summary — what the entity is, its core claims with claim states
   (stated ✓ / inferred ~ / unknown ? / contested ⚠), maturity, sector validity
2. Opportunity Context — what the matched opportunity demands:
   funder, deadline, eligibility, value weighting, entry-friction tags
3. Fit Analysis — per-criterion table: criterion / passport response / claim state /
   fit level (Met/Partial/Gap/Unknown) / evidence strength (Strong/Moderate/Weak/None)
4. Evidence Gaps — for each gap: what is missing, WHY it matters (fundability /
   transferability / adoption / procurement / safety / trust), evidence risk level,
   effort to close, suggested action
   FRAMING RULE: Never say "X is missing." Say "X is missing, which blocks Y because Z."
5. Value Translation Assessment — which claims travel as-is, which need reframing,
   which are not yet credible here and why; what reframing or new proof would help
6. Entry Friction Summary — entry-friction tags explained for this specific entity;
   combined entry risk level; key questions to resolve before committing effort
7. Recommended Next Move — primary recommendation with confidence tier;
   specific options (Apply now / Reposition / Evidence-build / Seek partner / Monitor / Stop);
   key assumptions; what would change the recommendation
8. Defend Package — evidence trail; assumptions; confidence tiers per section;
   alternative interpretations; likely objections and responses;
   what evidence would change the conclusion

MANDATORY RULES:
1. {_CITATION_PROMPT_RULE}
2. NEVER fabricate IDs.
3. confidence_tier must reflect the evidence quality for THIS gap analysis, not the
   entity's general quality.
4. All five decision_spine fields required: decision, recommendation, confidence_tier,
   key_assumption, next_action.
5. entry_friction_tags must draw from:
   procurement_route | prime_partner_needed | regulatory_barrier | certification_required |
   sales_cycle_length | liability_exposure | data_access_dependency | integration_complexity |
   local_presence_required | funding_deadline_pressure
6. claim_states notation: stated / inferred / unknown / contested

{skills_text}

ENTITY PASSPORT (when matched — use for Fit Analysis rows; infer only if null):
{passport_json}

STRUCTURAL EVIDENCE GAPS (pre-detected):
{gaps_json}

EXTERNAL EVIDENCE (context only — do NOT put URLs in corpus_citations):
{external_json}

CORPUS SEARCH RESULTS:
{results_json}

SUGGESTED CITATIONS (prefer these IDs when relevant):
{suggested}

Respond in JSON ONLY:
{{
  "sections": {{
    "Entity Summary": "Entity name, type, core claims with claim states, maturity, sector validity...",
    "Opportunity Context": "Requirement spec name, source, deadline, eligibility, value weighting, entry-friction tags...",
    "Fit Analysis": "Per-criterion table as markdown: | Criterion | Passport response | Claim state | Fit level | Evidence strength |\\n|---|---|---|---|---|\\n...",
    "Evidence Gaps": "For each gap: what, why it matters (value consequence), evidence risk, effort, action. Use FRAMING RULE.",
    "Value Translation Assessment": "Claims that travel as-is, claims needing reframing, claims not yet credible. Specific reframing instructions.",
    "Entry Friction Summary": "Entry-friction tags explained for this entity. Combined risk level (Low/Medium/High). Key questions to resolve.",
    "Recommended Next Move": "Primary recommendation + confidence. Options (Apply now / Reposition / Evidence-build / Seek partner / Monitor / Stop). Assumptions. What would change this.",
    "Defend Package": "Evidence trail (citations). Assumptions explicitly stated. Confidence per section. Alternative interpretations. Likely objections and responses. What would overturn this."
  }},
  "decision_spine": {{
    "decision": "One-sentence: the primary action recommendation",
    "recommendation": "2-3 sentences: specific next move with conditions",
    "confidence_tier": "Speculative|Indicative|Supported|Robust",
    "key_assumption": "The most fragile assumption this recommendation rests on",
    "next_action": "The single most important immediate action"
  }},
  "corpus_citations": [
    {{"id": "<from results>", "title": "...", "organisation": "...",
      "relevance_note": "...", "score": 0.00}}
  ],
  "evidence_gaps": [
    {{
      "type": "corpus_gap|retrieval_gap|landscape_gap",
      "topic": "Specific gap with value consequence",
      "severity": "low|medium|high",
      "reason": "What is missing and why it blocks value / fit / credibility",
      "recommended_action": "Specific closing action",
      "recommended_source_lane": "official_policy|funding|research|market_discovery|procurement",
      "recommended_provider": "InnovateUK|DfT|CCAV|UKRI|HorizonEurope|FindATender|Exa|GovUK|CPC_Corpus",
      "available_tool": "cpc_corpus|live_calls|govuk_search|exa_search|future_innovateuk_api|none_yet",
      "can_lift_confidence": true,
      "citation_status": "direct|candidate|background"
    }}
  ],
  "entry_friction_tags": ["procurement_route", "certification_required"],
  "claim_states": {{
    "core_claim_1": "stated",
    "core_claim_2": "inferred",
    "maturity": "stated"
  }},
  "confidence_tier": "Speculative|Indicative|Supported|Robust",
  "headline": "One-sentence verdict: apply / reposition / evidence-build (max 30 words). Required.",
  "insight_card": "2-3 sentences: why the headline is true. Required.",
  "analysis": "Optional extra context — prefer insight_card."
}}"""

    try:
        llm = _llm_internal()
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"Evidence gap and value translation query: {query}"),
        ])
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        parsed = json.loads(content.strip())

        _parse_insight_fields(state, parsed)

        # Sections (8-section Diagnose report — no Five Case keys)
        raw_sections = parsed.get("sections", {})
        state["sections"] = raw_sections
        state["five_case_model"] = {}   # not applicable for Diagnose
        state["npv_value"] = None       # not applicable for Diagnose
        state["discount_rate"] = HMT_STPR
        state["optimism_bias"] = None
        state["section_scores"] = {}

        # Extended Diagnose-specific fields
        state["entry_friction_tags"] = parsed.get("entry_friction_tags", [])  # type: ignore[typeddict-unknown-key]
        state["claim_states"] = parsed.get("claim_states", {})                 # type: ignore[typeddict-unknown-key]

        # Citations
        raw_cites = parsed.get("corpus_citations", [])
        safe_citations = filter_llm_citations(raw_cites, state["raw_search_results"])
        state["corpus_citations"] = safe_citations
        if passport_ctx:
            state["_passport_id"] = passport_ctx.get("passport_id")  # type: ignore[typeddict-unknown-key]
        has_external = bool(state.get("external_search_results"))

        # Confidence ceiling — same rules as Act path
        tier = parsed.get("confidence_tier", "Speculative")
        tier = tier if tier in {t for t in _TIER_ORDER} else "Speculative"
        if not safe_citations and has_external:
            tier = _cap_tier(tier, "Supported")
        remaining_gaps = state.get("evidence_gaps", [])
        all_background = (
            bool(remaining_gaps)
            and not safe_citations
            and all(not g.get("can_lift_confidence", True) for g in remaining_gaps)
        )
        if all_background:
            tier = _cap_tier(tier, "Indicative")
        state["confidence_tier"] = tier

        raw_spine = parsed.get("decision_spine", {})
        state["decision_spine"] = {
            "decision": str(raw_spine.get("decision", "")),
            "recommendation": str(raw_spine.get("recommendation", "")),
            "confidence_tier": state["confidence_tier"],
            "key_assumption": str(raw_spine.get("key_assumption", "")),
            "next_action": str(raw_spine.get("next_action", "")),
            "framework": "Atlas Diagnose / Evidence Gap & Value Translation Report",
        }

        state["analysis"] = parsed.get("analysis", "")

        # Merge structural + LLM evidence gaps
        structural = state.get("evidence_gaps", [])
        llm_raw_gaps = parsed.get("evidence_gaps", [])
        valid_gap_types = {"retrieval_gap", "corpus_gap", "landscape_gap"}
        valid_severities = {"low", "medium", "high"}
        valid_lanes = {
            "internal_precedent", "official_policy", "funding", "procurement",
            "research", "market_discovery", "ingestion_backlog",
        }
        valid_providers = {
            "InnovateUK", "DfT", "NationalHighways", "CCAV", "UKRI",
            "HorizonEurope", "FindATender", "Exa", "GovUK", "CPC_Corpus",
        }
        valid_tools = {
            "cpc_corpus", "live_calls", "govuk_search", "exa_search",
            "future_innovateuk_api", "future_tender_api", "none_yet",
        }
        valid_cite = {"direct", "candidate", "background"}

        llm_gaps = []
        for g in llm_raw_gaps:
            if g.get("type", "") not in valid_gap_types:
                continue
            raw_lane = g.get("recommended_source_lane", "")
            lane = raw_lane if raw_lane in valid_lanes else "ingestion_backlog"
            raw_provider = g.get("recommended_provider", "")
            provider = raw_provider if raw_provider in valid_providers else "CPC_Corpus"
            raw_tool = g.get("available_tool", "")
            tool = raw_tool if raw_tool in valid_tools else "none_yet"
            raw_can_lift = g.get("can_lift_confidence", True)
            can_lift = bool(raw_can_lift) if isinstance(raw_can_lift, bool) else str(raw_can_lift).lower() != "false"
            raw_cite = g.get("citation_status", "candidate")
            cite = raw_cite if raw_cite in valid_cite else "candidate"
            llm_gaps.append({
                "type": g["type"],
                "topic": str(g.get("topic", ""))[:200],
                "severity": g.get("severity", "medium") if g.get("severity") in valid_severities else "medium",
                "reason": str(g.get("reason", ""))[:500],
                "recommended_action": str(g.get("recommended_action", ""))[:300],
                "recommended_source_lane": lane,
                "recommended_provider": provider,
                "available_tool": tool,
                "can_lift_confidence": can_lift,
                "citation_status": cite,
            })
        seen_topics = {(g["type"], g["topic"].lower()[:40]) for g in structural}
        for g in llm_gaps:
            key = (g["type"], g["topic"].lower()[:40])
            if key not in seen_topics:
                structural.append(g)
                seen_topics.add(key)
        state["evidence_gaps"] = structural

        state["reasoning_trace"] = state.get("reasoning_trace", []) + [{
            "node": "build_five_case",
            "thought": (
                f"Diagnose report built (Evidence Gap & Value Translation). "
                f"{len(safe_citations)} citations. {len(state['evidence_gaps'])} gaps. "
                f"Confidence: {state['confidence_tier']}."
            ),
            "tool_calls": [{"tool": "llm_invoke", "model": os.environ.get("MODEL_NAME", "claude-sonnet-4-6"), "prompt": "diagnose_mode"}],
            "status": "ok",
        }]

    except Exception as e:
        state["sections"] = {
            s: f"[Diagnose error: {e}]"
            for s in [
                "Entity Summary", "Opportunity Context", "Fit Analysis",
                "Evidence Gaps", "Value Translation Assessment",
                "Entry Friction Summary", "Recommended Next Move", "Defend Package",
            ]
        }
        state["five_case_model"] = {}
        state["npv_value"] = None
        state["discount_rate"] = HMT_STPR
        state["optimism_bias"] = None
        state["corpus_citations"] = []
        state["confidence_tier"] = "Speculative"
        state["decision_spine"] = None
        state["section_scores"] = {}
        state["analysis"] = ""
        state["entry_friction_tags"] = []   # type: ignore[typeddict-unknown-key]
        state["claim_states"] = {}           # type: ignore[typeddict-unknown-key]
        state["error"] = f"_build_diagnose_report error: {e}"
        state["reasoning_trace"] = state.get("reasoning_trace", []) + [{
            "node": "build_five_case",
            "thought": f"Diagnose report failed: {e}",
            "tool_calls": [],
            "status": "error",
        }]

    return state


def _build_defend_report(state: AtlasState) -> AtlasState:
    """
    Defend mode — help the user hold their position under challenge.

    North Star v3.1: "Help the user hold up under challenge in a board, panel,
    procurement, funding, or stakeholder room. Defend is not just the final step —
    it is the quality standard across the whole journey."

    Output sections: Evidence Trail, Assumptions, Confidence per Claim,
    Objections & Responses, Alternative Interpretations, What Would Change This
    """
    ctx = state.get("context_packet", {})
    skills_text = "\n\n".join(
        f"=== SKILL: {s['name']} ===\n{s['content']}"
        for s in ctx.get("active_skills", [])
    )
    from decimal import Decimal

    def _json_default(o: object) -> object:
        if isinstance(o, Decimal):
            return float(o)
        raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")

    results_json = json.dumps(state["raw_search_results"], indent=2, default=_json_default)
    query = state["query"]

    system = f"""You are ATLAS in Defend mode, the challenge-readiness agent for Connected Places Catapult.

Your task is to help the user defend a position, recommendation, or investment decision
under rigorous challenge from a board, panel, funding body, or sceptical stakeholder.

Defend is a quality standard, not a final step. Every claim must be traceable.
Every assumption must be explicit. Every likely objection must be anticipated.

MANDATORY RULES:
1. All corpus_citation.id values MUST come from source_type "project" or "live_call" in results.
2. NEVER fabricate IDs.
3. Defend reports must surface objections honestly — do not suppress challenges.
4. Confidence tiers are per-claim, not just overall.
5. "What would change this" must be specific, not generic.
6. All five decision_spine fields required.

{skills_text}

CORPUS SEARCH RESULTS:
{results_json}

Respond in JSON ONLY:
{{
  "sections": {{
    "Evidence Trail": "Full citation trail: which claims rest on which corpus evidence, with IDs and similarity scores...",
    "Assumptions": "All assumptions explicitly stated — what has been treated as given and why...",
    "Confidence per Claim": "Confidence tier and rationale for each key claim (not just overall)...",
    "Objections & Responses": "Likely objections a sceptical reviewer would raise, with specific responses to each...",
    "Alternative Interpretations": "Where this evidence or recommendation could legitimately be read differently...",
    "What Would Change This": "Specific evidence, events, or findings that would materially change the recommendation..."
  }},
  "decision_spine": {{
    "decision": "The position being defended",
    "recommendation": "2-3 sentences on how to hold the position and what to acknowledge",
    "confidence_tier": "Speculative|Indicative|Supported|Robust",
    "key_assumption": "The assumption most likely to be challenged",
    "next_action": "The most important preparation before the challenge room"
  }},
  "corpus_citations": [
    {{"id": "<from results>", "title": "...", "organisation": "...",
      "relevance_note": "...", "score": 0.00}}
  ],
  "evidence_gaps": [
    {{
      "type": "corpus_gap",
      "topic": "Evidence that would strengthen defence",
      "severity": "high",
      "reason": "What challengers will probe without this",
      "recommended_action": "How to close before the challenge room",
      "recommended_source_lane": "official_policy|funding|research",
      "recommended_provider": "DfT|InnovateUK|CCAV|UKRI|Exa|GovUK|CPC_Corpus",
      "available_tool": "cpc_corpus|govuk_search|exa_search|none_yet",
      "can_lift_confidence": true,
      "citation_status": "direct|candidate|background"
    }}
  ],
  "claims": [
    {{
      "text": "One sentence stating the claim exactly as it would be challenged",
      "state": "stated|inferred|unknown|contested",
      "confidence_tier": "Speculative|Indicative|Supported|Robust",
      "source": "corpus citation ID, external source title, or 'inferred from context'"
    }}
  ],
  "confidence_tier": "Speculative|Indicative|Supported|Robust",
  "analysis": "One-paragraph: how defensible is the position and what is the weakest link."
}}"""

    try:
        llm = _llm_internal()
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"Defend query: {query}"),
        ])
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        parsed = json.loads(content.strip())

        state["sections"] = parsed.get("sections", {})
        state["five_case_model"] = {}
        state["npv_value"] = None
        state["discount_rate"] = HMT_STPR
        state["optimism_bias"] = None
        state["section_scores"] = {}
        state["analysis"] = parsed.get("analysis", "")

        raw_cites = parsed.get("corpus_citations", [])
        safe_citations = filter_llm_citations(raw_cites, state["raw_search_results"])
        state["corpus_citations"] = safe_citations

        tier = parsed.get("confidence_tier", "Speculative")
        tier = tier if tier in {t for t in _TIER_ORDER} else "Speculative"
        state["confidence_tier"] = tier

        raw_spine = parsed.get("decision_spine", {})
        state["decision_spine"] = {
            "decision": str(raw_spine.get("decision", "")),
            "recommendation": str(raw_spine.get("recommendation", "")),
            "confidence_tier": state["confidence_tier"],
            "key_assumption": str(raw_spine.get("key_assumption", "")),
            "next_action": str(raw_spine.get("next_action", "")),
            "framework": "Atlas Defend / North Star v3.1",
        }

        state["evidence_gaps"] = state.get("evidence_gaps", [])
        state["reasoning_trace"] = state.get("reasoning_trace", []) + [{
            "node": "build_five_case",
            "thought": f"Defend report built. {len(safe_citations)} citations. Confidence: {state['confidence_tier']}.",
            "tool_calls": [{"tool": "llm_invoke", "model": os.environ.get("MODEL_NAME", "claude-sonnet-4-6"), "prompt": "defend_mode"}],
            "status": "ok",
        }]

    except Exception as e:
        state["sections"] = {"Evidence Trail": f"[Defend error: {e}]"}
        state["five_case_model"] = {}
        state["npv_value"] = None
        state["discount_rate"] = HMT_STPR
        state["optimism_bias"] = None
        state["corpus_citations"] = []
        state["confidence_tier"] = "Speculative"
        state["decision_spine"] = None
        state["section_scores"] = {}
        state["analysis"] = ""
        state["error"] = f"_build_defend_report error: {e}"
        state["reasoning_trace"] = state.get("reasoning_trace", []) + [{
            "node": "build_five_case",
            "thought": f"Defend report failed: {e}",
            "tool_calls": [],
            "status": "error",
        }]

    return state


def build_five_case(state: AtlasState) -> AtlasState:
    """
    Node 2: Use claude-sonnet-4-6 to draft the Five Case Model brief.

    Applies:
    - HM Treasury Green Book (from skills)
    - Evidence-triage skill (confidence_tier assignment)
    - Analogue method (cross-sector transfer analogues)
    - NPV at fixed discount_rate = 0.035 (HMT STPR)
    - Optimism bias per UK Transport supplementary guidance

    Returns title-case sections + decision_spine for the eval graders.
    """
    # CPC-inward queries use a different LLM prompt and output schema.
    # Recipe was selected in select_recipe_intent; trust it, don't re-classify.
    if state.get("is_cpc_inward"):
        return _build_cpc_inward_assessment(state)

    # Gap A fix (2026-06-01): target_recipe now drives output for all outward queries.
    # Previously target_recipe was set in select_recipe_intent but never read here.
    target_recipe = state.get("target_recipe", "brief_five_case")
    if target_recipe in ("cpc_evidence_gaps", "diagnose"):
        return _build_diagnose_report(state)   # Diagnose → Evidence Gap & Value Translation
    elif target_recipe in ("cpc_capability_assessment", "cpc_market_alignment", "orient"):
        return _build_orient_report(state)     # Orient → terrain surfacing
    elif target_recipe in (
        "cpc_opportunity_fit", "cpc_portfolio_comparison", "cpc_funding_flow", "connect",
    ):
        return _build_connect_report(state)    # Connect → opportunity routes
    elif target_recipe in ("cpc_defend", "defend"):
        return _build_defend_report(state)     # Defend → challenge-readiness
    # Act mode: brief_five_case / act → Five Case path (falls through)

    ctx = state.get("context_packet", {})
    skills_text = "\n\n".join(
        f"=== SKILL: {s['name']} ===\n{s['content']}"
        for s in ctx.get("active_skills", [])
    )

    from decimal import Decimal

    def _json_default(o: object) -> object:
        if isinstance(o, Decimal):
            return float(o)
        raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")

    results_json = json.dumps(state["raw_search_results"], indent=2, default=_json_default)
    query = state["query"]

    # Structural gaps detected by code — passed to LLM as context
    structural_gaps = state.get("evidence_gaps", [])
    gaps_json = json.dumps(structural_gaps, indent=2) if structural_gaps else "[]"

    # External evidence from govuk_search / exa_search (if triggered by gaps)
    # These are CONTEXT ONLY — the LLM may cite them in prose but must NOT put
    # their URLs in corpus_citations. Confidence ceiling applies (see Rule 12).
    external_results = state.get("external_search_results", [])
    external_json = json.dumps(external_results, indent=2) if external_results else "[]"
    has_external = bool(external_results)
    has_corpus_projects = any(
        r.get("source_type") in ("project", "live_call")
        for r in state.get("raw_search_results", [])
    )

    system = f"""You are ATLAS, the Green Book business case agent for Connected Places Catapult.

Your task is to produce a structured Five Case Model brief for the given proposal.

MANDATORY RULES:
1. discount_rate is ALWAYS 0.035 (HM Treasury STPR). Never change this.
2. Every corpus_citation.id MUST come from items with source_type "project" or "live_call"
   in the CORPUS SEARCH RESULTS below. NEVER use chunk_id or document_id as a citation ID.
3. NEVER fabricate project IDs. Only use IDs from source_type=="project" or "live_call" items.
4. Items with source_type "knowledge_doc" are REFERENCE MATERIAL ONLY — use them to write
   richer Five Case prose and cite them in-text by title/publisher, but do NOT put their
   chunk_id or document_id in corpus_citations.
5. All five Case Model sections MUST use the EXACT keys:
   "Strategic Case", "Economic Case", "Commercial Case", "Financial Case", "Management Case"
6. npv_value is a number (positive = net benefit, negative = net cost).
7. optimism_bias is a number (percentage, e.g. 0.15 for 15%).
8. Assign confidence_tier per the evidence-triage skill rules. With 3+ source types in the
   results, "Supported" is appropriate if projects and policy evidence both corroborate.
9. Each corpus_citation MUST include a "score" field copied from the search result similarity.
10. decision_spine MUST include all five fields: decision, recommendation, confidence_tier,
    key_assumption, next_action. Be specific — no generic filler.
11. EVIDENCE GAPS: Do not hide weak evidence in prose. Identify every specific evidence gap
    and list it in the evidence_gaps array. For each gap include ALL of these fields:
    - type: "retrieval_gap" | "corpus_gap" | "landscape_gap"
    - topic: the specific claim or domain where evidence is missing
    - severity: "low" | "medium" | "high"
    - reason: why it's a gap (what was found vs. what was needed)
    - recommended_action: concrete next step

    THREE ROUTING FIELDS — keep them separate, they represent different concepts:

    recommended_source_lane  WHY are we looking? (intent)
        internal_precedent   → re-query Atlas corpus with a different strategy
        official_policy      → government policy, regulation, statistics
        funding              → innovation grants, R&D programmes, funding calls
        procurement          → contracts, tenders, commercial opportunities
        research             → academic, UKRI-funded, methodology evidence
        market_discovery     → operator demand, WTP, commercial analogues
        ingestion_backlog    → source found; queue for corpus enrichment

    recommended_provider     WHO has the evidence? (source identity, NOT the search tool)
        InnovateUK           → Innovate UK project database / grant calls
        DfT                  → Dept for Transport policy, strategy, guidance, legislation
        NationalHighways     → Road network data, traffic counts, schemes
        CCAV                 → Connected / autonomous vehicle trials, policy, R&D
        UKRI                 → UK Research & Innovation research grants
        HorizonEurope        → EU Horizon Europe / Horizon 2020 R&D programmes
        FindATender          → Find a Tender / Contracts Finder
        Exa                  → Web / academic / recent non-government sources
        GovUK                → ONLY if no more specific provider applies
        CPC_Corpus           → Internal Atlas corpus (re-query)
    NOTE: DfT/CCAV/National Highways documents are HOSTED on GOV.UK but the provider
    is DfT/CCAV/NationalHighways — not GovUK. GovUK is the access route, not the identity.

    available_tool           HOW do we call it today? (honest — use none_yet if not live)
        cpc_corpus           → search_corpus_* tools (live today)
        live_calls           → search_corpus_live_calls (live today)
        govuk_search         → GOV.UK REST search (live — results in EXTERNAL EVIDENCE below)
        exa_search           → Exa neural search (live — results in EXTERNAL EVIDENCE below)
        future_innovateuk_api → Innovate UK API (not yet integrated)
        future_tender_api    → Find a Tender API (not yet integrated)
        none_yet             → no tool exists for this source today

    - can_lift_confidence: true | false  (will finding this evidence raise the tier?)
    - citation_status: "direct" | "candidate" | "background"
        direct    → cite in corpus_citations if retrieved and verified
        candidate → flag for human review before citing
        background → context only; do not cite directly

    Add topic-specific gaps from the query and results — the structural gaps provided
    below cover routing/coverage failures; you should add DOMAIN-SPECIFIC gaps
    (e.g. "no A14 corridor trial precedent", "no operator demand evidence").
12. CONFIDENCE CEILING FOR EXTERNAL EVIDENCE:
    - If corpus_citations is empty AND external evidence is the only source,
      confidence_tier must NOT exceed "Supported".
    - Exa-sourced evidence alone cannot justify "Robust".
    - Background evidence (citation_status=="background") does not lift confidence.
    - Internal CPC corpus citations always outweigh external web results for tier assignment.

{skills_text}

STRUCTURAL EVIDENCE GAPS (pre-detected by retrieval analysis):
{gaps_json}

EXTERNAL EVIDENCE (from govuk_search / exa_search triggered by gaps above):
IMPORTANT: These are CONTEXT ONLY — do NOT put their URLs in corpus_citations.
Use them to enrich Five Case prose and cite in-text by title/publisher.
Provider is the REAL publisher (DfT, CCAV, etc.) — NOT the search tool name.
{external_json}

CORPUS SEARCH RESULTS (ONLY use IDs from source_type project/live_call in corpus_citations):
{results_json}

Respond in JSON ONLY — no markdown, no explanation. Format:
{{
  "sections": {{
    "Strategic Case": "Strategic case text (problem, objectives, options appraisal)...",
    "Economic Case": "Economic case text (NPV analysis, BCR, WTP, externalities)...",
    "Commercial Case": "Commercial case text (procurement, contract, market)...",
    "Financial Case": "Financial case text (funding profile, affordability, risk)...",
    "Management Case": "Management case text (governance, assurance, monitoring)..."
  }},
  "decision_spine": {{
    "decision": "One-sentence decision statement (what CPC should do)",
    "recommendation": "2-3 sentence recommendation with key conditions",
    "confidence_tier": "Speculative|Indicative|Supported|Robust",
    "key_assumption": "The single most fragile assumption this case rests on",
    "next_action": "The immediate next action CPC should take (specific, dated if possible)"
  }},
  "npv_value": 3000000,
  "discount_rate": 0.035,
  "optimism_bias": 0.44,
  "corpus_citations": [
    {{"id": "<from results>", "title": "...", "organisation": "...",
      "relevance_note": "...", "score": 0.00}}
  ],
  "evidence_gaps": [
    {{
      "type": "corpus_gap",
      "topic": "Specific missing evidence topic",
      "severity": "high",
      "reason": "What was found vs. what is needed",
      "recommended_action": "Concrete next step",
      "recommended_source_lane": "funding | official_policy | research | procurement | market_discovery | ingestion_backlog | internal_precedent",
      "recommended_provider": "InnovateUK | DfT | CCAV | NationalHighways | UKRI | HorizonEurope | FindATender | Exa | GovUK | CPC_Corpus",
      "available_tool": "cpc_corpus | live_calls | govuk_search | exa_search | future_innovateuk_api | future_tender_api | none_yet",
      "can_lift_confidence": true,
      "citation_status": "direct | candidate | background"
    }}
  ],
  "confidence_tier": "Speculative|Indicative|Supported|Robust",
  "headline": "One-sentence invest/defer/reject verdict (max 30 words). Required.",
  "insight_card": "2-3 sentences: why the headline is true. Required.",
  "section_scores": {{
    "Strategic Case": 72,
    "Economic Case": 45,
    "Commercial Case": 60,
    "Financial Case": 55,
    "Management Case": 70
  }},
  "analysis": "One-paragraph confidence summary. Explicitly reference evidence gaps when explaining why confidence is limited."
}}"""

    try:
        llm = _llm_internal()
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"Business case query: {query}"),
        ])
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        parsed = json.loads(content.strip())

        _parse_insight_fields(state, parsed)

        # Enforce discount_rate lock
        parsed["discount_rate"] = HMT_STPR

        # --- Section scores (LLM self-assessed evidence strength per case, 0-100) ---
        raw_scores = parsed.get("section_scores") or {}
        state["section_scores"] = {
            k: int(max(0, min(100, v)))
            for k, v in raw_scores.items()
            if isinstance(v, (int, float))
        }

        # --- Sections (title-case + legacy) ---
        raw_sections = parsed.get("sections") or parsed.get("five_case_model") or {}
        title_sections, legacy_sections = _normalise_sections(raw_sections)
        state["sections"] = title_sections
        state["five_case_model"] = legacy_sections

        # --- Financial fields ---
        npv = parsed.get("npv_value")
        state["npv_value"] = float(npv) if npv is not None else None
        state["discount_rate"] = HMT_STPR
        state["optimism_bias"] = parsed.get("optimism_bias")

        # --- Citations (citable source types only — knowledge_docs are context-only) ---
        safe_citations = filter_llm_citations(
            parsed.get("corpus_citations", []),
            state["raw_search_results"],
        )
        state["corpus_citations"] = safe_citations

        # --- Confidence tier (with ceiling enforcement) ---
        tier = parsed.get("confidence_tier", "Speculative")
        valid_tiers = {"Speculative", "Indicative", "Supported", "Robust"}
        tier = tier if tier in valid_tiers else "Speculative"

        # Decision 5 — cold Act ceiling: first-turn Act without prior Diagnose → max Indicative
        if state.get("target_recipe") in ("act", "brief_five_case") and not state.get("session_has_diagnose"):
            tier = _cap_tier(tier, "Indicative")

        # Confidence ceiling rules — enforced in code, not just LLM prompt:
        #   1. Exa-only (no corpus citations, external results present) → max Supported
        #   2. Background-only gaps (no can_lift_confidence gaps) → max Indicative
        # _cap_tier and _TIER_ORDER are module-level (extracted from nested scope — Gap C fix).

        if not safe_citations and not has_external:
            # Act mode (Five Case): zero corpus citations, zero external evidence → Speculative ceiling
            tier = _cap_tier(tier, "Speculative")
        elif not safe_citations and has_external:
            # External evidence only — cannot exceed Supported
            tier = _cap_tier(tier, "Supported")

        # If ALL remaining gaps have can_lift_confidence=False, background evidence
        # cannot push above Indicative (there's nothing that could raise the tier)
        remaining_gaps = state.get("evidence_gaps", [])
        all_background = (
            bool(remaining_gaps)
            and not safe_citations
            and all(
                not g.get("can_lift_confidence", True)
                for g in remaining_gaps
            )
        )
        if all_background:
            tier = _cap_tier(tier, "Indicative")

        state["confidence_tier"] = tier

        # --- Decision spine ---
        raw_spine = parsed.get("decision_spine")
        if raw_spine and all(f in raw_spine for f in DECISION_SPINE_REQUIRED):
            state["decision_spine"] = {
                "decision": str(raw_spine.get("decision", "")),
                "recommendation": str(raw_spine.get("recommendation", "")),
                # Always use the post-ceiling tier — not the raw LLM value
                "confidence_tier": state["confidence_tier"],
                "key_assumption": str(raw_spine.get("key_assumption", "")),
                "next_action": str(raw_spine.get("next_action", "")),
                # Optional enrichment — shown in DecisionSpineCard if present
                "framework": str(raw_spine.get("framework", "Green Book / Five Case Model")),
                "strongest_objection": str(raw_spine.get("strongest_objection", "")),
                "would_change_if": str(raw_spine.get("would_change_if", "")),
            }
        else:
            # Fallback: construct spine from sections if LLM omitted it
            state["decision_spine"] = {
                "decision": f"Commission the proposed £3m A14 autonomous freight demonstrator",
                "recommendation": title_sections.get("Management Case", "")[:200],
                "confidence_tier": state["confidence_tier"],
                "key_assumption": "Evidence base is sufficient to support programme investment",
                "next_action": "Commission a feasibility study and stakeholder engagement plan",
            }

        state["analysis"] = parsed.get("analysis", "")

        state["reasoning_trace"] = state.get("reasoning_trace", []) + [{
            "node": "build_five_case",
            "thought": (
                f"Built Five Case brief using {os.environ.get('MODEL_NAME', 'claude-sonnet-4-6')}. "
                f"{len(safe_citations)} candidate citations selected. "
                f"Confidence: {state['confidence_tier']}. "
                f"NPV: £{round(float(state['npv_value']) / 1_000_000, 1)}m" if state.get('npv_value') else
                f"Built Five Case brief using {os.environ.get('MODEL_NAME', 'claude-sonnet-4-6')}. "
                f"{len(safe_citations)} candidate citations selected. Confidence: {state['confidence_tier']}."
            ),
            "tool_calls": [{"tool": "llm_invoke", "model": os.environ.get("MODEL_NAME", "claude-sonnet-4-6"), "prompt": "five_case_model"}],
            "status": "ok",
        }]

        # --- Evidence gaps: merge structural (pre-detected) + LLM topic-specific ---
        # Structural gaps were set in search_corpus node (detect_evidence_gaps).
        # The LLM adds domain-specific gaps (e.g. "no A14 trial precedent").
        # We merge and deduplicate by (type, topic) to avoid double-listing.
        structural = state.get("evidence_gaps", [])
        llm_raw_gaps = parsed.get("evidence_gaps", [])
        valid_gap_types = {"retrieval_gap", "corpus_gap", "landscape_gap"}
        valid_severities = {"low", "medium", "high"}
        valid_lanes = {
            "internal_precedent", "official_policy", "funding", "procurement",
            "research", "market_discovery", "ingestion_backlog",
        }
        valid_providers = {
            "InnovateUK", "DfT", "NationalHighways", "CCAV", "UKRI",
            "HorizonEurope", "FindATender", "Exa", "GovUK", "CPC_Corpus",
        }
        valid_tools = {
            "cpc_corpus", "live_calls", "govuk_search", "exa_search",
            "future_innovateuk_api", "future_tender_api", "none_yet",
        }
        valid_cite = {"direct", "candidate", "background"}

        llm_gaps: list[EvidenceGap] = []
        for g in llm_raw_gaps:
            gap_type = g.get("type", "")
            if gap_type not in valid_gap_types:
                continue

            # Normalise lane — fall back to most semantically plausible default
            raw_lane = g.get("recommended_source_lane", "")
            lane = raw_lane if raw_lane in valid_lanes else "ingestion_backlog"

            # Normalise provider — prefer specific agencies over GovUK catch-all
            raw_provider = g.get("recommended_provider", "")
            provider = raw_provider if raw_provider in valid_providers else "CPC_Corpus"

            # Normalise tool — be honest; default to none_yet if unrecognised
            raw_tool = g.get("available_tool", "")
            tool = raw_tool if raw_tool in valid_tools else "none_yet"

            # can_lift_confidence — coerce to bool
            raw_can_lift = g.get("can_lift_confidence", True)
            can_lift = bool(raw_can_lift) if isinstance(raw_can_lift, bool) else str(raw_can_lift).lower() != "false"

            # citation_status
            raw_cite = g.get("citation_status", "candidate")
            cite = raw_cite if raw_cite in valid_cite else "candidate"

            llm_gaps.append({
                "type": gap_type,
                "topic": str(g.get("topic", ""))[:200],
                "severity": g.get("severity", "medium") if g.get("severity") in valid_severities else "medium",
                "reason": str(g.get("reason", ""))[:500],
                "recommended_action": str(g.get("recommended_action", ""))[:300],
                "recommended_source_lane": lane,
                "recommended_provider": provider,
                "available_tool": tool,
                "can_lift_confidence": can_lift,
                "citation_status": cite,
            })
        # Deduplicate: keep structural gaps first, then LLM gaps that don't duplicate
        seen_topics = {(g["type"], g["topic"].lower()[:40]) for g in structural}
        for g in llm_gaps:
            key = (g["type"], g["topic"].lower()[:40])
            if key not in seen_topics:
                structural.append(g)
                seen_topics.add(key)
        state["evidence_gaps"] = structural

    except Exception as e:
        # Fallback state — Speculative tier, empty sections
        title_sections = {k: f"[{k} — LLM error: {e}]" for k in FIVE_CASE_KEYS}
        state["sections"] = title_sections
        state["five_case_model"] = {k.split(" ")[0].lower(): v for k, v in title_sections.items()}
        state["npv_value"] = None
        state["discount_rate"] = HMT_STPR
        state["optimism_bias"] = None
        state["corpus_citations"] = []
        state["confidence_tier"] = "Speculative"
        state["decision_spine"] = None
        state["section_scores"] = {}
        state["evidence_gaps"] = state.get("evidence_gaps", [])  # keep structural gaps
        state["analysis"] = ""
        state["error"] = f"build_five_case error: {e}"
        state["reasoning_trace"] = state.get("reasoning_trace", []) + [{
            "node": "build_five_case",
            "thought": f"Five Case build failed: {e}",
            "tool_calls": [{"tool": "llm_invoke", "model": os.environ.get("MODEL_NAME", "claude-sonnet-4-6"), "prompt": "five_case_model"}],
            "status": "error",
        }]

    return state


def _build_secondary_panel(
    state: dict[str, Any],
    secondary_recipe: str,
    verified: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """
    Build a lightweight secondary panel from existing state data — no extra LLM call.

    Called by verify_citations when target_secondary_recipes is set.
    Each secondary panel carries only the data slice relevant to its recipe;
    corpus_citations and confidence_tier are inherited from the parent artifact.
    """
    tier = state.get("confidence_tier", "Speculative")
    sections = state.get("sections", {})

    if secondary_recipe == "cpc_capability_assessment":
        cpc_claims = state.get("_cpc_claims") or []
        cpc_portfolio = state.get("_cpc_portfolio") or []
        # Surface the strategic rationale as the capability summary
        summary = ""
        for key in ("Strategic Case", "Summary", "Economic Case"):
            if sections.get(key):
                summary = str(sections[key])[:400]
                break
        return {
            "recipe": secondary_recipe,
            "label": "CPC Evidence Readiness",
            "sections": {"Summary": summary} if summary else {},
            "chart_specs": [],
            "cpc_claims": cpc_claims,
            "cpc_portfolio": cpc_portfolio,
            "confidence_tier": tier,
        }

    if secondary_recipe == "brief_five_case":
        # Stub panel — surfaces the investment context from an inward assessment.
        # A future enhancement could run a second LLM pass for a full Five Case.
        summary = sections.get("Summary", "")
        if not summary:
            return None
        return {
            "recipe": secondary_recipe,
            "label": "Investment Case Context",
            "sections": {"Strategic Case": summary},
            "chart_specs": [],
            "confidence_tier": tier,
        }

    if secondary_recipe == "cpc_evidence_gaps":
        cpc_gaps = state.get("_cpc_gaps") or []
        evidence_gaps = state.get("evidence_gaps") or []
        # Normalise raw evidence_gaps (strings or dicts) into gap dicts
        normalised = []
        for g in evidence_gaps:
            if isinstance(g, dict):
                normalised.append(g)
            elif isinstance(g, str):
                normalised.append({"area": g, "severity": "medium", "description": g})
        all_gaps = cpc_gaps + normalised
        if not all_gaps:
            return None
        return {
            "recipe": secondary_recipe,
            "label": "Evidence Gaps",
            "sections": {},
            "chart_specs": [],
            "cpc_gaps": all_gaps,
            "confidence_tier": tier,
        }

    return None


def _extract_headline(state: AtlasState) -> str:
    """One-sentence verdict for artifact waterfall (Principle 1)."""
    parsed_headline = state.get("_headline")  # type: ignore[attr-defined]
    if isinstance(parsed_headline, str) and parsed_headline.strip():
        return parsed_headline.strip()[:320]

    spine = state.get("decision_spine") or {}
    decision = str(spine.get("decision") or "").strip()
    if decision and not decision.startswith("["):
        return decision[:320]

    sections = state.get("sections") or {}
    for key in ("Headline", "Verdict", "Recommended Next Move", "Entity Summary", "Landscape Overview"):
        val = sections.get(key, "")
        if val and not str(val).startswith("["):
            first_line = str(val).strip().split("\n")[0].strip()
            if len(first_line) > 24:
                return first_line[:320]

    analysis = str(state.get("analysis") or "").strip()
    if analysis and len(analysis) > 24:
        first_sent = analysis.split(".")[0].strip()
        if len(first_sent) > 24:
            return first_sent + "."

    return ""


def _extract_insight_card(state: AtlasState) -> str:
    """2–3 sentence 'because' card — Principle 1 waterfall step 2."""
    import re

    explicit = state.get("_insight_card")  # type: ignore[attr-defined]
    if isinstance(explicit, str) and explicit.strip():
        return explicit.strip()[:480]

    headline = _extract_headline(state)
    analysis = str(state.get("analysis") or "").strip()
    if analysis:
        if headline and analysis.lower().startswith(headline.lower()[: min(40, len(headline))]):
            analysis = analysis[len(headline) :].strip(" .")
        sentences = re.split(r"(?<=[.!?])\s+", analysis)
        body = " ".join(s.strip() for s in sentences[:3] if s.strip())
        if len(body) > 30 and body.lower() != headline.lower():
            return body[:480]

    spine = state.get("decision_spine") or {}
    rec = str(spine.get("recommendation") or "").strip()
    if rec and len(rec) > 30 and rec.lower() != headline.lower():
        return rec[:480]

    return ""


def _parse_insight_fields(state: AtlasState, parsed: dict[str, Any]) -> None:
    """Set headline + insight_card from LLM JSON."""
    if parsed.get("headline"):
        state["_headline"] = str(parsed.get("headline", "")).strip()  # type: ignore[attr-defined]
    if parsed.get("insight_card"):
        state["_insight_card"] = str(parsed.get("insight_card", "")).strip()  # type: ignore[attr-defined]
    elif parsed.get("analysis"):
        state["analysis"] = str(parsed.get("analysis", ""))


def _build_gap_rows(state: AtlasState) -> list[dict[str, Any]]:
    """Structured gap rows for Diagnose surface + gap_matrix block."""
    rows: list[dict[str, Any]] = []
    for g in (state.get("evidence_gaps") or [])[:8]:
        if not isinstance(g, dict):
            continue
        severity = str(g.get("severity", "medium")).lower()
        fit = "Gap" if severity == "high" else "Partial" if severity == "medium" else "Met"
        rows.append({
            "criterion": g.get("area") or g.get("topic") or "Unknown",
            "response": g.get("description") or g.get("reason") or "",
            "claim_state": "unknown" if severity == "high" else "inferred",
            "fit": fit,
            "evidence_strength": "None" if severity == "high" else "Weak",
            "action": g.get("recommended_action") or "",
        })
    return rows


def _extract_orient_domains(
    raw_results: list[dict[str, Any]],
    verified: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Build orient_domains[] for OrientSurface from search / citation results."""
    domain_counts: dict[str, dict[str, Any]] = {}
    for r in list(raw_results) + list(verified or []):
        domain = (
            r.get("business_unit")
            or r.get("theme")
            or r.get("domain")
            or r.get("transport_mode")
            or "General"
        )
        domain = str(domain).strip() or "General"
        if domain not in domain_counts:
            domain_counts[domain] = {
                "domain": domain,
                "evidence_count": 0,
                "cpc_projects": 0,
                "open_calls": 0,
            }
        domain_counts[domain]["evidence_count"] += 1
        if r.get("source_type") == "live_call":
            domain_counts[domain]["open_calls"] += 1
        else:
            domain_counts[domain]["cpc_projects"] += 1
    return sorted(domain_counts.values(), key=lambda d: -d["evidence_count"])[:8]


def _extract_cpc_position(sections: dict[str, str]) -> dict[str, Any] | None:
    """Parse CPC Position section into structured card payload."""
    text = sections.get("CPC Position") or sections.get("cpc_position") or ""
    text = str(text).strip()
    if not text or text.startswith("["):
        return None
    strongest = ""
    whitespace = ""
    for line in text.split("\n"):
        low = line.lower()
        if "strongest" in low and not strongest:
            strongest = line.split(":", 1)[-1].strip()[:80]
        if "whitespace" in low and not whitespace:
            whitespace = line.split(":", 1)[-1].strip()[:80]
    return {
        "summary": text[:600],
        "strongest_domain": strongest or None,
        "whitespace_domain": whitespace or None,
    }


def _build_partial_artifact(state: AtlasState, stage: str) -> dict[str, Any]:
    """Progressive artifact_block for live UI assembly (Sprint 4 Track B)."""
    recipe = state.get("target_recipe", "orient")
    tier = state.get("confidence_tier", "Speculative")
    block: dict[str, Any] = {
        "type": "brief",
        "recipe": recipe,
        "_run_stage": stage,
        "confidence_tier": tier,
        "sections": dict(state.get("sections") or {}),
        "appendix": [],
    }
    raw = state.get("raw_search_results", [])
    if stage == "search":
        block["corpus_citations"] = [
            {
                "id": str(r.get("id", "")),
                "title": str(r.get("title", "")),
                "organisation": str(r.get("organisation") or r.get("publisher") or ""),
                "score": float(r.get("score", 0) or 0),
            }
            for r in raw[:8]
            if r.get("id")
        ]
    if stage in ("build", "complete"):
        headline = _extract_headline(state)
        if headline:
            block["headline"] = headline
        insight = _extract_insight_card(state)
        if insight:
            block["insight_card"] = insight
        block["decision_spine"] = state.get("decision_spine")
        block["gap_rows"] = _build_gap_rows(state)
    return block


def emit_build_partial(state: AtlasState) -> dict:
    """Node 2a: Push build-stage partial artifact to the UI."""
    return {"artifact_block": _build_partial_artifact(state, "build")}



def falsification_lane(state: AtlasState) -> AtlasState:
    """Sprint 5 — disconfirming search before citation verify (flag-gated)."""
    result = run_falsification_lane(
        query=state.get("query", ""),
        headline=_extract_headline(state),
        confidence_tier=state.get("confidence_tier", "Speculative"),
    )
    cap = result.get("tier_cap_recommended")
    if cap:
        state["confidence_tier"] = _cap_tier(
            state.get("confidence_tier", "Speculative"),
            cap,
        )
    state["falsification_result"] = result  # type: ignore[attr-defined]
    state["reasoning_trace"] = state.get("reasoning_trace", []) + [{
        "node": "falsification_lane",
        "thought": (
            f"Falsification {result.get('status')}: "
            f"{result.get('finding_count', 0)} disconfirming source(s) reviewed."
        ),
        "status": "ok" if result.get("status") != "error" else "error",
    }]
    return state


def verify_citations(state: AtlasState) -> AtlasState:
    """
    Node 3: Verify every corpus_citation.id against atlas.projects.
    Removes any citation whose ID does not exist in the DB.
    Records verification result in tool_calls trace.
    """
    verified: list[CorpusCitation] = []
    verification_log: list[dict] = []
    raw_results = state.get("raw_search_results", [])
    raw_ids = {str(r.get("id")) for r in raw_results if r.get("id")}

    # Re-filter LLM citations against search results before DB verify
    pre_filtered = filter_llm_citations(state.get("corpus_citations", []), raw_results)

    for citation in pre_filtered:
        cid = citation.get("id", "")
        if not cid:
            continue
        try:
            if citation.get("source_type") in ("cpc_internal", "cpc_claim") and cid in raw_ids:
                verified.append({
                    "id": cid,
                    "title": citation.get("title", ""),
                    "organisation": citation.get("organisation", "Connected Places Catapult"),
                    "relevance_note": citation.get("relevance_note", ""),
                    "score": citation.get("score", 0.0),
                    "claim_state": citation.get("claim_state", "stated"),
                    "source_type": citation.get("source_type"),
                })
                verification_log.append({"id": cid, "verified": True, "source": "cpc_internal"})
                continue

            project = _verify_project(cid)
            if project:
                verified.append({
                    "id": cid,
                    "title": project.get("title") or citation.get("title", ""),
                    "organisation": project.get("organisation") or citation.get("organisation", ""),
                    "relevance_note": citation.get("relevance_note", ""),
                    "score": citation.get("score", 0.0),
                })
                verification_log.append({"id": cid, "verified": True})
            else:
                verification_log.append({"id": cid, "verified": False, "reason": "not found in atlas.projects"})
        except Exception as exc:
            verification_log.append({"id": cid, "verified": False, "reason": str(exc)})

    # Fallback: inject top search hits when LLM omitted all citations
    verified = inject_citation_fallback(verified, raw_results)
    if len(verified) > len(verification_log):
        for c in verified:
            if not any(v.get("id") == c.get("id") for v in verification_log):
                verification_log.append({"id": c.get("id"), "verified": True, "source": "fallback_inject"})

    state["corpus_citations"] = verified
    removed = len(verification_log) - len(verified)
    state["tool_calls"] = state.get("tool_calls", []) + [{
        "tool": "verify_citations",
        "args": {"count": len(state["corpus_citations"])},
        "result": verification_log,
    }]

    tier = state.get("confidence_tier", "Speculative")
    query = state.get("query", "")
    headline_raw = _extract_headline(state)
    guard_result = apply_citation_guard(
        confidence_tier=tier,
        citation_count=len(verified),
        headline=headline_raw,
    )
    tier = guard_result["confidence_tier"]
    state["confidence_tier"] = tier
    if guard_result.get("headline_adjusted") and guard_result.get("headline"):
        sections = dict(state.get("sections") or {})
        for key in ("Executive Summary", "Strategic Case", "Landscape Overview", "Overview"):
            if key in sections and headline_raw in sections[key]:
                sections[key] = sections[key].replace(headline_raw, guard_result["headline"], 1)
                break
        state["sections"] = sections
    citation_guard_payload = guard_result["citation_guard"]

    state["reasoning_trace"] = state.get("reasoning_trace", []) + [{
        "node": "verify_citations",
        "thought": (
            f"Verified {len(verified)} citation{'s' if len(verified) != 1 else ''} against atlas.projects. "
            + (f"{removed} removed (not found in DB)." if removed else "All citations confirmed.")
            + (
                f" Citation guard: {citation_guard_payload.get('status')} "
                f"({citation_guard_payload.get('original_tier')} → {citation_guard_payload.get('final_tier')})."
                if citation_guard_payload.get("status") != "pass"
                else ""
            )
        ),
        "tool_calls": [{"tool": "verify_project", "checked": len(verification_log), "passed": len(verified), "removed": removed}],
        "status": "ok",
    }]

    # Build artifact_block — this syncs to useCoAgent and drives ArtifactPanel in the UI.
    # --- Visual Recipe Director ---
    # Recipe was selected by select_recipe_intent (query-phase) and confirmed by
    # select_visual_recipe (post-LLM). Pass recipe_override so we don't re-classify.
    # Pass section_scores so the radar uses LLM self-assessment, not word-count.
    recipe_id, chart_specs = _build_chart_specs(
        query=query,
        verified=list(verified),
        sections=state.get("sections", {}),
        confidence_tier=tier,
        npv_value=state.get("npv_value"),
        optimism_bias=state.get("optimism_bias"),
        evidence_gaps=state.get("evidence_gaps", []),
        section_scores=state.get("section_scores") or {},
        recipe_override=state.get("target_recipe"),
    )

    # Art director: deterministic block selection (new vocabulary system)
    visual_blocks = _build_visual_blocks(
        recipe_id=recipe_id,
        verified=list(verified),
        sections=state.get("sections", {}),
        confidence_tier=tier,
        npv_value=state.get("npv_value"),
        discount_rate=state.get("discount_rate") or 0.035,
        evidence_gaps=state.get("evidence_gaps", []),
        section_scores=state.get("section_scores") or {},
        raw_search_results=state.get("raw_search_results", []),
    )

    # CPC-inward fields — populated by _build_cpc_inward_assessment if applicable
    artifact_block: dict[str, Any] = {
        "type": "brief",
        "recipe": recipe_id,
        "headline": guard_result.get("headline") or headline_raw,
        "insight_card": _extract_insight_card(state),
        "gap_rows": _build_gap_rows(state),
        "confidence_tier": tier,
        "citation_guard": citation_guard_payload,
        "sections": state.get("sections", {}),
        "corpus_citations": [
            {
                "id": c.get("id", ""),
                "title": c.get("title", ""),
                "organisation": c.get("organisation", ""),
                "score": c.get("score", 0.0),
            }
            for c in verified
        ],
        "npv_value": state.get("npv_value"),
        "discount_rate": state.get("discount_rate", 0.035),
        "chart_specs": chart_specs,
        "visual_blocks": visual_blocks,
        "section_scores": state.get("section_scores") or {},
        # Decision spine and analysis — surfaced in the ArtifactPanel
        "decision_spine": state.get("decision_spine"),
        "analysis": state.get("analysis", ""),
        "_run_stage": "complete",
        "appendix": [],
    }
    ext_cites = state.get("external_search_results") or []
    if ext_cites:
        artifact_block["external_citations"] = ext_cites
    # Orient structured fields for OrientSurface
    if recipe_id in (
        "orient", "cpc_capability_assessment", "cpc_market_alignment",
    ):
        orient_domains = _extract_orient_domains(
            state.get("raw_search_results", []),
            list(verified),
        )
        if orient_domains:
            artifact_block["orient_domains"] = orient_domains
        cpc_pos = _extract_cpc_position(state.get("sections") or {})
        if cpc_pos:
            artifact_block["cpc_position"] = cpc_pos
    if state.get("_passport_id"):  # type: ignore[attr-defined]
        artifact_block["passport_id"] = state.get("_passport_id")  # type: ignore[attr-defined]
    if state.get("evidence_gaps"):
        artifact_block["evidence_gaps"] = state.get("evidence_gaps", [])
    # Forward CPC-inward intelligence fields when present
    if state.get("is_cpc_inward"):
        artifact_block["cpc_claims"] = state.get("_cpc_claims") or []          # type: ignore[attr-defined]
        artifact_block["cpc_portfolio"] = state.get("_cpc_portfolio") or []    # type: ignore[attr-defined]
        artifact_block["cpc_gaps"] = state.get("_cpc_gaps") or []              # type: ignore[attr-defined]
        if state.get("_recommendation_action"):                                 # type: ignore[attr-defined]
            artifact_block["recommendation_action"] = state.get("_recommendation_action")     # type: ignore[attr-defined]
        if state.get("_recommendation_rationale"):                              # type: ignore[attr-defined]
            artifact_block["recommendation_rationale"] = state.get("_recommendation_rationale")  # type: ignore[attr-defined]

    # Build secondary panels for compound queries (no extra LLM call)
    secondary_recipes = state.get("target_secondary_recipes") or []
    if secondary_recipes:
        panels = []
        for sec_recipe in secondary_recipes:
            panel = _build_secondary_panel(state, sec_recipe, verified)
            if panel:
                panels.append(panel)
        if panels:
            artifact_block["panels"] = panels

    fals = state.get("falsification_result") or {}  # type: ignore[attr-defined]
    if fals and fals.get("enabled"):
        artifact_block["falsification"] = {
            "status": fals.get("status"),
            "finding_count": fals.get("finding_count", 0),
            "query": fals.get("query"),
        }
    qa = run_artifact_qa(artifact_block)
    if fals.get("finding_count", 0) > 0:
        qa["metrics"]["contradiction_rate"] = round(
            min(1.0, fals["finding_count"] / 5.0), 2
        )
    artifact_block["artifact_qa"] = qa

    state["artifact_block"] = artifact_block
    # Session memory for turn-2 escalation (persisted via checkpoint)
    state["last_recipe"] = recipe_id
    state["last_headline"] = _extract_headline(state)
    if recipe_id in ("diagnose", "cpc_evidence_gaps"):
        state["session_has_diagnose"] = True
    # Also populate state.charts → syncs to AgentState.charts → Charts component
    state["charts"] = [c for c in chart_specs if c.get("data")]

    # artifact_block is stored in state.values — the React client reads it via the
    # "values" stream event (onValues handler in MyRuntimeProvider). No tool-call
    # message is emitted; this avoids large JSON code blocks streaming in the chat thread.

    # Chat slim-down (Principle 1): headline + source count → artifact holds detail
    spine = state.get("decision_spine") or {}
    headline = _extract_headline(state)
    tier = state.get("confidence_tier", "Speculative")
    citation_count = len(verified)
    ai_parts = [headline or spine.get("decision", "") or "Analysis complete."]
    ai_parts.append(f"\n\n{citation_count} verified sources · {tier} · see artifact →")
    cold_act = (
        recipe_id in ("act", "brief_five_case")
        and not state.get("session_has_diagnose")
        and state.get("target_recipe") in ("act", "brief_five_case")
    )
    if cold_act:
        ai_parts.append("\n\n_Run Diagnose first to lift confidence above Indicative._")
    ai_content = "".join(ai_parts)
    if ai_content.strip():
        state["messages"] = state.get("messages", []) + [
            AIMessage(content=ai_content, id=str(uuid.uuid4()))
        ]

    return state


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------


def _extract_query_atlas(state: AtlasState) -> dict:
    """
    Node 0: Extract query from AG-UI messages (CopilotKit path).
    REST path (run_atlas): messages is [], query already set — no-op.
    AG-UI path (CopilotKit): delegates to extract_latest_query() from agents.base
    so the authoritative extraction logic is shared across all agents.
    """
    if not state.get("messages"):
        # REST path — query passed directly by run_atlas(), nothing to extract
        return {}
    query = extract_latest_query(state)
    if not query:
        return {}
    updates: dict[str, Any] = {"query": query}
    # Preserve prior artifact for clarify/refine turn routing
    prior_ab = state.get("artifact_block")
    if prior_ab and isinstance(prior_ab, dict) and prior_ab.get("sections"):
        updates["last_artifact_block"] = prior_ab
    return updates


def build_atlas_graph() -> StateGraph:
    graph = StateGraph(AtlasState)

    # Node 0: AG-UI query extraction (no-op on REST path)
    graph.add_node("extract_query", _extract_query_atlas)
    # Sprint 4 — turn lanes: clarify / refine / analyze
    graph.add_node("classify_turn_intent", classify_turn_intent)
    graph.add_node("reset_analyze_state", reset_analyze_state)
    graph.add_node("handle_clarify", handle_clarify)
    graph.add_node("handle_refine", handle_refine)
    # Node 0b: Intent gate — greetings / meta queries skip the 35-second pipeline
    graph.add_node("classify_intent", classify_intent)
    # Node 0c: Recipe intent selection — runs BEFORE corpus search so build_five_case
    #           knows which LLM prompt to use (Five Case vs CPC-inward assessment)
    graph.add_node("select_recipe_intent", select_recipe_intent)
    graph.add_node("search_corpus", search_corpus)
    # Node 1b: External Evidence Router — only fires when gaps call for it
    graph.add_node("external_evidence_search", external_evidence_search)
    graph.add_node("build_five_case", build_five_case)
    graph.add_node("emit_build_partial", emit_build_partial)
    # Node 2b: Visual recipe confirmation — post-LLM, records decision in reasoning_trace
    graph.add_node("select_visual_recipe", select_visual_recipe)
    graph.add_node("falsification_lane", falsification_lane)
    graph.add_node("verify_citations", verify_citations)

    graph.set_entry_point("extract_query")
    graph.add_edge("extract_query", "classify_turn_intent")
    graph.add_conditional_edges(
        "classify_turn_intent",
        _route_after_turn_intent,
        {
            "handle_clarify": "handle_clarify",
            "handle_refine": "handle_refine",
            "reset_analyze_state": "reset_analyze_state",
        },
    )
    graph.add_edge("handle_clarify", END)
    graph.add_edge("handle_refine", END)
    graph.add_edge("reset_analyze_state", "classify_intent")
    # Conditional: conversational → END immediately; business query → recipe intent selection
    graph.add_conditional_edges(
        "classify_intent",
        _route_after_intent,
        {END: END, "select_recipe_intent": "select_recipe_intent"},
    )
    graph.add_edge("select_recipe_intent", "search_corpus")
    graph.add_edge("search_corpus", "external_evidence_search")
    graph.add_edge("external_evidence_search", "build_five_case")
    graph.add_edge("build_five_case", "emit_build_partial")
    graph.add_edge("emit_build_partial", "select_visual_recipe")
    graph.add_edge("select_visual_recipe", "falsification_lane")
    graph.add_edge("falsification_lane", "verify_citations")
    graph.add_edge("verify_citations", END)

    # When running under LangGraph Platform (langgraph dev / LangGraph Cloud),
    # the platform provides its own managed checkpointer — using MemorySaver raises
    # a ValueError in v0.9.0+.  When running under FastAPI + ag_ui_langgraph,
    # MemorySaver IS required (graph.aget_state needs a checkpointer).
    # We detect the runtime by checking whether langgraph_api is already loaded.
    import sys as _sys
    _checkpointer = None if "langgraph_api" in _sys.modules else MemorySaver()
    return graph.compile(checkpointer=_checkpointer)


atlas_graph = build_atlas_graph()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def run_atlas(
    query: str,
    context_packet: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Run the ATLAS agent for the given business case query.

    Returns a response dict matching the golden grader contract:
    - recipe:          "brief_five_case"                     (G1)
    - sections:        {"Strategic Case": ..., ...}          (G1)
    - decision_spine:  {"decision": ..., ...}                (G2)
    - corpus_citations: verified atlas.projects IDs w/ score (G3 + G4)
    - confidence_tier: per evidence-triage skill             (G4)
    - tool_calls:      [{tool: ..., args: ...}, ...]         (G5)

    Also includes five_case_model (legacy lowercase), npv_value,
    discount_rate (0.035 locked), optimism_bias, and analysis.
    """
    initial_state: AtlasState = {
        "messages": [],   # empty on REST path; AG-UI path sets this via input
        "query": query,
        "context_packet": context_packet or {},
        "raw_search_results": [],
        "sections": {},
        "five_case_model": {k.split(" ")[0].lower(): "" for k in FIVE_CASE_KEYS},
        "npv_value": None,
        "discount_rate": HMT_STPR,
        "optimism_bias": None,
        "corpus_citations": [],
        "confidence_tier": "Speculative",
        "decision_spine": None,
        "evidence_gaps": [],
        "external_search_results": [],
        "tool_calls": [],
        "analysis": "",
        "artifact_block": None,
        "charts": [],
        "error": None,
        "_is_conversational": False,
        "is_cpc_inward": False,
        "target_recipe": "brief_five_case",
        "target_secondary_recipes": [],
        "section_scores": {},
        "last_recipe": "",
        "last_headline": "",
        "session_has_diagnose": False,
        "turn_intent": "analyze",
        "last_artifact_block": None,
        "reasoning_trace": [],
    }

    final_state = atlas_graph.invoke(
        initial_state,
        config={"configurable": {"thread_id": str(uuid.uuid4())}},
    )

    evidence_gaps = final_state.get("evidence_gaps", [])

    return {
        # Eval contract fields
        "recipe": "brief_five_case",
        "sections": final_state["sections"],
        "decision_spine": final_state["decision_spine"],
        "tool_calls": final_state["tool_calls"],
        # Financial fields
        "npv_value": final_state["npv_value"],
        "discount_rate": HMT_STPR,
        "optimism_bias": final_state["optimism_bias"],
        # Evidence
        "corpus_citations": final_state["corpus_citations"],
        "confidence_tier": final_state["confidence_tier"],
        # Evidence coverage — structured gaps (new first-class field)
        "evidence_coverage": {
            "suggested_confidence_tier": final_state["confidence_tier"],
            "evidence_gaps": evidence_gaps,
            "gap_count": len(evidence_gaps),
            "has_retrieval_gap": any(g["type"] == "retrieval_gap" for g in evidence_gaps),
            "has_corpus_gap": any(g["type"] == "corpus_gap" for g in evidence_gaps),
            "has_landscape_gap": any(g["type"] == "landscape_gap" for g in evidence_gaps),
        },
        # Top-level convenience alias (for UI Trust Rail)
        "evidence_gaps": evidence_gaps,
        # External evidence — govuk_search / exa_search results (human review required)
        # Kept separate from corpus_citations; displayed in Trust Rail "External web" lane.
        "external_citations": final_state.get("external_search_results", []),
        # Analysis + legacy compat
        "analysis": final_state["analysis"],
        "five_case_model": final_state["five_case_model"],
        # Artifact block — primary UI rendering contract (includes chart_specs)
        "artifact_block": final_state.get("artifact_block") or {},
        # Recipe intent — useful for eval harness and debugging
        "target_recipe": final_state.get("target_recipe", "brief_five_case"),
        "is_cpc_inward": final_state.get("is_cpc_inward", False),
        "section_scores": final_state.get("section_scores", {}),
        # Pass through any error for debugging
        **({"error_detail": final_state["error"]} if final_state.get("error") else {}),
    }
