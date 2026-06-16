"""
agents.eval.judge
=================

LLM-as-judge + heuristic fallback for orchestrator eval traces (Phase C).

Rubric dimensions (0–5):
  - Evidence honesty
  - Decision clarity
  - Gap surfacing
  - Corpus-first balance
  - Actionability
"""
from __future__ import annotations

import json
import os
from typing import Any

JUDGE_MODEL = "claude-sonnet-4-6"

RUBRIC_CRITERIA = [
    "Evidence honesty",
    "Decision clarity",
    "Gap surfacing",
    "Corpus-first balance",
    "Actionability",
]


def heuristic_judge(render_model: dict[str, Any], query: str = "") -> dict[str, Any]:
    """Structural proxy scores when no LLM key — NOT semantic quality."""
    scores: dict[str, int] = {}
    tier = render_model.get("confidence_tier", "Speculative")
    citations = render_model.get("corpus_citations") or []
    blocks = render_model.get("render_blocks") or []
    block_types = {b.get("type") for b in blocks}
    outcome = render_model.get("outcome", "orient")
    headline = render_model.get("headline", "")
    insight = render_model.get("insight_card", "")

    # Evidence honesty — tier vs citations
    tier_map = {"Speculative": 2, "Indicative": 3, "Supported": 4, "Robust": 5}
    base = tier_map.get(tier, 1)
    if len(citations) == 0 and tier in ("Supported", "Robust"):
        scores["Evidence honesty"] = 1
    else:
        scores["Evidence honesty"] = min(5, base)

    # Decision clarity — headline + recommendation block
    has_rec = "RecommendationConfidence" in block_types
    if len(headline) >= 20 and len(insight) >= 30:
        scores["Decision clarity"] = 4 if has_rec else 3
    elif len(headline) >= 10:
        scores["Decision clarity"] = 2
    else:
        scores["Decision clarity"] = 1

    # Gap surfacing — diagnose/connect blocks
    gap_blocks = {"TransferLanes", "DimensionGap", "MatchBench"} & block_types
    if outcome in ("diagnose", "connect") and gap_blocks:
        scores["Gap surfacing"] = 4 if len(gap_blocks) >= 2 else 3
    elif outcome in ("diagnose", "connect"):
        scores["Gap surfacing"] = 2
    else:
        scores["Gap surfacing"] = 3

    # Corpus-first — citations present, no fake external-only
    if len(citations) >= 3:
        scores["Corpus-first balance"] = 4
    elif len(citations) >= 1:
        scores["Corpus-first balance"] = 3
    else:
        scores["Corpus-first balance"] = 2 if tier == "Speculative" else 1

    # Actionability — act blocks or action plan
    if "ActionPlan" in block_types:
        scores["Actionability"] = 4
    elif outcome == "act" and "EconomicCase" in block_types:
        scores["Actionability"] = 3
    elif outcome in ("diagnose", "connect"):
        lanes = (render_model.get("blocks_data") or {}).get("transfer_lanes", {}).get("lanes", [])
        has_actions = any(l.get("note") for l in lanes)
        scores["Actionability"] = 3 if has_actions else 2
    else:
        scores["Actionability"] = 2

    overall = round(sum(scores.values()) / len(scores), 2)
    return {
        "method": "heuristic",
        "scores": scores,
        "overall": overall,
        "passed": overall >= 3.0,
    }


def llm_judge(render_model: dict[str, Any], query: str) -> dict[str, Any]:
    """Score with claude-sonnet-4-6 when ANTHROPIC_API_KEY is set."""
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        result = heuristic_judge(render_model, query)
        result["note"] = "ANTHROPIC_API_KEY not set — heuristic only"
        return result

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)
        payload = {
            "query": query,
            "outcome": render_model.get("outcome"),
            "confidence_tier": render_model.get("confidence_tier"),
            "headline": render_model.get("headline"),
            "insight_card": render_model.get("insight_card"),
            "block_types": [b.get("type") for b in render_model.get("render_blocks") or []],
            "citation_count": len(render_model.get("corpus_citations") or []),
            "sections": render_model.get("sections"),
        }
        prompt = f"""You evaluate UK government innovation intelligence orchestrator outputs.

Score each criterion 0–5 for this response:
1. Evidence honesty — tier matches evidence; no overclaiming
2. Decision clarity — user can state go/no-go/refine in one sentence
3. Gap surfacing — missing evidence and next collection steps are clear
4. Corpus-first balance — corpus used appropriately; Speculative when thin
5. Actionability — concrete next steps where outcome demands them

QUERY: {query}

RESPONSE:
{json.dumps(payload, indent=2)}

Reply ONLY with JSON:
{{"Evidence honesty": 3, "Decision clarity": 3, "Gap surfacing": 3, "Corpus-first balance": 3, "Actionability": 3}}"""

        message = client.messages.create(
            model=JUDGE_MODEL,
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        content = message.content[0].text.strip()
        if "```" in content:
            content = content.split("```")[1].split("```")[0]
            if content.startswith("json"):
                content = content[4:]
        scores_raw = json.loads(content.strip())
        scores = {
            c: max(0, min(5, int(scores_raw.get(c, 0))))
            for c in RUBRIC_CRITERIA
        }
        overall = round(sum(scores.values()) / len(scores), 2)
        return {
            "method": "llm",
            "model": JUDGE_MODEL,
            "scores": scores,
            "overall": overall,
            "passed": overall >= 3.0,
        }
    except Exception as exc:
        result = heuristic_judge(render_model, query)
        result["method"] = "heuristic_fallback"
        result["llm_error"] = str(exc)
        return result


def judge_orchestrator_trace(render_model: dict[str, Any], *, query: str = "") -> dict[str, Any]:
    """Public entry — prefers LLM, falls back to heuristic."""
    prefer_heuristic = os.getenv("EVAL_HEURISTIC_JUDGE_ONLY", "").lower() in ("1", "true", "yes")
    if prefer_heuristic:
        return heuristic_judge(render_model, query)
    return llm_judge(render_model, query)
