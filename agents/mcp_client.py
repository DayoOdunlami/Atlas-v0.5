"""
Atlas 5 — MCP client wrapper for the CPC-corpus MCP server.

Agents call corpus tools via this module using @tool-decorated functions.
In-process calls use queries.py directly to avoid subprocess overhead;
in production the MCP server runs separately on port 7001.

SECURITY: SUPABASE_SERVICE_KEY / POSTGRES_URL never logged or returned.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Optional

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from langchain_core.tools import tool
from mcps.cpc_corpus import queries
from mcps.cpc_corpus import transport


# ---------------------------------------------------------------------------
# Evidence coverage summary (local computation — no DB, no MCP call)
# ---------------------------------------------------------------------------

def detect_evidence_gaps(
    results: list[dict[str, Any]],
    knowledge_searched: bool = True,
) -> list[dict[str, Any]]:
    """
    Classify evidence gaps from the combined search results after all corpus
    searches are complete.  Returns a list of EvidenceGap objects.

    Gap taxonomy
    ------------
    retrieval_gap  — evidence likely exists but query/routing/search did not surface it
    corpus_gap     — evidence probably exists externally, not yet ingested into Atlas
    landscape_gap  — domain is genuinely thin / innovation frontier with limited prior art

    Callers should pass knowledge_searched=True when search_corpus_evidence was called,
    False when knowledge_chunks were skipped entirely.

    Rules (in priority order):
    1. If knowledge_chunks were not searched → retrieval_gap (routing failure)
    2. If all project scores < 0.70 but ≥ 0.50 → corpus_gap (adjacent, not direct)
    3. If all project scores < 0.50 AND policy scores < 0.50 → landscape_gap (frontier)
    4. If knowledge searched but all scores < 0.55 → corpus_gap (policy lane thin)
    """
    projects = [r for r in results if r.get("source_type") == "project"]
    knowledge = [r for r in results if r.get("source_type") == "knowledge_doc"]

    top_proj = max((float(r.get("similarity") or 0) for r in projects), default=0.0)
    avg_proj = (
        sum(float(r.get("similarity") or 0) for r in projects) / len(projects)
        if projects else 0.0
    )
    top_know = max((float(r.get("similarity") or 0) for r in knowledge), default=0.0)

    gaps: list[dict[str, Any]] = []

    # -----------------------------------------------------------------------
    # Helper: build a fully-shaped gap dict with lane / provider / tool
    # -----------------------------------------------------------------------
    def _gap(
        gap_type: str, topic: str, severity: str, reason: str,
        recommended_action: str,
        lane: str, provider: str, tool: str,
        can_lift: bool, cite: str,
    ) -> dict:
        return {
            "type": gap_type,
            "topic": topic,
            "severity": severity,
            "reason": reason,
            "recommended_action": recommended_action,
            "recommended_source_lane": lane,
            "recommended_provider": provider,
            "available_tool": tool,
            "can_lift_confidence": can_lift,
            "citation_status": cite,
        }

    # --- Rule 1: retrieval_gap — knowledge_chunks not searched ---
    if not knowledge_searched:
        gaps.append(_gap(
            "retrieval_gap",
            "Policy and report evidence (atlas.knowledge_chunks)",
            "medium",
            "search_corpus_evidence was not called — DfT, CCAV, and Innovate UK "
            "policy documents were not retrieved. The knowledge_chunks surface "
            "(4,974 rows, 100% embedded) was bypassed entirely.",
            "Enable search_corpus_evidence in the retrieval pipeline.",
            lane="official_policy", provider="CPC_Corpus",
            tool="cpc_corpus",   # already live — routing bug, not missing tool
            can_lift=True, cite="direct",
        ))

    # --- Rule 2: corpus_gap — projects adjacent but not direct (0.50–0.70) ---
    # Lane: funding — Innovate UK funds the majority of the CPC corpus.
    # Adjacent-but-not-direct almost always means a matching IUK programme
    # hasn't been ingested. live_calls covers open calls today; historical
    # records need future_innovateuk_api.
    if projects and 0.50 <= top_proj < 0.70:
        severity = "high" if avg_proj < 0.56 else "medium"
        gaps.append(_gap(
            "corpus_gap",
            "Direct project precedent",
            severity,
            f"Corpus returned adjacent evidence (top similarity {top_proj:.2f}, "
            f"avg {avg_proj:.2f}) but no direct project precedent (>= 0.70). "
            "Relevant prior work likely exists in Innovate UK or CCAV records "
            "but has not been ingested into Atlas.",
            "Search Innovate UK project database and CCAV programme records; "
            "mark relevant sources for corpus ingestion.",
            lane="funding", provider="InnovateUK",
            tool="live_calls",           # open calls live; full history = future API
            can_lift=True, cite="candidate",
        ))

    # --- Rule 3: landscape_gap — very weak across ALL surfaces ---
    # Lane: market_discovery — weak everywhere suggests frontier domain.
    # Exa confirms whether prior art genuinely doesn't exist externally.
    if top_proj < 0.50 and top_know < 0.50:
        gaps.append(_gap(
            "landscape_gap",
            "Domain evidence",
            "high",
            f"Both project corpus (top {top_proj:.2f}) and policy evidence "
            f"(top {top_know:.2f}) returned weak results. "
            "This may be a genuine innovation frontier with limited prior art.",
            "Run a targeted Exa search to confirm whether external evidence "
            "exists. If not, frame as a strategic first-mover opportunity.",
            lane="market_discovery", provider="Exa",
            tool="exa_search",           # live — External Evidence Router v0.1
            can_lift=True, cite="candidate",
        ))

    # --- Rule 4: corpus_gap — knowledge searched but thin (<0.55) ---
    # Lane: official_policy — knowledge_chunks is predominantly DfT strategy.
    # If scores are low the relevant DfT document isn't ingested yet.
    # Note: DfT docs are accessed via GOV.UK search, but the evidence
    # identity is DfT, not GovUK.
    if knowledge_searched and knowledge and top_know < 0.55:
        gaps.append(_gap(
            "corpus_gap",
            "Policy and regulatory evidence",
            "medium",
            f"Policy/report search returned weak results (top {top_know:.2f} — "
            "below the ADJACENT threshold 0.55). Relevant DfT strategy documents "
            "or Innovate UK guidance may not yet be ingested or approved.",
            "Check DfT publications and Innovate UK programme guidance; "
            "add relevant documents to the ingestion backlog.",
            lane="official_policy", provider="DfT",
            tool="govuk_search",         # DfT docs accessed via GOV.UK — not yet enabled
            can_lift=True, cite="background",
        ))

    return gaps


def evidence_coverage_summary(results: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Compute evidence coverage and suggest a confidence tier from retrieved results.
    Runs locally. Called automatically inside each tool wrapper.
    """
    projects = [r for r in results if r.get("source_type") == "project"]
    live_calls = [r for r in results if r.get("source_type") == "live_call"]
    knowledge_docs = [r for r in results if r.get("source_type") == "knowledge_doc"]
    hive_chunks = [r for r in results if r.get("source_type") == "hive_chunk"]

    similarities = [
        float(r["similarity"])
        for r in results
        if r.get("similarity") is not None
    ]
    top_sim = max(similarities) if similarities else 0.0
    avg_sim = sum(similarities) / len(similarities) if similarities else 0.0

    source_diversity = sum([
        bool(projects), bool(live_calls), bool(knowledge_docs), bool(hive_chunks)
    ])
    total = len(results)

    gaps = []
    if not projects:
        gaps.append("historical_projects")
    if not live_calls:
        gaps.append("live_opportunities")
    if not knowledge_docs:
        gaps.append("policy_evidence")
    if not hive_chunks:
        gaps.append("case_study_evidence")

    if total == 0 or (total <= 1 and top_sim < 0.6):
        tier = "Speculative"
    elif total >= 5 and source_diversity >= 3 and top_sim >= 0.8:
        tier = "Robust"
    elif total >= 3 and source_diversity >= 2:
        tier = "Supported"
    else:
        tier = "Indicative"

    if total == 0 or (total < 3 and source_diversity < 2):
        note = "thin"
    elif total >= 6 and source_diversity >= 3:
        note = "strong"
    else:
        note = "adequate"

    return {
        "projects_found": len(projects),
        "live_calls_found": len(live_calls),
        "knowledge_docs_found": len(knowledge_docs),
        "hive_chunks_found": len(hive_chunks),
        "source_diversity": source_diversity,
        "top_similarity": round(top_sim, 4),
        "average_similarity": round(avg_sim, 4),
        "evidence_gaps": gaps,
        "suggested_confidence_tier": tier,
        "coverage_note": note,
        "transport": transport.get_last_transport(),
        "transport_note": transport.human_transport_note(),
    }


