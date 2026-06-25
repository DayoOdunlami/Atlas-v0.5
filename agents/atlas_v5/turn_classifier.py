"""Atlas v5 — light-model turn router (Haiku).

Routing ONLY: chat | clarify | substantive + outcome_hint.
Reply content is deep-pass (Sonnet) or heuristic fallback — not Haiku.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from typing import Any, Literal

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from agents.atlas_v5.chat_router import classify_follow_up
from agents.atlas_v5.intent import (
    has_declared_uncertainty_cue,
    is_connect_network_query,
    is_j1t1_orient_query,
    is_substantive_canvas_query,
)
from agents.atlas_v5.j1t1_corpus import J1T1_QUERY_PHRASE

logger = logging.getLogger(__name__)

INTENT_MODEL = os.getenv("INTENT_MODEL_NAME", "claude-haiku-4-5")
OutcomeHint = Literal["orient", "connect", "diagnose", "act", "defend", "find_path"]
TurnRoute = Literal["chat", "clarify", "substantive"]


class TurnClassifierOutput(BaseModel):
    route: TurnRoute = Field(
        description=(
            "chat = canvas unchanged (greeting, off-topic, meta); "
            "clarify = one question only; "
            "substantive = update canvas (landscape, network, evidence, find_path)"
        ),
    )
    outcome_hint: OutcomeHint | None = Field(
        default=None,
        description=(
            "When substantive only: orient | connect | diagnose | act | defend | find_path"
        ),
    )
    reasoning: str = ""


_CLASSIFIER_SYSTEM = """You are a cheap router for Atlas v5 (/atlas). Classify ONLY — do not write the user reply.

Routes:
- **chat** — Greetings alone, thanks, off-topic trivia, meta about canvas, clear/reset canvas.
  Canvas does NOT update.
- **clarify** — In-scope but too vague for a canvas turn; one follow-up needed. Canvas does NOT update.
- **substantive** — Landscape, network, evidence, funding, strategy, or find-my-path questions
  that should refresh the canvas.

Rules:
- "hello" alone → chat
- "latest Haribo innovations" → chat (off-topic redirect handled downstream)
- Declared uncertainty ("not sure what I'm asking", "help me figure out", "got an idea but…")
  → **substantive**, outcome_hint **find_path** (NOT chat-only)
- "state of play on rail decarbonisation" → substantive, outcome_hint orient
- Network / ecosystem / partners → substantive, outcome_hint connect
- Do NOT judge assumptions or write chat content — routing only.

Respond ONLY with JSON matching the schema."""


@dataclass
class TurnDecision:
    route: TurnRoute
    outcome_hint: OutcomeHint | None = None
    reasoning: str = ""
    source: Literal["haiku", "heuristic"] = "heuristic"


def _format_canvas_context(current_spec: dict[str, Any] | None) -> str:
    if not current_spec:
        return "## Canvas context\n(none)\n"
    return (
        "## Canvas context\n"
        f"mode: {current_spec.get('mode', '?')}\n"
        f"instrument: {(current_spec.get('instrument') or {}).get('recipe', 'none')}\n"
    )


def _haiku_classify(
    query: str,
    current_spec: dict[str, Any] | None = None,
) -> TurnClassifierOutput | None:
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from langchain_anthropic import ChatAnthropic

        llm = ChatAnthropic(
            model=INTENT_MODEL,
            api_key=api_key,
            max_tokens=200,
            temperature=0,
        )
        structured = llm.with_structured_output(TurnClassifierOutput)
        user = f"{_format_canvas_context(current_spec)}\nUser message:\n{query}"
        return structured.invoke(
            [SystemMessage(content=_CLASSIFIER_SYSTEM), HumanMessage(content=user)],
        )
    except Exception as exc:
        logger.warning("Haiku turn router failed: %s", exc)
        return None


def _infer_outcome_hint(query: str) -> OutcomeHint:
    if has_declared_uncertainty_cue(query):
        return "find_path"
    if is_connect_network_query(query):
        return "connect"
    if is_j1t1_orient_query(query) or query.lower() == J1T1_QUERY_PHRASE.lower():
        return "orient"
    ql = query.lower()
    if re.search(r"\bgap|blindspot|missing|thin evidence|diagnos", ql):
        return "diagnose"
    if re.search(r"\bdefend|scrutin|objection|challenge", ql):
        return "defend"
    if re.search(r"\bact|next step|pursue|recommend|scale|partner|funding fit", ql):
        return "act"
    return "orient"


def _find_path_decision(reasoning: str, *, source: Literal["haiku", "heuristic"]) -> TurnDecision:
    return TurnDecision(
        route="substantive",
        outcome_hint="find_path",
        reasoning=reasoning,
        source=source,
    )


def classify_turn_heuristic(
    query: str,
    current_spec: dict[str, Any] | None = None,
) -> TurnDecision:
    q = query.strip()
    if not q:
        return TurnDecision(route="chat", source="heuristic")

    if has_declared_uncertainty_cue(q):
        return _find_path_decision("C1: declared uncertainty → find_path", source="heuristic")

    if is_connect_network_query(q) or is_j1t1_orient_query(q):
        return TurnDecision(
            route="substantive",
            outcome_hint=_infer_outcome_hint(q),
            reasoning="Heuristic: orient/connect pattern",
            source="heuristic",
        )

    if classify_follow_up(q, current_spec) == "chat_only":
        return TurnDecision(route="chat", source="heuristic")

    return TurnDecision(
        route="substantive",
        outcome_hint=_infer_outcome_hint(q),
        source="heuristic",
    )


def classify_turn(
    query: str,
    current_spec: dict[str, Any] | None = None,
) -> TurnDecision:
    q = (query or "").strip()
    if not q:
        return TurnDecision(route="chat", source="heuristic")

    # C1 precedence — declared uncertainty beats domain keyword and Haiku chat misroutes.
    if has_declared_uncertainty_cue(q):
        return _find_path_decision("C1: declared uncertainty → find_path", source="heuristic")

    if re.match(r"^\s*(hi|hello|hey)[\s,—-]+", q, re.I) and len(q.split()) > 4:
        substantive = re.sub(r"^\s*(hi|hello|hey)[\s,—-]+", "", q, flags=re.I).strip()
        if substantive and classify_follow_up(substantive, current_spec) == "canvas_update":
            hint = _infer_outcome_hint(substantive)
            return TurnDecision(
                route="substantive",
                outcome_hint=hint,
                reasoning="Greeting stripped; substantive tail",
                source="heuristic",
            )

    parsed = _haiku_classify(q, current_spec)
    if parsed is None:
        return classify_turn_heuristic(q, current_spec)

    if parsed.route in ("chat", "clarify"):
        if has_declared_uncertainty_cue(q):
            return _find_path_decision(
                f"C1 override: uncertainty cue (Haiku said {parsed.route})",
                source="heuristic",
            )
        if is_substantive_canvas_query(q):
            return TurnDecision(
                route="substantive",
                outcome_hint=_infer_outcome_hint(q),
                reasoning=(
                    f"Heuristic override: in-domain canvas query "
                    f"(Haiku said {parsed.route})"
                ),
                source="heuristic",
            )
        return TurnDecision(
            route=parsed.route,
            reasoning=parsed.reasoning or "Haiku route",
            source="haiku",
        )

    hint = parsed.outcome_hint or _infer_outcome_hint(q)
    if has_declared_uncertainty_cue(q):
        hint = "find_path"
    return TurnDecision(
        route="substantive",
        outcome_hint=hint,
        reasoning=parsed.reasoning or "Haiku substantive",
        source="haiku",
    )
