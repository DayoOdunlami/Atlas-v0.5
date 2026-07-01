"""Atlas v5 query intent — shared by run_turn and chat_router."""

from __future__ import annotations

import re
from typing import Any, Protocol, Sequence

from agents.contracts.answer_spec import AnswerSpec

from agents.atlas_v5.j1t1_corpus import J1T1_QUERY_PHRASE


class _ClaimLike(Protocol):
    kind: str


_PRACTITIONER_PATH_RE = re.compile(
    r"\b("
    r"funding|fund|funds|grant|path|partner|sme|innovator|mileston|trial|"
    r"certification|realistic|apply|scale|route"
    r")\b",
    re.I,
)

_FOLLOWUP_REFERENCE_RE = re.compile(
    r"\b(like that|such an?|for (me|us|my|our)|someone like)\b",
    re.I,
)

_J1T1_RE = re.compile(
    r"rail\s+decarb|decarboni[sz]ation.*rail|state\s+of\s+play.*rail",
    re.I,
)

_CONNECT_RE = re.compile(
    r"\b(connect|network|ecosystem|relationship|consortium|bridge|map|who works|"
    r"collaborat|partner|graph|actors?|supply chain|landscape)\b",
    re.I,
)

_STRATEGY_ALIGNMENT_RE = re.compile(
    r"\b("
    r"align(?:ed|ment|s|ing)?|misalignment|overlap|strateg(?:y|ies|ic)|"
    r"theory of change|policy intent|delivery plan|better connected"
    r")\b",
    re.I,
)

_STRATEGY_ACTOR_RE = re.compile(
    r"\b("
    r"dft|department for transport|cpc|connected places catapult|"
    r"innovate uk|iuk|ukri|"
    r"dsit|mhclg|dluhc|nic|national infrastructure commission|desnz"
    r")\b",
    re.I,
)

_STRATEGY_FRAMEWORK_RE = re.compile(
    r"\b("
    r"better connected|strategic delivery plan|integrated transport|"
    r"uk transport strateg|national transport strateg|future of transport|"
    r"transport strategy"
    r")\b",
    re.I,
)

_STRATEGY_AUDIT_RE = re.compile(
    r"\b("
    r"(?:uk\s+)?transport\s+strateg\w*\s+align|"
    r"strateg\w*\s+align(?:ment|ing)?|"
    r"policy\s+align(?:ment|ing)?|"
    r"concordance|theory of change"
    r")\b",
    re.I,
)

_DOMAIN_ORIENT_RE = re.compile(
    r"\b(rail|aviation|maritime|hydrogen|decarboni[sz]ation|transport|"
    r"corpus|cpc|innovate uk|funding|state of play|opportunit|company|startup|"
    r"sme|product|service|innovation|assistive|mobility|grow|transfer|wewalk|"
    r"we\s+walk)\b",
    re.I,
)

_OFF_TOPIC_RE = re.compile(
    r"\b(weather|met office|football|recipe|cook|joke|horoscope)\b",
    re.I,
)

_UNCERTAINTY_CUE_RE = re.compile(
    r"\b("
    r"not\s+sure\s+what\s+i'?m\s+asking|"
    r"don'?t\s+know\s+what\s+i'?m\s+asking|"
    r"don'?t\s+know\s+where\s+to\s+start|"
    r"help\s+me\s+figure\s+out|"
    r"half.?formed|"
    r"working\s+through|"
    r"what\s+should\s+i\s+(even\s+)?be\s+asking|"
    r"got\s+(an?\s+)?\w+\s+idea\s+but"
    r")\b",
    re.I,
)

_IDENTITY_ANALOGY_RE = re.compile(
    r"\b("
    r"persona|analogy|analogous|metaphor|"
    r"who would (they|it|cpc) be|"
    r"what would (they|it|cpc) be|"
    r"who is cpc|what is cpc|"
    r"help me understand who cpc|"
    r"understand who cpc (are|is)|"
    r"like as a (person|character)|"
    r"best analogy"
    r")\b",
    re.I,
)


def is_identity_analogy_query(query: str) -> bool:
    """Persona / analogy / identity framing — chat-first, not corpus orient."""
    q = query.strip()
    if not q:
        return False
    return bool(_IDENTITY_ANALOGY_RE.search(q))


_ATLAS_SELF_REFLECTION_RE = re.compile(
    r"\b("
    r"justify your existence|undermine your existence|"
    r"developing you\b|put(?:ting)? money into (?:developing )?you|"
    r"what makes you different|where is your value|your value proposition|"
    r"weak offering|better to be avoided|"
    r"honest assessment.*(?:your|you|atlas)|"
    r"should cpc be putting|pivoting what you offer|"
    r"marketers got plenty of ai"
    r")\b",
    re.I,
)


def is_atlas_self_reflection_query(query: str) -> bool:
    """Meta questions about Atlas as a product — defend canvas, CPC-wide scope."""
    q = query.strip()
    if not q:
        return False
    return bool(_ATLAS_SELF_REFLECTION_RE.search(q))


_EXPLICIT_CANVAS_RE = re.compile(
    r"\b("
    r"answer in (?:the )?canvas|"
    r"put (?:it )?(?:on|in) (?:the )?canvas|"
    r"show (?:it )?(?:on|in) (?:the )?canvas|"
    r"render (?:on )?(?:the )?canvas|"
    r"update (?:the )?canvas|"
    r"(?:give|get) (?:me )?(?:an? )?answer (?:on|in) (?:the )?canvas"
    r")\b",
    re.I,
)


