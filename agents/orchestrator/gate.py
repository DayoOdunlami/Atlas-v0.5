"""
agents.orchestrator.gate
========================

HITL interrupt gate for deep / external queries.

When triage returns needs_gate=True, the orchestrator pauses here and
emits a LangGraph interrupt with a playback card.  The user can:
  - confirm    → proceed to full tool-calling loop
  - refine     → return to triage with amended query
  - decline    → return a minimal response without deep research

In the skeleton (D1.1) the interrupt payload is fully spec'd but the
actual LangGraph graph wiring comes in D1.2 when the full graph is built.

This module exports:
  build_gate_payload(triage_result) → dict   (the interrupt message shown to user)
  interpret_gate_response(user_reply) → GateDecision
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from agents.orchestrator.triage import TriageResult

GateDecision = Literal["confirm", "refine", "decline"]


@dataclass
class GatePayload:
    """Interrupt message surfaced in the CopilotKit frontend."""

    question: str
    """Clarifying sentence shown to the user."""

    research_plan: list[str]
    """Bullet-point preview of what tools will be called."""

    effort: str
    """Human-readable effort label."""

    outcome: str
    """Predicted outcome mode."""

    can_decline: bool = True
    """Whether the user can opt out of deep research."""


def build_gate_payload(triage: TriageResult) -> GatePayload:
    """
    Build the interrupt payload for a deep-query gate.

    The format pass will render this as a confirmation card in the
    CopilotKit frontend (D1.5).
    """
    plan_lines: list[str] = []

    if triage.outcome in ("diagnose", "act"):
        plan_lines.append("Search CPC corpus for matching projects (atlas.projects)")
        plan_lines.append("Extract evidence quality and coverage gaps")
    if triage.outcome in ("connect", "act"):
        plan_lines.append("Search cross-sector analogues (Graphiti / CICERONE)")
    if triage.outcome == "act":
        plan_lines.append("Compute NPV at HMT STPR 3.5%")
    if triage.effort == "deep":
        plan_lines.append("Run disconfirming red-team search (Exa)")
        plan_lines.append("Apply trust spine: citation guard + artifact QA")

    if not plan_lines:
        plan_lines.append("Search CPC corpus and synthesise a response")

    effort_labels = {
        "clarify": "quick clarification",
        "refine": "focused search",
        "analyze": "standard analysis",
        "deep": "deep research (~30–60s, external search included)",
    }

    return GatePayload(
        question=(
            f"This looks like a **{effort_labels.get(triage.effort, triage.effort)}** request "
            f"targeting the **{triage.outcome}** outcome. "
            "Want me to go ahead?"
        ),
        research_plan=plan_lines,
        effort=triage.effort,
        outcome=triage.outcome,
        can_decline=True,
    )


def interpret_gate_response(user_reply: str) -> GateDecision:
    """
    Parse a free-text user reply into a structured gate decision.

    Covers the common natural-language variants CopilotKit users type.
    """
    r = (user_reply or "").strip().lower()

    # Explicit declines
    decline_tokens = ("no", "stop", "cancel", "don't", "dont", "skip", "nevermind", "never mind")
    for tok in decline_tokens:
        if r == tok or r.startswith(tok + " "):
            return "decline"

    # Refinement intent
    refine_tokens = ("actually", "change", "instead", "different", "modify", "update", "edit")
    for tok in refine_tokens:
        if tok in r:
            return "refine"

    # Default: anything positive or ambiguous → confirm
    return "confirm"
