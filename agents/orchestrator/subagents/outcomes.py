"""
agents.orchestrator.subagents.outcomes
=======================================

Outcome-mode system prompt injections and format hints.

The orchestrator's loop node selects the appropriate prompt fragment and
preferred block order based on the triage outcome.  This keeps the graph
single while making each outcome's LLM behavior distinctly tuned.

D4.1  Orient   — landscape survey, what exists
D4.2  Connect  — opportunity routes, sector analogues
D4.3  Act      — decision-ready, business case
D4.4  Defend   — quality bar, scrutiny pack
Diagnose is covered by Phase 3 (agents/matcher/).
"""
from __future__ import annotations

from typing import Literal

Outcome = Literal["orient", "connect", "diagnose", "act", "defend"]


# ---------------------------------------------------------------------------
# Outcome system prompt injections
# ---------------------------------------------------------------------------

_ORIENT_PROMPT = """
You are mapping the innovation landscape for the user.

Your objective: answer "what exists?" — give a structured overview of the sector,
key players, themes, and CPC's position within it.

Required synthesis structure:
  headline:     A clear statement of what the landscape looks like
  insight_card: 2–3 sentence summary of the most important pattern
  sections:
    landscape_overview:  What this sector/theme looks like today
    key_players:         Organisations and initiatives worth knowing
    cpc_position:        Where CPC sits in this landscape
    emerging_signals:    Early-stage shifts or opportunities

Preferred blocks: context_card → opportunity_list → comparison_matrix → recommendation_confidence
"""

_CONNECT_PROMPT = """
You are finding sector analogues and opportunity routes for the user.

Your objective: answer "where does this travel?" — identify which other sectors
or funding calls this entity's capabilities could credibly play in.

Required synthesis structure:
  headline:     A statement of the best transfer opportunity
  insight_card: Why this analogue is credible
  sections:
    analogues:           Cross-sector entities doing similar things
    opportunity_routes:  Specific calls, programmes, or partnerships
    transfer_conditions: What must be true for the transfer to work
    priority_move:       The single highest-confidence opportunity

Preferred blocks: context_card → transfer_lanes → opportunity_list → match_bench → recommendation_confidence

When calling tools: use search_corpus to find analogues, then search_external if effort=deep.
"""

_ACT_PROMPT = """
You are building a decision-ready brief for the user.

Your objective: answer "what should we do?" — produce a crisp recommendation
with an economic rationale and a sequenced action plan.

Required synthesis structure:
  headline:     A direct recommendation (verb-first)
  insight_card: The key decision and why now
  sections:
    strategic_case:    Why this aligns with CPC's mission
    economic_case:     Cost, benefit, and NPV rationale (HMT STPR 3.5%)
    delivery_approach: How to execute (phases, partners, dependencies)
    risks_mitigations: Top 3 risks and mitigations

Preferred blocks: context_card → economic_case → action_plan → recommendation_confidence

Include npv_value and discount_rate fields (0.035) in your synthesis if economic data is available.
"""

_DEFEND_PROMPT = """
You are preparing a scrutiny-ready evidence pack for the user.

Your objective: answer "can this withstand challenge?" — map claims to evidence,
identify weaknesses pre-emptively, and prepare objection responses.

Required synthesis structure:
  headline:     A confident statement of the evidence position
  insight_card: Overall defensibility assessment
  sections:
    claim_inventory:    All major claims with evidence state
    potential_objections: Likely challenges and evidence-based responses
    confidence_floor:   The weakest claim and why it matters
    strengthening_actions: What would raise confidence tier

Preferred blocks: context_card → claim_ledger → provenance_trace → objection_response → recommendation_confidence

Apply falsification even for analyze-level queries in Defend mode.
"""

_DIAGNOSE_PROMPT = """
You are diagnosing capability gaps for the user.

Your objective: answer "what proof do we have?" — map CPC's evidence against
a requirement and identify what travels, what needs reframing, and what is missing.

Preferred blocks: context_card → evidence_state_summary → dimension_gap → match_bench → transfer_lanes → recommendation_confidence
"""

OUTCOME_PROMPTS: dict[Outcome, str] = {
    "orient": _ORIENT_PROMPT,
    "connect": _CONNECT_PROMPT,
    "diagnose": _DIAGNOSE_PROMPT,
    "act": _ACT_PROMPT,
    "defend": _DEFEND_PROMPT,
}

PREFERRED_BLOCKS: dict[Outcome, list[str]] = {
    "orient": ["context_card", "opportunity_list", "comparison_matrix", "recommendation_confidence"],
    "connect": ["context_card", "transfer_lanes", "opportunity_list", "match_bench", "recommendation_confidence"],
    "diagnose": ["context_card", "evidence_state_summary", "dimension_gap", "match_bench", "transfer_lanes", "recommendation_confidence"],
    "act": ["context_card", "economic_case", "action_plan", "recommendation_confidence"],
    "defend": ["context_card", "claim_ledger", "provenance_trace", "objection_response", "recommendation_confidence"],
}


def get_outcome_prompt(outcome: Outcome) -> str:
    return OUTCOME_PROMPTS.get(outcome, OUTCOME_PROMPTS["orient"])


def get_preferred_blocks(outcome: Outcome) -> list[str]:
    return PREFERRED_BLOCKS.get(outcome, PREFERRED_BLOCKS["orient"])
