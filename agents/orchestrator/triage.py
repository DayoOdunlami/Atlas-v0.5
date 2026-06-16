"""
agents.orchestrator.triage
==========================

Cheap effort/ambiguity/cost classifier — runs before the tool-calling loop.

Intent: answer "how much work does this query need?" without calling a large model.
Uses a fast model (or lightweight heuristics when no API key is available in tests).

Output: TriageResult with:
  effort      clarify | refine | analyze | deep
  outcome     orient | connect | diagnose | act | defend   (best guess)
  needs_gate  True if HITL confirm should fire before deep external search
  notes       short human-readable rationale (shown in live log)
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

EffortBucket = Literal["clarify", "refine", "analyze", "deep"]
Outcome = Literal["orient", "connect", "diagnose", "act", "defend"]


# ---------------------------------------------------------------------------
# Heuristic patterns — intent classification without an LLM call.
# These fire first; LLM triage is reserved for genuinely ambiguous queries.
# ---------------------------------------------------------------------------

_CLARIFY_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^\s*(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure)\s*[!.?]*\s*$", re.I),
    re.compile(r"^.{0,15}$"),  # very short queries  (<16 chars)
]

_DEEP_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bbusiness case\b|\binvestment brief\b|\bfive case\b|\bfull brief\b", re.I),
    re.compile(r"\bfalsif|\bdisconfirm|\bred.?team\b|\bchallenge.*evidence\b", re.I),
    re.compile(r"\bnpv\b|\bbenefit.cost\b|\bBCR\b|\bSTRP\b|\bappraisal\b", re.I),
    re.compile(r"\bfull.*research\b|\bcomprehensive.*report\b|\bdetailed.*analysis\b", re.I),
]

_OUTCOME_PATTERNS: list[tuple[Outcome, list[re.Pattern[str]]]] = [
    ("orient", [
        re.compile(r"\blandscape\b|\boverview\b|\bwhat.*exist\b|\bwhat.*happening\b|\bexplore\b|\bsurvey\b", re.I),
        re.compile(r"\bwhat.*is\b.{0,40}\b(sector|space|field|domain|market)\b", re.I),
        re.compile(r"\bover-represented\b|\bportfolio\b|\bwedge\b", re.I),
    ]),
    ("act", [
        re.compile(r"\bbusiness case\b|\binvestment (?:case|brief)\b|\beconomic case\b|\bnpv\b|\bwhat.*should.*do\b|\bnext.*step\b|\baction\b|\brecommend", re.I),
        re.compile(r"\bwhat.*bid\b|\bshould.*bid\b|\bworth.*bid\b|\bfive.case\b", re.I),
        re.compile(r"\bshould.*pursue\b|\bpursue this\b|\bminimum viable\b|\bpursuit plan\b", re.I),
        re.compile(r"\bnext 90 days\b|\b90.day\b|\bwhat should we do next\b", re.I),
        re.compile(r"\bassumptions?.*(?:npv|bcr)\b|\b(?:npv|bcr).*assumptions?\b", re.I),
    ]),
    ("defend", [
        re.compile(r"\bdefend\b|\bscrutin\b", re.I),
        re.compile(
            r"\b(?:evidence|claim).{0,35}challenge\b|\bchallenge.{0,35}(?:evidence|claim)\b",
            re.I,
        ),
        re.compile(r"\bobjections?\b|\bboard.*pack\b|\bpush.?back\b", re.I),
        re.compile(r"\bhold.*up\b|\bstand.*up\b|\bmake.*case\b|\bcritiq\b", re.I),
        re.compile(r"\bwhy did.*conclud(?:e|ed|ing)?\b|\bevidence trail\b|\blikely objections\b", re.I),
    ]),
    ("diagnose", [
        re.compile(r"\bgaps?\b|\bmissing\b|\beveridence\b|\bweak\b|\bcoverage\b|\bwhat.*have\b|\bwhat.*lack\b", re.I),
        re.compile(r"\bdiagnos\b|\baudit\b|\bassess.*capabilit\b|\benrich\b", re.I),
        re.compile(r"\bblockers?\b|\breframes?\b|\bbiggest gap\b", re.I),
        re.compile(r"\bwhat.*collect\b|\bcollect next\b|\bevidence plan\b", re.I),
        re.compile(r"\bstrong at\b|\bproven versus\b|\bself-reported\b|\bcapabilit.*(?:proven|evidence)\b", re.I),
    ]),
    ("connect", [
        re.compile(r"\banalog\b|\btransfer(?:s)?\b|\bsector.*match\b|\bwho.*else\b|\bsimilar.*to\b|\bfunding.*call\b|\bopportunit", re.I),
        re.compile(r"\b(can|could|should).*work.*in\b|\bfit.*for\b|\bappl.*in\b|\bfit this funding\b", re.I),
        re.compile(r"\blive calls?\b|\bcapabilit.*profile\b|\bclosest.*(?:fit|profile|capabilit)\b", re.I),
        re.compile(r"\bwhich.*(?:call|bid|fund).*closest\b", re.I),
        re.compile(r"\bcompare\b.*\b(?:calls|options)\b|\brank\b.*\b(?:effort|first)\b|\bdeserves effort\b", re.I),
        re.compile(r"\bignore despite\b|\bthematic appeal\b", re.I),
    ]),
]


@dataclass
class TriageResult:
    effort: EffortBucket
    outcome: Outcome
    needs_gate: bool
    notes: str
    raw_query: str


def triage_query(query: str) -> TriageResult:
    """
    Classify a user query deterministically (no LLM).

    The orchestrator graph calls this in the triage node.  When the result
    is 'deep' with needs_gate=True, the graph fires a HITL interrupt before
    proceeding to the tool-calling loop.
    """
    q = query.strip()

    # 1. clarify — too ambiguous or conversational to proceed
    for pat in _CLARIFY_PATTERNS:
        if pat.match(q):
            return TriageResult(
                effort="clarify",
                outcome="orient",
                needs_gate=False,
                notes="Query is too short or conversational — ask for more context.",
                raw_query=q,
            )

    # 2. deep — needs heavy LLM + external search + falsification
    for pat in _DEEP_PATTERNS:
        if pat.search(q):
            return TriageResult(
                effort="deep",
                outcome=_classify_outcome(q),
                needs_gate=True,
                notes="Detected deep-research signal — will gate before external search.",
                raw_query=q,
            )

    # 3. outcome classification determines analyze vs refine
    outcome = _classify_outcome(q)

    # refine — short/simple queries that need a focused search but no deep research
    if len(q.split()) <= 8 and outcome == "orient":
        return TriageResult(
            effort="refine",
            outcome=outcome,
            needs_gate=False,
            notes="Short orientation query — fast corpus search, no gate.",
            raw_query=q,
        )

    return TriageResult(
        effort="analyze",
        outcome=outcome,
        needs_gate=False,
        notes=f"Standard analysis query — outcome={outcome}.",
        raw_query=q,
    )


def _classify_outcome(query: str) -> Outcome:
    # Phase 3 gate — transfer + evidence queries route connect before broad patterns
    if re.search(r"\btransfer\b", query, re.I) and re.search(r"\bevidence\b", query, re.I):
        return "connect"
    for outcome, patterns in _OUTCOME_PATTERNS:
        for pat in patterns:
            if pat.search(query):
                return outcome
    return "orient"  # default fallback
