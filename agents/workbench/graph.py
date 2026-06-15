"""
Atlas Workbench Agent — LangGraph StateGraph
=============================================

⚠ LEGACY — DO NOT EXTEND (ADR-0001, 2026-06-15)
-------------------------------------------------
This file is the pre-ADR-0001 hard-router workbench graph.
It is preserved as a live fallback (ATLAS5_ORCHESTRATOR_V1=false)
and as a reference implementation.

Replacement: agents/orchestrator/graph.py  (ATLAS5_ORCHESTRATOR_V1=true)
Cutover milestone: D4.5

Do not add new routes or nodes here.  If a capability is needed, build it
in agents/orchestrator/ and agents/spine/ instead.

PURPOSE (legacy)
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
import time
from pathlib import Path
from typing import Annotated, Any, Literal, Optional
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
from mcps.cpc_corpus import transport as corpus_transport
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
    "translate",    # M1.5 — transfer lanes from match evidence
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
    # Aggregated output — frontend reads last_output.model_patch (also mirrored top-level)
    last_output: dict[str, Any] | None
    # Internal: set by classify_intent
    _is_conversational: bool


def _with_last_output(result: dict[str, Any], route: WorkbenchRoute) -> dict[str, Any]:
    """Mirror node output into last_output so the frontend contract is satisfied."""
    result["route"] = route
    result["last_output"] = {
        "route": route,
        "chat_response": result.get("chat_response", ""),
        "model_patch": result.get("model_patch"),
        "corpus_citations": result.get("corpus_citations"),
        "confidence_tier": result.get("confidence_tier", "Speculative"),
        "reasoning_trace": result.get("reasoning_trace", []),
        "error": result.get("error"),
    }
    return result


_ROUTE_SUBJECT_LABELS: dict[str, str] = {
    "explain":  "Match explanation",
    "search":   "Corpus evidence",
    "explore":  "Corpus exploration",
    "translate": "Transfer verdict",
    "conversational": "Atlas note",
}


_MARKDOWN_NOISE = re.compile(r"[*_`#>~\[\]\(\)]")


def _strip_markdown(text: str) -> str:
    """Remove markdown punctuation so a headline reads as plain prose."""
    return _MARKDOWN_NOISE.sub("", text).strip()


def _extract_headline(text: str, query: str) -> str:
    """Pick a clean human headline for an auto-wrapped card.

    Preference order:
      1. First H1/H2 markdown heading
      2. Leading bold span "**Title** ..."
      3. First whole sentence ≤ 80 chars
      4. Sanitised query (capitalised)

    Never returns a mid-sentence cut. Always strips markdown punctuation.
    """
    text = (text or "").strip()
    fallback = (_strip_markdown(query or "").strip() or "Atlas response")[:80]
    if not text:
        return fallback

    # 1. Markdown heading
    h = re.search(r"^\s*#{1,3}\s+(.+?)\s*$", text, re.MULTILINE)
    if h:
        return _strip_markdown(h.group(1))[:80] or fallback

    # 2. Leading bold span
    b = re.match(r"\s*\*\*([^*]+)\*\*", text)
    if b:
        return _strip_markdown(b.group(1))[:80] or fallback

    # 3. First whole sentence — only if it fits cleanly
    first = re.split(r"(?<=[.!?])\s+|\n", text, maxsplit=1)[0]
    cleaned = _strip_markdown(first)
    if cleaned and len(cleaned) <= 80:
        return cleaned

    # 4. Fallback: use the user's query (much friendlier than a truncation)
    return fallback


# Phrases that indicate the agent had nothing substantive to add. When the
# response is dominated by these, we suppress the auto-wrap so the canvas
# stays clean — a "couldn't find anything" answer belongs in chat only.
_EMPTY_RESPONSE_PHRASES = (
    "no matching projects",
    "no matching results",
    "no results were returned",
    "the search returned no",
    "the corpus returned no",
    "i wasn't able to find",
    "i was not able to find",
    "i couldn't find",
    "i could not find",
    "i'm not able to identify",
    "i am not able to identify",
    "i don't have data",
    "i do not have data",
    "no projects with that focus",
    "the corpus did not return",
)


def _looks_like_empty_response(text: str) -> bool:
    """Detect 'I couldn't find anything' answers that don't deserve a card."""
    if not text:
        return True
    lower = text.lower()
    # If any signal phrase appears in the FIRST 240 chars (i.e. lead with it)
    # treat the whole response as a negative answer.
    head = lower[:240]
    return any(p in head for p in _EMPTY_RESPONSE_PHRASES)


# ---------------------------------------------------------------------------
# Structured corpus-result blocks
# ---------------------------------------------------------------------------
#
# When a corpus search returns ≥2 verified projects, render them as an
# OpportunityList (Browse mode) instead of prose. This is the difference
# between "here's a wall of text" and "here are 6 projects with
# their organisations and similarity scores in a scannable table".


def _build_corpus_table_patch(
    verified: list[dict[str, Any]],
    query: str,
    route: WorkbenchRoute,
) -> tuple[str, dict[str, Any]]:
    """Build an OpportunityList patch from verified corpus rows.

    Returns (short_narration, patch). The narration is the chat-side text;
    the patch carries the structured browse block + rich visuals.
    """
    n = len(verified)
    rows: list[dict[str, Any]] = []
    for r in verified[:12]:  # cap visual table at 12 rows for sanity
        rows.append({
            "id": r["id"],
            "title": r["title"][:80],
            "organisation": r["organisation"][:60] or "—",
            "score": float(r.get("score", 0) or 0),
            "funder": "",
            "status": "corpus",
        })

    headline_seed = _strip_markdown(query or "Corpus results")[:60]
    headline = f"Corpus results — {headline_seed}" if headline_seed else "Corpus results"

    visual = "match_score_bar" if n >= 5 else "evidence_bar"

    block = {
        "id": f"corpus.{route}.{int(time.time() * 1000)}",
        "type": "OpportunityList",
        "state": "core",
        "headline": headline,
        "visual": visual,
        "role": "focus",
        "content": rows,
    }

    patch = {
        "rationale": f"Surfaced {n} corpus result{'s' if n != 1 else ''} as a workspace table",
        "ops": [{"op": "add_block", "block": block, "at_index": None}],
        "confidence_tier": _derive_search_tier(verified),
        "corpus_citations": verified,
        "stage_intent": "extend",
        "stage_narration": (
            f"Surfaced {n} corpus matches in a table on the canvas."
        ),
    }

    # Short, factual chat narration — the table is the substance.
    narration = (
        f"Found **{n}** project{'s' if n != 1 else ''} in the corpus matching that query. "
        f"Top score: {int((rows[0]['score']) * 100)}% — see the table on the canvas. "
        "Use undo (Ctrl+Z) to remove."
    )
    return narration, patch


def _looks_like_landscape_query(query: str) -> bool:
    """Detect cq.explore.landscape-style questions → NetworkMap instead of table."""
    q = (query or "").lower()
    signals = (
        "landscape", "network", " map", "ecosystem", "stakeholder", "actor",
        "relationship", "how do ", "how are ", "connected", "theme", "cluster",
        "who works on", "who is working", "players in", "players working",
        "show me the landscape", "mapping ",
    )
    return any(s in q for s in signals)


def _build_network_map_patch(
    verified: list[dict[str, Any]],
    query: str,
    route: WorkbenchRoute,
) -> tuple[str, dict[str, Any]]:
    """Build a NetworkMap patch from corpus rows — theme hub + project + org nodes."""
    theme_id = "theme.query"
    theme_label = _strip_markdown(query or "Topic")[:48] or "Topic"
    nodes: list[dict[str, Any]] = [
        {"id": theme_id, "label": theme_label, "group": "theme", "value": 12},
    ]
    edges: list[dict[str, Any]] = []
    org_seen: set[str] = set()

    for i, r in enumerate(verified[:15]):
        proj_id = str(r["id"])
        title = (r.get("title") or f"Project {i + 1}")[:60]
        score = float(r.get("score", 0) or 0)
        nodes.append({
            "id": proj_id,
            "label": title,
            "group": "project",
            "value": max(4, int(score * 10)),
        })
        edges.append({
            "source": theme_id,
            "target": proj_id,
            "weight": score,
            "label": "related",
        })

        org = (r.get("organisation") or "").strip()
        if org and org not in ("—", "-"):
            org_slug = re.sub(r"[^a-z0-9]+", "_", org.lower())[:40]
            org_id = f"org.{org_slug}"
            if org_id not in org_seen:
                org_seen.add(org_id)
                nodes.append({
                    "id": org_id,
                    "label": org[:48],
                    "group": "organisation",
                    "value": 6,
                })
            edges.append({"source": proj_id, "target": org_id, "label": "led by"})

    n = len([node for node in nodes if node.get("group") == "project"])
    headline = f"Landscape — {theme_label}"

    block = {
        "id": f"network.{route}.{int(time.time() * 1000)}",
        "type": "NetworkMap",
        "state": "core",
        "headline": headline,
        "visual": "knowledge_graph",
        "role": "focus",
        "content": {"nodes": nodes, "edges": edges},
    }

    patch = {
        "rationale": f"Mapped {n} corpus projects into a relationship graph",
        "ops": [{"op": "add_block", "block": block, "at_index": None}],
        "confidence_tier": _derive_search_tier(verified),
        "corpus_citations": verified,
        "stage_intent": "extend",
        "stage_narration": f"Added a landscape network map with {n} projects.",
    }

    narration = (
        f"Mapped **{n}** projects into a landscape network on the canvas "
        f"(theme: {theme_label}). Use undo (Ctrl+Z) to remove."
    )
    return narration, patch


def _verdict_to_transfer_outcome(verdict: str, evidence_state: str) -> str:
    v = (verdict or "not mapped").lower().replace("_", " ")
    es = (evidence_state or "unknown").lower().replace("_", " ")
    if v == "strong" and es in ("verified", "self-reported", "self reported"):
        return "travels-as-is"
    if v in ("partial", "relevant", "contextual"):
        return "needs-reframing"
    if v == "judgement":
        return "not-credible-here"
    if v in ("not mapped",) or es in ("unknown", "contested"):
        return "evidence-needed"
    if v == "strong":
        return "needs-reframing"
    return "evidence-needed"


def _extract_matchbench_items(artifact: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Pull evidence rows from artifact MatchBench / ClaimLedger blocks."""
    if not artifact:
        return []
    blocks = artifact.get("blocks") or []
    items: list[dict[str, Any]] = []
    for block in blocks:
        if not isinstance(block, dict):
            continue
        btype = block.get("type")
        content = block.get("content")
        if btype == "MatchBench" and isinstance(content, list):
            items.extend(content)
        elif btype == "ClaimLedger" and isinstance(content, list):
            for row in content:
                if not isinstance(row, dict):
                    continue
                items.append({
                    "id": row.get("id"),
                    "claim_id": row.get("claim_id"),
                    "claim_text": row.get("claim_text"),
                    "verdict": row.get("evidence_map_verdict", "not mapped"),
                    "evidence_state": row.get("evidence_state", "unknown"),
                    "provenance": row.get("provenance", "stored"),
                    "judgement": row.get("evidence_map_judgement"),
                    "confidence_reason": row.get("confidence_reason"),
                })
    return items


