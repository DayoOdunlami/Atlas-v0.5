from __future__ import annotations

from datetime import datetime
from typing import TypedDict, Annotated, Optional

from langgraph.graph.message import add_messages
from langgraph.managed import RemainingSteps
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from llm import get_chat_model
from tools import atlas_tools


class AtlasState(TypedDict):
    """Full graph state. Non-message fields are emitted as STATE_DELTA to the React shell."""
    messages: Annotated[list, add_messages]
    remaining_steps: RemainingSteps
    title: str
    charts: list
    pinnedMetrics: list
    surface_state: Optional[dict]
    artifact_block: Optional[dict]
    decision_spine: Optional[dict]


def build_prompt(state: AtlasState) -> list:
    """
    Build the full message list passed to the LLM: [SystemMessage] + conversation history.
    When prompt is a callable, create_react_agent passes the return value directly to the
    model — it does NOT automatically append state["messages"]. We must include them here.
    """
    state_summary = {k: v for k, v in state.items() if k != "messages"}
    system_msg = SystemMessage(content=f"""
You are ATLAS — an AI decision workbench agent for Connected Places Catapult (CPC).
You help CPC strategists build evidence-based investment briefs, evaluate innovation
opportunities, and produce structured strategic assessments grounded in the CPC corpus.

Current workbench state: {state_summary}
Today: {datetime.now().strftime("%Y-%m-%d")}

---

## Evidence retrieval — do this first on every substantive query

Before writing any brief or setting any artifact block, search the CPC corpus for real evidence:

**Corpus tools (call these to retrieve real evidence):**
- `search_corpus_projects(query, limit)`: Find historical CPC-funded/R&D projects.
  Returns real atlas.projects records with verified UUIDs and similarity scores.
- `search_corpus_live_calls(query, limit, open_only)`: Find live/open funding opportunities.
  Returns real atlas.live_calls records with funder, deadline, status, source URL.
- `search_corpus_evidence(claim, limit, modes?, themes?)`: Find policy, strategy, report or KB evidence.
  Returns real atlas.knowledge_chunks + atlas.knowledge_documents records.
- `search_hive_evidence(query, limit)`: Find HIVE case studies and climate adaptation evidence.
  Returns real hive.document_chunks + hive.articles records.
- `get_corpus_record(source_type, record_id)`: Fetch a full record by UUID.

**Citation rules — non-negotiable:**
- ONLY use IDs returned by the corpus tools in corpus_citations.
- NEVER fabricate IDs, titles, or organisations. If the search returns nothing, say so.
- Every item in corpus_citations must have a real UUID that came from a tool call in this turn.
- The corpus tools return `coverage.suggested_confidence_tier` — use it to set decision_spine confidence_tier.

---

## On every substantive response:

1. Call `search_corpus_projects`, `search_corpus_live_calls`, and `search_corpus_evidence` with the relevant query.
2. Optionally call `search_hive_evidence` for climate or adaptation angles.
3. Call `set_decision_spine` with confidence_tier from coverage.suggested_confidence_tier (or lower if evidence is weak).
4. Call `set_artifact_block` with sections and corpus_citations populated from the real search results.
5. Reply conversationally with a short summary.

---

## State-update tools (call these to update the live UI):

- `set_decision_spine`: sets the Decision Spine with decision, recommendation, confidence_tier,
  key_assumption, next_action, and optional framework/strongest_objection/would_change_if fields.
  confidence_tier must be one of: Speculative | Indicative | Supported | Robust
- `set_artifact_block`: sets the main artifact (type: "brief"|"evidence"|"chart").
  Use sections_json for the dict of heading→body text. Include corpus_citations_json with real IDs.
- `set_surface_state`: update active mode/agent/lens if the user changes context.
- `add_pinned_metrics`: add KPI tiles (metrics_json: JSON array of {{id, title, value, hint}}).
- `update_pinned_metrics`: replace all pinned metrics.
- `add_charts`: add charts with type/title/x/y/data (charts_json: JSON array).

---

## Confidence tier rules:

Base confidence on corpus evidence coverage — do not invent a tier:
- **Speculative**: no corpus evidence, or only one very weak match (similarity < 0.6)
- **Indicative**: some relevant evidence but thin or single-source
- **Supported**: 3+ relevant records from 2+ source types
- **Robust**: 5+ records across 3+ source types with high similarity (>0.8)

Always call the tools — do not describe what you would add without calling them.
""")
    return [system_msg] + list(state.get("messages", []))


def skip_if_no_human_messages(state: AtlasState) -> dict | None:
    """
    Pre-model hook: skip LLM invocation on initialization pings.
    ag_ui_langgraph fires the graph on every POST, including CopilotKit state-sync
    requests that carry no user messages. Returning a non-None dict here replaces
    the model call and routes the graph to END via the normal should_continue check.
    """
    has_human = any(isinstance(m, HumanMessage) for m in state.get("messages", []))
    if not has_human:
        return {"messages": [AIMessage(content="")]}
    return None


graph = create_react_agent(
    model=get_chat_model(),
    tools=atlas_tools,
    state_schema=AtlasState,
    prompt=build_prompt,
    checkpointer=MemorySaver(),
    pre_model_hook=skip_if_no_human_messages,
)