# ---------------------------------------------------------------------------
# @tool wrappers — agents register these as LangGraph tools
# ---------------------------------------------------------------------------

@tool
def search_corpus_projects(query: str, limit: int = 10) -> dict[str, Any]:
    """
    Search the CPC innovation corpus for historically funded or R&D projects.

    Returns real atlas.projects records with verified UUIDs and similarity scores.
    Use returned IDs in corpus_citations — never fabricate IDs.
    Also returns coverage.suggested_confidence_tier — use it for decision_spine.

    Args:
        query: Search query (e.g. 'rail decarbonisation', 'autonomous freight')
        limit: Max results (default 10)
    """
    results = queries.search_projects(query, limit=min(int(limit), 20))
    return {"results": results, "coverage": evidence_coverage_summary(results)}


@tool
def search_corpus_live_calls(query: str, limit: int = 10, open_only: bool = True) -> dict[str, Any]:
    """
    Search atlas.live_calls for live or recent funding/opportunity calls.

    Returns real records with funder, deadline, status, source URL, and verified IDs.
    Use returned IDs in corpus_citations — never fabricate IDs.

    Args:
        query: Search query (e.g. 'autonomous vehicle freight funding')
        limit: Max results (default 10)
        open_only: If true (default), only return calls with status='open'
    """
    results = queries.search_live_calls(query, limit=min(int(limit), 20), open_only=open_only)
    return {"results": results, "coverage": evidence_coverage_summary(results)}