def _build_transfer_lanes_patch(
    items: list[dict[str, Any]],
    model_summary: dict[str, Any],
    query: str,
) -> tuple[str, dict[str, Any]]:
    lanes: list[dict[str, Any]] = []
    for i, item in enumerate(items[:24]):
        verdict = str(item.get("verdict") or "not mapped")
        es = str(item.get("evidence_state") or "unknown")
        note = item.get("judgement") or item.get("confidence_reason")
        lanes.append({
            "id": str(item.get("id") or f"lane-{i}"),
            "claim_text": str(item.get("claim_text") or "Untitled claim")[:500],
            "transfer_outcome": _verdict_to_transfer_outcome(verdict, es),
            "evidence_state": es if es in (
                "verified", "self-reported", "inferred", "unknown", "contested"
            ) else "unknown",
            "provenance": item.get("provenance") or "derived",
            "note": str(note)[:240] if note else None,
        })

    source = model_summary.get("source_label") or "Source"
    target = model_summary.get("target_label") or "Target"
    headline = f"Transfer verdict — {source} → {target}"

    block = {
        "id": f"transfer.{int(time.time() * 1000)}",
        "type": "TransferLanes",
        "state": "core",
        "headline": headline,
        "visual": "four_lane_board",
        "role": "focus",
        "content": lanes,
    }

    patch = {
        "rationale": f"Sorted {len(lanes)} claims into four transfer lanes",
        "ops": [{"op": "add_block", "block": block, "at_index": None}],
        "confidence_tier": model_summary.get("confidence_tier", "Indicative"),
        "corpus_citations": [],
        "stage_intent": "extend",
        "stage_narration": f"Added transfer lanes for {len(lanes)} claims.",
    }

    narration = (
        f"Sorted **{len(lanes)}** claims into four transfer lanes on the canvas "
        f"({source} → {target}). Use undo (Ctrl+Z) to remove."
    )
    return narration, patch


