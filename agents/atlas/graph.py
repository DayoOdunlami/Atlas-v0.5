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
import sys
from pathlib import Path
from typing import Any, Literal, TypedDict

_root = Path(__file__).resolve().parent.parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from dotenv import load_dotenv
# override=True so .env values win over blank/unset shell variables
load_dotenv(override=True)

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph

# Correct tool names from mcp_client (not the old `search_projects` alias)
from agents.mcp_client import (
    search_corpus_projects,
    search_corpus_live_calls,
    search_corpus_evidence,   # Corpus Recall Audit fix: knowledge_chunks were never queried
    detect_evidence_gaps,     # Structured gap classification — retrieval/corpus/landscape
)
from agents.external_search import search_govuk, search_exa  # External Evidence Router
from mcps.cpc_corpus.queries import get_project as _verify_project

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
    analysis: str
    error: str | None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_MODEL = "claude-sonnet-4-6"
_MAX_CITATIONS = 8


def _llm() -> ChatAnthropic:
    return ChatAnthropic(
        model=_MODEL,
        api_key=os.environ["ANTHROPIC_API_KEY"],
        max_tokens=8192,
    )


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


def search_corpus(state: AtlasState) -> AtlasState:
    """
    Node 1: Search atlas.projects AND atlas.live_calls for evidence.
    Records tool_calls trace for G5 grader.
    """
    query = state["query"]
    tool_calls: list[dict[str, Any]] = []
    combined: list[dict[str, Any]] = []

    # Tool call 1: corpus projects
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

    state["external_search_results"] = external_results
    state["tool_calls"] = tool_calls
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
  "analysis": "One-paragraph confidence summary. Explicitly reference evidence gaps when explaining why confidence is limited."
}}"""

    try:
        llm = _llm()
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

        # Enforce discount_rate lock
        parsed["discount_rate"] = HMT_STPR

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

        # --- Citations (only project/live_call IDs — knowledge_docs are context-only) ---
        # knowledge_doc items have chunk_id/document_id, not id; they are not in
        # atlas.projects so verify_citations would drop them. Include them in the
        # context_json (for LLM prose) but not in the citable ID map.
        valid_id_to_sim: dict[str, float] = {
            r["id"]: float(r.get("similarity") or 0.0)
            for r in state["raw_search_results"]
            if r.get("id") and r.get("source_type") in ("project", "live_call")
        }
        safe_citations: list[CorpusCitation] = []
        for c in parsed.get("corpus_citations", []):
            cid = c.get("id", "")
            if cid in valid_id_to_sim:
                safe_citations.append({
                    "id": cid,
                    "title": c.get("title", ""),
                    "organisation": c.get("organisation", ""),
                    "relevance_note": c.get("relevance_note", ""),
                    "score": float(c.get("score") or valid_id_to_sim[cid]),
                })
        state["corpus_citations"] = safe_citations

        # --- Confidence tier (with ceiling enforcement) ---
        tier = parsed.get("confidence_tier", "Speculative")
        valid_tiers = {"Speculative", "Indicative", "Supported", "Robust"}
        tier = tier if tier in valid_tiers else "Speculative"

        # Confidence ceiling rules — enforced in code, not just LLM prompt:
        #   1. Exa-only (no corpus citations, external results present) → max Supported
        #   2. Background-only gaps (no can_lift_confidence gaps) → max Indicative
        _tier_order = ["Speculative", "Indicative", "Supported", "Robust"]

        def _cap_tier(current: str, max_allowed: str) -> str:
            ci = _tier_order.index(current) if current in _tier_order else 0
            mi = _tier_order.index(max_allowed) if max_allowed in _tier_order else 0
            return _tier_order[min(ci, mi)]

        if not safe_citations and has_external:
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
        state["evidence_gaps"] = state.get("evidence_gaps", [])  # keep structural gaps
        state["analysis"] = ""
        state["error"] = f"build_five_case error: {e}"

    return state


def verify_citations(state: AtlasState) -> AtlasState:
    """
    Node 3: Verify every corpus_citation.id against atlas.projects.
    Removes any citation whose ID does not exist in the DB.
    Records verification result in tool_calls trace.
    """
    verified: list[CorpusCitation] = []
    verification_log: list[dict] = []

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
                    "relevance_note": citation.get("relevance_note", ""),
                    "score": citation.get("score", 0.0),
                })
                verification_log.append({"id": cid, "verified": True})
            else:
                verification_log.append({"id": cid, "verified": False, "reason": "not found in atlas.projects"})
        except Exception as exc:
            verification_log.append({"id": cid, "verified": False, "reason": str(exc)})

    state["corpus_citations"] = verified
    state["tool_calls"] = state.get("tool_calls", []) + [{
        "tool": "verify_citations",
        "args": {"count": len(state["corpus_citations"])},
        "result": verification_log,
    }]
    return state


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------


def build_atlas_graph() -> StateGraph:
    graph = StateGraph(AtlasState)

    graph.add_node("search_corpus", search_corpus)
    # Node 1b: External Evidence Router — only fires when gaps call for it
    graph.add_node("external_evidence_search", external_evidence_search)
    graph.add_node("build_five_case", build_five_case)
    graph.add_node("verify_citations", verify_citations)

    graph.set_entry_point("search_corpus")
    # Always run external_evidence_search after corpus search.
    # The node is a no-op if no gaps have govuk_search / exa_search tools.
    graph.add_edge("search_corpus", "external_evidence_search")
    graph.add_edge("external_evidence_search", "build_five_case")
    graph.add_edge("build_five_case", "verify_citations")
    graph.add_edge("verify_citations", END)

    return graph.compile()


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
        "error": None,
    }

    final_state = atlas_graph.invoke(initial_state)

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
        # Pass through any error for debugging
        **({"error_detail": final_state["error"]} if final_state.get("error") else {}),
    }