@tool
def search_corpus_evidence(
    claim: str,
    limit: int = 5,
    modes: Optional[str] = None,
    themes: Optional[str] = None,
) -> dict[str, Any]:
    """
    Search atlas.knowledge_chunks for policy, strategy, report or KB evidence.

    Returns real chunk and document records with title, publisher, tier.
    Use returned chunk_id / document_id in corpus_citations — never fabricate IDs.

    Args:
        claim: Specific claim to find evidence for
        limit: Max results (default 5)
        modes: Comma-separated transport mode filter (e.g. 'rail,road') — optional
        themes: Comma-separated theme filter (e.g. 'decarbonisation') — optional
    """
    modes_list = [m.strip() for m in modes.split(",")] if modes else None
    themes_list = [t.strip() for t in themes.split(",")] if themes else None
    results = queries.evidence_for_claim(
        claim, limit=min(int(limit), 20), modes=modes_list, themes=themes_list
    )
    return {"results": results, "coverage": evidence_coverage_summary(results)}


@tool
def search_hive_evidence(query: str, limit: int = 10) -> dict[str, Any]:
    """
    Search hive.document_chunks for HIVE case study and adaptation evidence.

    Returns real chunk records joined to hive.articles with verified IDs.
    Use returned chunk_id / article_id in corpus_citations — never fabricate IDs.

    Args:
        query: Search query (e.g. 'electric vehicle charging climate adaptation')
        limit: Max results (default 10)
    """
    results = queries.search_hive_evidence(query, limit=min(int(limit), 20))
    return {"results": results, "coverage": evidence_coverage_summary(results)}


@tool
def search_cpc_internal(query: str, limit: int = 10) -> dict[str, Any]:
    """
    Search CPC internal capability data: atlas.evidence_containers and atlas.claims.

    Use for CPC-inward entity queries (Decision 3 Rule A).
    Returns source_type cpc_internal / cpc_claim — label as 'CPC internal' in output.

    Args:
        query: Search query (e.g. 'autonomous systems capability', 'rail innovation')
        limit: Max results per table (default 10)
    """
    per_table = min(int(limit), 15)
    containers: list[dict[str, Any]] = []
    claims: list[dict[str, Any]] = []
    errors: list[str] = []

    try:
        containers = queries.search_cpc_evidence_containers(query, limit=per_table)
    except Exception as exc:
        errors.append(f"evidence_containers: {exc}")

    try:
        claims = queries.search_cpc_claims(query, limit=min(int(limit), 10))
    except Exception as exc:
        errors.append(f"claims: {exc}")

    combined = containers + claims
    result: dict[str, Any] = {
        "results": combined,
        "coverage": evidence_coverage_summary(combined),
    }
    if errors:
        result["errors"] = errors
    return result


@tool
def get_corpus_record(source_type: str, record_id: str) -> dict[str, Any]:
    """
    Fetch a full record by ID from the corpus. Only allowlisted source types.

    source_type: project | live_call | knowledge_doc | knowledge_chunk | hive_chunk | hive_article

    Args:
        source_type: Type of record to fetch
        record_id: UUID string of the record
    """
    try:
        result = queries.get_record_by_id(source_type, record_id)
        return {"result": result, "found": result is not None}
    except ValueError as e:
        return {"result": None, "found": False, "error": str(e)}


@tool
def get_project(project_id: str) -> Optional[dict[str, Any]]:
    """
    Retrieve a single atlas.projects record by UUID.
    Use to verify a project ID before citing it.
    """
    return queries.get_project(project_id)


@tool
def search_hive(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """
    Article-level HIVE search (legacy). Prefer search_hive_evidence for chunk-level retrieval.
    """
    return queries.search_hive(query, limit=min(int(limit), 20))


# ---------------------------------------------------------------------------
# Tool lists
# ---------------------------------------------------------------------------

CPC_CORPUS_TOOLS = [
    search_corpus_projects,
    search_corpus_live_calls,
    search_corpus_evidence,
    search_hive_evidence,
    get_corpus_record,
    get_project,
    search_hive,
]