def _empty_transfer_chat(query: str) -> str:
    return (
        "I need match evidence to build transfer lanes — open a match in workbench mode "
        "with an evidence map, then ask e.g. "
        f"'can these claims transfer?' or '{(query or 'does this evidence travel')[:60]}'."
    )


def _empty_corpus_chat(query: str) -> str:
    """Polite 'couldn't find anything' message for chat — keeps canvas clean."""
    return (
        f"I couldn't find any matching projects in the current CPC corpus for "
        f"`{(query or 'that query')[:80]}`. Try a different phrasing — e.g. swap "
        "domain terms ('clean maritime' vs 'maritime decarbonisation'), broaden "
        "the topic, or ask me to compare it with a specific sector."
    )


def _unavailable_corpus_chat(query: str, coverage: dict[str, Any]) -> str:
    """When all DB transports fail — explicit, actionable."""
    detail = coverage.get("transport_note") or corpus_transport.human_transport_note("unavailable")
    return (
        f"{detail}\n\n"
        f"I couldn't search the corpus for `{(query or 'that query')[:80]}`. "
        "Check `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in agents/.env, "
        "or connect via hotspot/VPN if Postgres pooler (port 6543) is required."
    )


def _corpus_transport_trace(coverage: dict[str, Any]) -> dict[str, Any] | None:
    tier = coverage.get("transport") or corpus_transport.get_last_transport()
    if tier == "postgres":
        return None
    note = coverage.get("transport_note") or corpus_transport.human_transport_note(tier)
    status = "error" if tier == "unavailable" else "active"
    return {"label": f"Corpus transport: {tier}", "status": status, "detail": note}


def _prepend_corpus_transport_banner(text: str, coverage: dict[str, Any]) -> str:
    tier = coverage.get("transport") or corpus_transport.get_last_transport()
    if tier == "postgres":
        return text
    note = coverage.get("transport_note") or corpus_transport.human_transport_note(tier)
    if tier == "unavailable":
        return note
    return f"_{note}_\n\n{text}"