def is_explicit_canvas_request(query: str) -> bool:
    """User explicitly wants a structured canvas turn (overrides chat-only meta)."""
    q = query.strip()
    if not q:
        return False
    return bool(_EXPLICIT_CANVAS_RE.search(q))


def is_meta_chat_query(query: str) -> bool:
    """Chat-only meta turns — persona/analogy only (not Atlas self-assessment)."""
    return is_identity_analogy_query(query)


def has_declared_uncertainty_cue(query: str) -> bool:
    """C1 route signal — declared uncertainty about the question itself (not advisor elicit)."""
    q = query.strip()
    if not q:
        return False
    return bool(_UNCERTAINTY_CUE_RE.search(q))


def should_continue_find_path(
    query: str,
    session_claims: Sequence[_ClaimLike] | None,
) -> bool:
    """N+1 practitioner turns after declared uncertainty — keep T3, not R4 orient/act."""
    if not session_claims:
        return False
    if not any(c.kind == "uncertainty" for c in session_claims):
        return False
    q = query.strip()
    if not q:
        return False
    if has_declared_uncertainty_cue(q):
        return True
    if _FOLLOWUP_REFERENCE_RE.search(q):
        return True
    return bool(_PRACTITIONER_PATH_RE.search(q))


def is_substantive_canvas_query(query: str) -> bool:
    """True when the message should refresh the canvas (in-domain strategic ask)."""
    q = query.strip()
    if not q or _OFF_TOPIC_RE.search(q):
        return False
    if is_meta_chat_query(q):
        return False
    if is_connect_network_query(q) or is_j1t1_orient_query(q):
        return True
    if _DOMAIN_ORIENT_RE.search(q):
        return True
    return False


def is_j1t1_orient_query(query: str) -> bool:
    q = query.strip()
    if not q:
        return False
    if q.lower() == J1T1_QUERY_PHRASE.lower():
        return True
    return bool(_J1T1_RE.search(q))


def is_strategy_alignment_query(query: str) -> bool:
    """Cross-government strategy comparison — not corpus NetworkMap connect."""
    q = query.strip()
    if not q:
        return False
    if _STRATEGY_ALIGNMENT_RE.search(q) and (
        _STRATEGY_ACTOR_RE.search(q) or _STRATEGY_FRAMEWORK_RE.search(q)
    ):
        return True
    return bool(_STRATEGY_AUDIT_RE.search(q))


def is_strategy_thread_continuation(
    query: str,
    current_spec: dict | None,
) -> bool:
    """Keep diagnose mode on strategy-alignment thread follow-ups."""
    if not current_spec:
        return False
    prior_q = str(current_spec.get("query") or "")
    instrument = current_spec.get("instrument") or {}
    data = instrument.get("data") or {}
    subject_q = str(data.get("subjectQuery") or prior_q)
    scope = str(current_spec.get("scope") or "")
    prior_mode = str(current_spec.get("mode") or "")

    strategy_thread = (
        is_strategy_alignment_query(prior_q)
        or is_strategy_alignment_query(subject_q)
        or (
            prior_mode == "Diagnose"
            and instrument.get("recipe") == "EvidenceGapMatrix"
            and "STRATEGY" in scope.upper()
        )
    )
    if not strategy_thread:
        return False
    if is_strategy_alignment_query(query):
        return True
    ql = query.lower()
    if len(query.split()) <= 14 and re.search(
        r"\b("
        r"pillar|concordance|better connected|innovate uk|delivery plan|"
        r"alignment|overlap|that slice|more detail|those gaps|gap matrix"
        r")\b",
        ql,
    ):
        return True
    return False


def is_strategy_alignment_spec(spec: AnswerSpec | dict[str, Any]) -> bool:
    """True when turn is a strategy-alignment diagnose (query or skeleton flag)."""
    if isinstance(spec, dict):
        q = str(spec.get("query") or "")
        instrument = spec.get("instrument") or {}
        data = instrument.get("data") or {}
        scope = str(spec.get("scope") or "")
        return bool(
            is_strategy_alignment_query(q)
            or data.get("strategyAlignment")
            or "STRATEGY ALIGNMENT" in scope.upper()
        )
    q = str(getattr(spec, "query", "") or "")
    instrument = getattr(spec, "instrument", None)
    data = getattr(instrument, "data", None) if instrument else None
    scope = str(getattr(spec, "scope", "") or "")
    strategy_flag = bool(isinstance(data, dict) and data.get("strategyAlignment"))
    return bool(
        is_strategy_alignment_query(q)
        or strategy_flag
        or "STRATEGY ALIGNMENT" in scope.upper()
    )


def cap_strategy_alignment_tier(spec: AnswerSpec) -> AnswerSpec:
    """Strategy claims cannot exceed Indicative without pillar concordance."""
    if not is_strategy_alignment_spec(spec):
        return spec
    tier_order = ["Speculative", "Indicative", "Supported", "Robust"]
    if spec.tier not in tier_order:
        return spec
    if tier_order.index(spec.tier) <= tier_order.index("Indicative"):
        return spec
    cap = "Strategy alignment capped at Indicative — no published concordance"
    reason = spec.tierCapReason or cap
    if cap not in reason:
        reason = f"{reason} · {cap}"
    return spec.model_copy(update={"tier": "Indicative", "tierCapReason": reason})


def is_connect_network_query(query: str) -> bool:
    q = query.strip()
    if not q:
        return False
    if is_strategy_alignment_query(q):
        return False
    return bool(_CONNECT_RE.search(q))
