"""
Refine lane — patch prior render_model in place; short chat ack.
"""
from __future__ import annotations

import json
import os
import uuid
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage


def _prior_model(state: dict[str, Any]) -> dict[str, Any] | None:
    p = state.get("_prior_render_model")
    return dict(p) if isinstance(p, dict) else None


def _apply_patch(model: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    updated = dict(model)
    if patch.get("headline"):
        updated["headline"] = str(patch["headline"]).strip()
    if patch.get("insight_card"):
        updated["insight_card"] = str(patch["insight_card"]).strip()
    if patch.get("executive_summary"):
        updated["executive_summary"] = str(patch["executive_summary"]).strip()
        updated["insight_card"] = updated["executive_summary"]
    sections = dict(updated.get("sections") or {})
    for k, v in (patch.get("sections_patch") or {}).items():
        if v is not None:
            sections[str(k)] = str(v)
    updated["sections"] = sections
    blocks_data = dict(updated.get("blocks_data") or {})
    if patch.get("executive_summary"):
        es = dict(blocks_data.get("executive_summary") or {})
        es["summary"] = updated.get("executive_summary") or es.get("summary", "")
        es["caption"] = patch.get("executive_caption") or es.get("caption", "")
        blocks_data["executive_summary"] = es
        blocks_data["decision_spine"] = {
            "summary": es["summary"],
            "headline": updated.get("headline", ""),
            "confidence_tier": updated.get("confidence_tier", "Indicative"),
        }
    updated["blocks_data"] = blocks_data
    updated["refined"] = True
    return updated


def node_refine_artifact(state: dict[str, Any]) -> dict[str, Any]:
    query = (state.get("query") or "").strip()
    prior = _prior_model(state)
    if not prior:
        return {"turn_lane": "analyze"}

    prior_json = json.dumps({
        "headline": prior.get("headline"),
        "insight_card": prior.get("insight_card"),
        "executive_summary": prior.get("executive_summary"),
        "sections": prior.get("sections"),
        "outcome": prior.get("outcome"),
    }, indent=2)[:10000]

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return {"turn_lane": "analyze"}

    system = """You are Atlas Workbench. The user wants to refine the artifact on screen.
Return JSON ONLY:
{
  "headline": "optional updated headline",
  "insight_card": "optional updated insight (2-3 sentences)",
  "executive_summary": "optional updated executive summary",
  "sections_patch": {"section_key": "updated content"},
  "acknowledgment": "one sentence for chat"
}
Only include fields that should change."""

    try:
        from langchain_anthropic import ChatAnthropic

        llm = ChatAnthropic(model=os.getenv("INTENT_MODEL_NAME", "claude-haiku-4-5"), api_key=api_key, max_tokens=800, temperature=0)
        response = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"Current artifact:\n{prior_json}\n\nRefinement request: {query}"),
        ])
        content = str(response.content)
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        patch = json.loads(content.strip())
    except Exception as exc:
        return {
            "messages": [AIMessage(
                content=f"I couldn't refine the artifact: {exc}. Try rephrasing or run a new analysis.",
                id=str(uuid.uuid4()),
            )],
            "render_model": prior,
            "_is_conversational": True,
        }

    updated = _apply_patch(prior, patch)
    updated["refined"] = True
    updated["turn_lane"] = "refine"

    return {
        "render_model": updated,
        "_is_conversational": False,
        "turn_lane": "refine",
        "outcome": updated.get("outcome") or state.get("outcome"),
    }