def _parse_corpus_tool_output(
    tool_output: Any,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if isinstance(tool_output, dict):
        return tool_output.get("results") or [], tool_output.get("coverage") or {}
    if isinstance(tool_output, list):
        return tool_output, {}
    return [], {}


def _canonical_cq_for_route(route: WorkbenchRoute, query: str) -> str:
    """Map agent route + query shape → canonical question id (Seam 5.2)."""
    q = (query or "").lower()
    if route == "translate":
        return "cq.translate.transfer"
    if route == "economic_analysis":
        return "cq.decide.pursue"
    if route == "search":
        return "cq.explore.landscape" if _looks_like_landscape_query(query) else "cq.match.workbench"
    if route == "explore":
        if _looks_like_landscape_query(query):
            return "cq.explore.landscape"
        return "cq.explore.discover"
    if route == "propose":
        return "cq.package.brief" if any(k in q for k in ("brief", "snapshot", "export", "package")) else "cq.match.workbench"
    return "cq.match.workbench"


def _short_narration(text: str, route: str, headline: str) -> str:
    """1-2 sentence narration for the chat panel; full content lives in the card."""
    # If the agent's answer is already short, keep it as the narration.
    text = text.strip()
    if len(text) <= 160:
        return text

    # Otherwise summarise the move JARVIS-style.
    label_map = {
        "explain":  "Pulled together what I know on the canvas.",
        "search":   "Captured the corpus evidence on the canvas.",
        "explore":  "Added the corpus findings to your workspace.",
        "conversational": "Added a note to your workspace.",
    }
    base = label_map.get(route, "Added a card to your workspace.")
    return f"{base} See **{headline}** on the canvas → use undo (Ctrl+Z) to remove."


def _is_substantive(text: str) -> bool:
    """A response is 'substantive' if it deserves its own card on the canvas."""
    t = (text or "").strip()
    if not t:
        return False
    if len(t) < 120 and "\n" not in t:
        return False
    return True


def _auto_wrap_as_card(
    chat_text: str,
    route: WorkbenchRoute,
    query: str,
    corpus_citations: list[dict[str, Any]] | None = None,
) -> tuple[str, Optional[dict[str, Any]]]:
    """Convert a substantive chat answer into (short_narration, ContextCard patch).

    Returns (original_chat_text, None) when the answer is:
      - too short to deserve its own card (greetings, single short sentence)
      - a negative / empty response ("I couldn't find...") — keep that in chat only

    Otherwise returns (short_narration, model_patch) wrapping the answer as a
    ContextCard. Citations are embedded in the block content so the card
    surfaces them as chips at the bottom.
    """
    if not _is_substantive(chat_text):
        return chat_text, None

    # NEW: don't pollute the canvas with "I couldn't find anything" cards.
    # The chat reply already explains the negative result clearly.
    if _looks_like_empty_response(chat_text):
        return chat_text, None

    headline = _extract_headline(chat_text, query)
    block_id = f"card.{route}.{int(time.time() * 1000)}"

    # Limit citations to top 6 for visual cleanliness on the card.
    citations_for_card = (corpus_citations or [])[:6]

    block = {
        "id": block_id,
        "type": "ContextCard",
        "state": "core",
        "headline": headline,
        "visual": "paired_context_cards",
        "role": "focus",  # M3 — new auto-wrapped cards land as focus
        "content": {
            "subject": _ROUTE_SUBJECT_LABELS.get(route, "Atlas response"),
            "body": chat_text.strip(),
            # Citations embedded in content so the renderer can surface chips
            "citations": citations_for_card,
        },
    }

    patch: dict[str, Any] = {
        "rationale": f"Captured {route} response as a workspace card",
        "ops": [{"op": "add_block", "block": block, "at_index": None}],
        "confidence_tier": "Indicative",
        "corpus_citations": corpus_citations or [],
        # M3 — auto-wraps are additive; never branch
        "stage_intent": "extend",
        "stage_narration": f"Added '{headline}' to the canvas.",
    }

    return _short_narration(chat_text, route, headline), patch


def _strip_json_from_chat(raw: str, json_start: int, json_end: int) -> str:
    """Remove JSON block from chat prose (before AND after the JSON section)."""
    if json_start >= 0 and json_end > json_start:
        chat = (raw[:json_start] + raw[json_end:]).strip()
    else:
        chat = re.sub(r"```(?:json)?[\s\S]*?```", "", raw).strip()
        chat = re.sub(r"\{[^{}]*\"model_patch\"[\s\S]*\}", "", chat).strip()
    chat = re.sub(
        r"(?im)^(?:here\s+is|here['\u2019]s)\s+the\s+(?:proposed\s+)?patch[:.]?\s*$",
        "",
        chat,
    ).strip()
    # Deduplicate repeated paragraphs (LLM sometimes echoes itself)
    lines = chat.split("\n")
    seen: set[str] = set()
    deduped: list[str] = []
    for line in lines:
        key = line.strip()
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        deduped.append(line)
    return "\n".join(deduped).strip()


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
            "You are updating the workbench artifact.\n"
            "Your response MUST include a model_patch in your final JSON output.\n"
            "Start with a brief 1-2 sentence prose summary of the change (what + why).\n"
            "Most patches apply IMMEDIATELY with an undo affordance; only edits to\n"
            "blocks the analyst has pinned require a hard confirm. Write the prose\n"
            "as if the change has been made (e.g. 'I've added a SWOT-style\n"
            "ComparisonMatrix...') rather than 'I propose to add...'.\n"
            "Do NOT include 'awaiting confirmation' boilerplate."
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
        "translate": (
            "You are assessing whether passport claims transfer to the target context.\n"
            "Sort evidence into travels-as-is, needs-reframing, not-credible-here, or evidence-needed.\n"
            "Be explicit about evidence quality — never overstate transferability."
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
- Model patches: Only when route = "propose". Patches auto-apply with undo; pinned blocks require confirm.
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
  translate       — asks whether evidence/claims from the source context transfer to the target: "does this travel", "can we port this", "transfer verdict", "what reframes"
  propose         — wants to update, edit, add, or remove something from the artifact
  economic_analysis — asks about NPV, BCR, value, cost-benefit, Five Case, "is this worth it", "build business case"
  conversational  — greeting, thank you, meta question about the assistant

Key distinction:
  search = "find evidence FOR this match"
  explore = "show me other things / broader questions / not about this specific match"
  translate = "does evidence/claims transfer from source to target context"
  propose = "add/update canvas/artifact" — includes SWOT, comparison matrix, add block, show on canvas
  economic_analysis = NPV/BCR/Five Case ONLY — NOT generic SWOT or strategic analysis

Examples:
  "perform a swot on cpc" → propose
  "add swot to artifact" → propose
  "what is the NPV" → economic_analysis
  "what projects are in the corpus" → explore
  "can this evidence transfer to the target" → translate
  "show me the landscape of rail AI projects" → explore

User message: {query}

Reply with ONLY the route word. Nothing else."""


def classify_route(state: WorkbenchState) -> dict:
    """Classify the user's query into a workbench route."""
    query = state.get("query", "")
    if not query.strip():
        return {"route": "conversational"}

    q_lower = query.lower()
    # Fast-path: artifact mutations (avoid misrouting SWOT → economic_analysis)
    patch_signals = (
        "swot", "add to artifact", "add to canvas", "update artifact", "update canvas",
        "propose", "comparison matrix", "add block", "put on", "show on canvas",
        "add a ", "add an ",
    )
    if any(sig in q_lower for sig in patch_signals):
        return {
            "route": "propose",
            "reasoning_trace": [
                {"label": "Route classified: propose (artifact update)", "status": "complete"},
            ],
        }

    translate_signals = (
        "transfer", "translate", "travels", "reframe", "reframing", "port to",
        "port this", "apply to", "credible here", "does this work in",
        "does this evidence", "can this claim", "travel to", "transfer lane",
        "transfer verdict",
    )
    if any(sig in q_lower for sig in translate_signals):
        return {
            "route": "translate",
            "reasoning_trace": [
                {"label": "Route classified: translate (transfer lanes)", "status": "complete"},
            ],
        }

    llm = _llm()
    msg = llm.invoke([HumanMessage(content=_ROUTE_PROMPT.format(query=query))])
    raw = msg.content.strip().lower().split()[0] if msg.content else "explain"

    valid_routes = {
        "explain", "search", "explore", "translate", "propose",
        "economic_analysis", "conversational",
    }
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

    content = response.content if isinstance(response.content, str) else str(response.content)

    # Tier 1B: auto-wrap substantive answers as a workspace card.
    # Short answers stay in chat; long answers move to the canvas with a one-liner pointer.
    narration, patch = _auto_wrap_as_card(content, "explain", state.get("query", ""))

    return _with_last_output({
        "chat_response": narration,
        "model_patch": patch,
        "confidence_tier": state.get("confidence_tier", "Speculative"),
        "reasoning_trace": trace,
        "messages": [AIMessage(content=narration)],
    }, "explain")


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
    coverage: dict[str, Any] = {}
    try:
        enriched_query = (
            f"{query} "
            f"{model_summary.get('source_label', '')} "
            f"{model_summary.get('target_label', '')}"
        ).strip()
        tool_output = search_corpus_projects.invoke({"query": enriched_query, "k": 8})
        raw_results, coverage = _parse_corpus_tool_output(tool_output)
    except Exception as exc:
        trace.append({"label": "Corpus search failed", "status": "error", "detail": str(exc)})

    transport_chip = _corpus_transport_trace(coverage)
    if transport_chip:
        trace.append(transport_chip)

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

    # === FAST-PATH: zero / many results ===
    # 0 results → polite chat-only message, no canvas pollution
    # ≥2 results → structured corpus table on the canvas, short chat narration
    # 1 result → fall through to LLM synthesis (a single hit deserves prose)
    if len(verified) == 0:
        if coverage.get("transport") == "unavailable":
            chat_text = _unavailable_corpus_chat(query, coverage)
        else:
            chat_text = _empty_corpus_chat(query)
        chat_text = _prepend_corpus_transport_banner(chat_text, coverage)
        return _with_last_output({
            "chat_response": chat_text,
            "model_patch": None,
            "corpus_citations": verified,
            "confidence_tier": "Speculative",
            "reasoning_trace": trace,
            "messages": [AIMessage(content=chat_text)],
        }, "search")

    cq = _canonical_cq_for_route("search", query)
    trace.append({"label": f"Canonical question: {cq}", "status": "complete"})

    if len(verified) >= 3 and cq == "cq.explore.landscape":
        narration, patch = _build_network_map_patch(verified, query, "search")
        narration = _prepend_corpus_transport_banner(narration, coverage)
        return _with_last_output({
            "chat_response": narration,
            "model_patch": patch,
            "corpus_citations": verified,
            "confidence_tier": _derive_search_tier(verified),
            "reasoning_trace": trace,
            "messages": [AIMessage(content=narration)],
        }, "search")

    if len(verified) >= 2:
        narration, patch = _build_corpus_table_patch(verified, query, "search")
        narration = _prepend_corpus_transport_banner(narration, coverage)
        return _with_last_output({
            "chat_response": narration,
            "model_patch": patch,
            "corpus_citations": verified,
            "confidence_tier": _derive_search_tier(verified),
            "reasoning_trace": trace,
            "messages": [AIMessage(content=narration)],
        }, "search")

    # === Single-result path: LLM synthesis + auto-wrap as ContextCard ===
    system = _build_system_prompt(
        state.get("model_summary"),
        state.get("lens", "CPC"),
        "search",
    )
    citations_json = json.dumps(verified, indent=2)
    synthesis_prompt = (
        f"Based on this corpus search result, answer the user's question.\n\n"
        f"Search result:\n{citations_json}\n\n"
        f"User question: {query}"
    )
    messages = [
        SystemMessage(content=system),
        HumanMessage(content=synthesis_prompt),
    ]
    llm = _llm()
    response = llm.invoke(messages)

    content = response.content if isinstance(response.content, str) else str(response.content)
    narration, patch = _auto_wrap_as_card(content, "search", query, verified)

    return _with_last_output({
        "chat_response": narration,
        "model_patch": patch,
        "corpus_citations": verified,
        "confidence_tier": _derive_search_tier(verified),
        "reasoning_trace": trace,
        "messages": [AIMessage(content=narration)],
    }, "search")


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

Respond with a brief prose summary (1-3 sentences) in past tense, explaining what
you added. Then ONE fenced JSON block at the very end.

CRITICAL: The JSON block is for the system only. Never repeat it in prose.
Never paste unfenced JSON. The user sees prose + a build trace, not raw JSON.

```json
{
  "model_patch": {
    "rationale": "Human-readable explanation of the change",
    "ops": [
      {"op": "add_block", "block": {...RenderBlock with role}, "at_index": null}
    ],
    "confidence_tier": "Indicative",
    "corpus_citations": [],
    "stage_intent": "extend",
    "stage_narration": "One-sentence past-tense move description."
  }
}
```

## Stage intent (M3 — required field)

Every patch must declare how it reshapes the canvas. Pick ONE:

- `extend`    — add to the current view. Empty canvas, or adding alongside.
                Default for almost all "add X" requests.
- `pivot`     — new focus for a related but different question. Demote the
                current focus block(s) to role="context" via set_block_role.
                Example: "OK now how do I act on this?" while a recommendation
                is on screen — promote ActionPlan to focus, demote Recommendation.
- `recompose` — same content, better arrangement. Use update_block ops to swap
                visual / headline / role. Rare.
- `branch`    — user has shifted to a different topic. Archive existing focus +
                context blocks via archive_block ops, then add new focus. The
                user will get a 3-second confirm chip — only use this when the
                shift is genuinely off-topic from what's currently on screen.

## Block roles (M3)

Every block has a `role`: focus | context | reference | archived.
Default `focus` for new blocks. Use roles to guide composition:

- focus     — primary answer to the current question (max 2-3 at a time)
- context   — kept around to ground the focus
- reference — peripheral, available but minimised
- archived  — hidden off-stage (use archive_block op, recoverable)

For a PIVOT, your ops should include:
  1. `set_block_role` on the previous focus → "context"
  2. `add_block` with role="focus" for the new answer

For a BRANCH, your ops should include:
  1. `archive_block` for each existing focus/context block
  2. `add_block` with role="focus" for the new topic

## Stage narration (M3)

Set `stage_narration` to one past-tense sentence narrating the move:
- extend:    "Added a SWOT card to the canvas."
- pivot:     "Brought the action plan forward, parked the recommendation as context."
- recompose: "Swapped the recommendation card for a chart."
- branch:    "Started a new thread on maritime decarbonisation. Previous view archived."

This is shown alongside the chat reply — make it concrete and human.

## Block type catalog — pick the right tool

Choose the block that best fits the user's intent. Never invent a new type.
For composite analyses (e.g. SWOT, comparison tables), reach for ComparisonMatrix
or compose several ContextCards.

| Intent                                   | Block type             | When to use                                              |
| ---------------------------------------- | ---------------------- | -------------------------------------------------------- |
| Free-form summary / narrative / SWOT prose | ContextCard          | Anything that's prose, multi-point notes, or simple text |
| 2x2 / quadrant analysis (e.g. SWOT grid) | ComparisonMatrix       | Set `visual: "quadrant_grid"`, content `{quadrants:{...}}` |
| Side-by-side projects / options compare  | ComparisonMatrix       | Default `visual: "stored_match_list"`                    |
| Headline decision + score + confidence   | RecommendationConfidence | Verdict, score, confidence tier, cap reason            |
| Evidence state counts                    | EvidenceStateSummary   | Verified/self-reported/inferred/unknown bar              |
| Gaps between source and target           | DimensionGap           | List of gaps with magnitude                              |
| Capability claim ledger                  | ClaimLedger            | Audit-style list of claims with evidence state           |
| Match evidence map                       | MatchBench             | Evidence map table tying claims to corpus                |
| What to do next / next steps             | ActionPlan             | Sequenced actions tied to gaps                           |
| Counter-arguments + responses            | ObjectionResponse      | Challenge/response/evidence rows                         |
| Evidence trail / provenance              | ProvenanceTrace        | Path through citations                                   |
| Five Case / NPV / value drivers          | EconomicCase           | Use the economic_analysis route instead                  |

Examples:

- User: "add a SWOT on CPC"
  → ComparisonMatrix with visual="quadrant_grid", content={quadrants:{strengths:[...],weaknesses:[...],opportunities:[...],threats:[...]}}

- User: "summarise the recommendation"
  → ContextCard with content={subject:"Recommendation", body:"..."}

- User: "what should we do next?"
  → ActionPlan with content=[{action,linked_gap,owner,sequence},...]

- User: "now switch focus to action plan"  (something already on stage)
  → stage_intent="pivot", set_block_role demoting current focus + add ActionPlan as focus

- User: "let's look at maritime decarbonisation projects instead"
  → stage_intent="branch", archive_block ops + add new ContextCard/ComparisonMatrix focus

## Valid block types (STRICT — agent MUST use one of these)

You may ONLY add or update blocks whose `type` is one of these registered types:
  - RecommendationConfidence  (decision verdict + tier badge)
  - EvidenceStateSummary      (verified/self-reported/inferred breakdown)
  - DimensionGap              (gap rows with magnitude + would-change-if)
  - MatchBench                (4-dimension score table or radar)
  - ClaimLedger               (audit table of claims and evidence state)
  - ActionPlan                (checklist or timeline)
  - ObjectionResponse         (objection vs response table)
  - ProvenanceTrace           (evidence chain breadcrumb)
  - OpportunityList           (Browse mode — ranked corpus rows; USE for project lists)
  - ComparisonMatrix          (N x M grid — USE THIS FOR SWOT, 2x2 quadrants, etc.)
  - ContextCard               (free-form prose card with a single subject)
  - EconomicCase              (Five Case NPV/BCR/value-driver block)

## Forbidden patterns

- Do NOT invent block types (no "swot", "summary", "table", "chart" etc.)
- Do NOT add a Markdown table or chart as a custom block type.

## Composing complex analyses

For a SWOT analysis, emit ONE `ComparisonMatrix` block with visual `quadrant_grid`
and this content shape (NOT match-list rows):

```json
{
  "type": "ComparisonMatrix",
  "id": "swot_cpc_org",
  "headline": "SWOT — Connected Places Catapult",
  "visual": "quadrant_grid",
  "state": "core",
  "quadrants": [
    {"label": "Strengths", "body": "bullet points as markdown"},
    {"label": "Weaknesses", "body": "..."},
    {"label": "Opportunities", "body": "..."},
    {"label": "Threats", "body": "..."}
  ]
}
```

Use `id` and `headline` (NOT block_id / title). SWOT about CPC is NOT about the
current GPS-Denied match unless the user explicitly asks about that match.

For multi-dimension scoring, use `MatchBench`.

## Other rules

- Only one model_patch per response.
- JSON goes ONLY in the fenced block — never repeat it in prose.
- Patches auto-apply to the artifact with undo — write past tense in prose.
"""


def _extract_json_object(text: str, key: str = "model_patch") -> tuple[Optional[dict], int, int]:
    """
    Robust JSON object extractor.
    Finds the first balanced {...} that contains the given key.
    Returns (parsed_dict, start_idx, end_idx) or (None, -1, -1).
    Handles nested braces, code fences, and prose-around-JSON.
    """
    fenced = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    if fenced:
        try:
            obj = json.loads(fenced.group(1))
            if key in obj or key in str(obj):
                return obj, fenced.start(), fenced.end()
        except Exception:
            pass

    # Bracket-balanced scan for the first { containing the key
    for start in range(len(text)):
        if text[start] != "{":
            continue
        depth = 0
        for end in range(start, len(text)):
            ch = text[end]
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[start:end + 1]
                    if key not in candidate:
                        break
                    try:
                        return json.loads(candidate), start, end + 1
                    except Exception:
                        break
    return None, -1, -1


_VALID_STAGE_INTENTS = {"extend", "pivot", "recompose", "branch"}
_VALID_BLOCK_ROLES = {"focus", "context", "reference", "archived"}


def _normalize_stage_metadata(patch: dict[str, Any]) -> dict[str, Any]:
    """Ensure every patch has a valid stage_intent + stage_narration + block roles.

    Defaults:
      - stage_intent defaults to "extend" (safest, additive)
      - new blocks default to role="focus" if not specified
      - stage_narration falls back to the rationale (truncated) if absent

    Returns the same patch dict (mutated in place for simplicity).
    """
    intent = patch.get("stage_intent")
    if intent not in _VALID_STAGE_INTENTS:
        patch["stage_intent"] = "extend"

    if not patch.get("stage_narration"):
        rationale = patch.get("rationale") or ""
        patch["stage_narration"] = (rationale[:140] + "...") if len(rationale) > 140 else rationale

    ops = patch.get("ops")
    if isinstance(ops, list):
        for op in ops:
            if not isinstance(op, dict):
                continue
            if op.get("op") == "add_block":
                block = op.get("block")
                if isinstance(block, dict):
                    role = block.get("role")
                    if role not in _VALID_BLOCK_ROLES:
                        block["role"] = "focus"
            elif op.get("op") == "set_block_role":
                if op.get("role") not in _VALID_BLOCK_ROLES:
                    op["role"] = "context"  # safe default for unknown roles
    return patch


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
    raw = response.content if isinstance(response.content, str) else str(response.content)

    # --- parse model_patch from response (robust extraction) ---
    model_patch = None
    parsed, start, end = _extract_json_object(raw, "model_patch")
    if parsed:
        # Unwrap {"model_patch": {...}} or accept top-level patch
        model_patch = parsed.get("model_patch") if "model_patch" in parsed else parsed

    # --- validate block types (M2.1 — reject inventions) ---
    # Constrain to the registered 13 block types. The agent must compose
    # complex layouts (e.g. SWOT) using existing blocks, not invent new ones.
    valid_block_types = {
        "RecommendationConfidence", "EvidenceStateSummary", "DimensionGap",
        "MatchBench", "ClaimLedger", "ActionPlan", "ObjectionResponse",
        "ProvenanceTrace", "ComparisonMatrix", "OpportunityList", "ContextCard",
        "EconomicCase", "NetworkMap", "TransferLanes",
    }
    invalid_types: list[str] = []
    if model_patch and isinstance(model_patch.get("ops"), list):
        for op in model_patch["ops"]:
            if isinstance(op, dict) and op.get("op") == "add_block":
                block = op.get("block") or {}
                btype = block.get("type")
                if btype and btype not in valid_block_types:
                    invalid_types.append(btype)
            elif isinstance(op, dict) and op.get("op") == "update_block":
                # update_block ops carry a partial patch — type changes not allowed
                patch = op.get("patch") or {}
                if patch.get("type") and patch["type"] not in valid_block_types:
                    invalid_types.append(patch["type"])

    if invalid_types:
        trace.append({
            "label": f"Patch rejected: invented block types {invalid_types}",
            "status": "error",
        })
        unique = sorted(set(invalid_types))
        chat_text = (
            f"I can't add a block of type `{unique[0]}` — that's not a registered "
            "block type in this workbench. Valid blocks are: "
            f"{', '.join(sorted(valid_block_types))}.\n\n"
            "For composite analyses like SWOT, ask me to use a `ComparisonMatrix` "
            "(quadrant layout) or multiple `ContextCard` blocks, and I'll re-propose."
        )
        return _with_last_output({
            "chat_response": chat_text,
            "model_patch": None,
            "confidence_tier": "Speculative",
            "reasoning_trace": trace,
            "messages": [AIMessage(content=chat_text)],
        }, "propose")

    # --- M3 — normalise stage_intent + roles + narration ---
    if model_patch:
        model_patch = _normalize_stage_metadata(model_patch)
        trace.append({
            "label": f"Stage intent: {model_patch.get('stage_intent')}",
            "status": "complete",
        })

    # --- derive clean prose for chat (strip ALL JSON from display) ---
    if model_patch:
        chat_text = _strip_json_from_chat(raw, start, end)
        if not chat_text:
            rationale = model_patch.get("rationale", "")
            narration = model_patch.get("stage_narration", "")
            chat_text = (
                f"{narration} Use undo (top-right) or Ctrl+Z to revert."
                if narration
                else f"Done — {rationale} Use undo (top-right) or Ctrl+Z to revert."
                if rationale
                else "Done. The block is on the artifact — use undo or Ctrl+Z to revert."
            )
    else:
        chat_text = _strip_json_from_chat(raw, -1, -1)
        if not chat_text:
            chat_text = (
                "I couldn't format a valid artifact patch from that response. "
                "Try again with e.g. 'add a SWOT on CPC to the artifact'."
            )

    trace.append({"label": "Patch proposal ready", "status": "complete"})

    return _with_last_output({
        "chat_response": chat_text,
        "model_patch": model_patch,
        "confidence_tier": "Indicative",
        "reasoning_trace": trace,
        # CRITICAL: clean prose only — never raw JSON in messages
        "messages": [AIMessage(content=chat_text)],
    }, "propose")


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
        "EconomicCase block added to the artifact — use undo to revert."
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
            ec_block.setdefault("role", "focus")  # M3 — economic case takes focus
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
                # M3 — economic analysis arrives as a sustantive new focus
                "stage_intent": "extend",
                "stage_narration": (
                    f"Added Five Case economic analysis — "
                    f"verdict: {content.get('verdict', 'unknown')}."
                ),
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

    return _with_last_output({
        "chat_response": chat_text,
        "model_patch": model_patch,
        "confidence_tier": "Indicative",
        "reasoning_trace": trace,
        "messages": [AIMessage(content=chat_text)],
    }, "economic_analysis")


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
    coverage: dict[str, Any] = {}
    try:
        tool_output = search_corpus_projects.invoke({"query": query, "k": 10})
        raw_results, coverage = _parse_corpus_tool_output(tool_output)
    except Exception as exc:
        trace.append({"label": f"Corpus search failed: {exc}", "status": "error"})

    transport_chip = _corpus_transport_trace(coverage)
    if transport_chip:
        trace.append(transport_chip)

    cq = _canonical_cq_for_route("explore", query)
    trace.append({"label": f"Canonical question: {cq}", "status": "complete"})

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

    # === FAST-PATH: zero / many results (same shape as search_node) ===
    if len(verified) == 0:
        if coverage.get("transport") == "unavailable":
            chat_text = _unavailable_corpus_chat(query, coverage)
        else:
            chat_text = _empty_corpus_chat(query)
        chat_text = _prepend_corpus_transport_banner(chat_text, coverage)
        return _with_last_output({
            "chat_response": chat_text,
            "model_patch": None,
            "corpus_citations": verified,
            "confidence_tier": "Speculative",
            "reasoning_trace": trace,
            "messages": [AIMessage(content=chat_text)],
        }, "explore")

    if len(verified) >= 3 and cq == "cq.explore.landscape":
        narration, patch = _build_network_map_patch(verified, query, "explore")
        narration = _prepend_corpus_transport_banner(narration, coverage)
        return _with_last_output({
            "chat_response": narration,
            "model_patch": patch,
            "corpus_citations": verified,
            "confidence_tier": "Indicative",
            "reasoning_trace": trace,
            "messages": [AIMessage(content=narration)],
        }, "explore")

    if len(verified) >= 2:
        narration, patch = _build_corpus_table_patch(verified, query, "explore")
        narration = _prepend_corpus_transport_banner(narration, coverage)
        return _with_last_output({
            "chat_response": narration,
            "model_patch": patch,
            "corpus_citations": verified,
            "confidence_tier": "Indicative",
            "reasoning_trace": trace,
            "messages": [AIMessage(content=narration)],
        }, "explore")

    # === Single-result path: LLM prose summary + auto-wrap as ContextCard ===
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
    )

    system = (
        "You are the Atlas Workbench assistant exploring the CPC Connected Places corpus.\n"
        "Answer the user's question using the corpus results below.\n"
        "Be specific: cite project titles and IDs. Identify patterns and themes.\n"
        "Do not confabulate projects — only reference what is in the corpus results.\n"
        f"{match_context}\n\n"
        f"Corpus result for this query:\n{citations_block}"
    )

    llm = _llm()
    response = llm.invoke(
        [SystemMessage(content=system)] + list(state.get("messages", []))
    )

    trace.append({"label": "Corpus exploration complete", "status": "complete"})

    content = response.content if isinstance(response.content, str) else str(response.content)
    narration, patch = _auto_wrap_as_card(content, "explore", query, verified)

    return _with_last_output({
        "chat_response": narration,
        "model_patch": patch,
        "corpus_citations": verified,
        "confidence_tier": "Indicative",
        "reasoning_trace": trace,
        "messages": [AIMessage(content=narration)],
    }, "explore")


# ---------------------------------------------------------------------------
# Node: translate (M1.5 — transfer lanes from match evidence)
# ---------------------------------------------------------------------------


def translate_node(state: WorkbenchState) -> dict:
    """Build TransferLanes from the current match evidence map."""
    trace = state.get("reasoning_trace", [])
    query = state.get("query", "")
    model_summary = state.get("model_summary") or {}
    artifact = state.get("artifact")

    trace.append({"label": "Building transfer lanes from match evidence", "status": "active"})

    items = _extract_matchbench_items(artifact if isinstance(artifact, dict) else None)

    if not items:
        chat_text = _empty_transfer_chat(query)
        trace.append({"label": "No evidence map items in artifact", "status": "error"})
        return _with_last_output({
            "chat_response": chat_text,
            "model_patch": None,
            "corpus_citations": [],
            "confidence_tier": model_summary.get("confidence_tier", "Speculative"),
            "reasoning_trace": trace,
            "messages": [AIMessage(content=chat_text)],
        }, "translate")

    narration, patch = _build_transfer_lanes_patch(items, model_summary, query)
    trace.append({"label": f"Transfer lanes: {len(items)} claims", "status": "complete"})

    return _with_last_output({
        "chat_response": narration,
        "model_patch": patch,
        "corpus_citations": [],
        "confidence_tier": patch.get("confidence_tier", "Indicative"),
        "reasoning_trace": trace,
        "messages": [AIMessage(content=narration)],
    }, "translate")


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
            "## What you can do\n"
            "- **Explain** — answer questions about this match: evidence, gaps, confidence\n"
            "- **Search** — find corpus evidence for this specific match\n"
            "- **Explore** — browse the full CPC corpus: other projects, sectors, themes\n"
            "- **Translate** — sort match claims into transfer lanes (travels / reframes / not credible / evidence needed)\n"
            "- **Update the canvas** — add or edit blocks. Just ask 'add a SWOT', "
            "'show me a comparison matrix', 'add a context card on X'. Changes apply "
            "immediately with an undo button — only edits to pinned blocks need approval.\n"
            "- **Economic case** — 'run economic case' or 'what is the NPV?'\n\n"
            "## Canvas-first behaviour (always true)\n"
            "Any substantive answer you write (more than ~120 characters) is "
            "automatically captured as a card on the user's canvas. So write the FULL "
            "answer naturally — the chat shows a one-liner pointer and the body goes "
            "to the canvas. Do NOT add boilerplate like 'I've put this on the canvas' "
            "yourself; that happens automatically. Just give the answer.\n\n"
            "## Critical rule\n"
            "NEVER say 'I cannot control the canvas' or 'I cannot push to the UI'. "
            "You CAN and DO update the artifact directly. Speak in present tense and "
            "give the answer — the system handles canvas mechanics.\n\n"
            "Respond naturally to this message."
        )),
    ] + list(state.get("messages", []))
    response = llm.invoke(messages)
    content = response.content if isinstance(response.content, str) else str(response.content)

    # Tier 1B: only wrap substantive conversational responses (e.g. "what can you do?")
    # Greetings, ack, "hi", etc. stay in chat — _auto_wrap_as_card returns (text, None).
    narration, patch = _auto_wrap_as_card(content, "conversational", state.get("query", ""))

    return _with_last_output({
        "chat_response": narration,
        "model_patch": patch,
        "confidence_tier": "Speculative",
        "reasoning_trace": [{"label": "Conversational response", "status": "complete"}],
        "messages": [AIMessage(content=narration)],
    }, "conversational")


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
        "translate":         "translate",
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
    graph.add_node("translate", translate_node)
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
            "translate":         "translate",
            "propose":           "propose",
            "economic_analysis": "economic_analysis",
            "conversational":    "conversational",
        },
    )

    # All processing nodes → END
    for node in [
        "explain", "search", "explore", "translate", "propose",
        "economic_analysis", "conversational",
    ]:
        graph.add_edge(node, END)

    # LangGraph API provides its own persistence; MemorySaver is for direct uvicorn use.
    _checkpointer = None if "langgraph_api" in sys.modules else MemorySaver()
    return graph.compile(checkpointer=_checkpointer)


# ---------------------------------------------------------------------------
# Exported graph (used by agents/server.py + langgraph.json)
# ---------------------------------------------------------------------------

graph = build_graph()

__all__ = ["graph"]
