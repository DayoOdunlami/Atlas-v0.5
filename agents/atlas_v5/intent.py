"""Atlas v5 query intent — shared by run_turn and chat_router."""

from __future__ import annotations

import re

from agents.atlas_v5.j1t1_corpus import J1T1_QUERY_PHRASE

_J1T1_RE = re.compile(
    r"rail\s+decarb|decarboni[sz]ation.*rail|state\s+of\s+play.*rail",
    re.I,
)

_CONNECT_RE = re.compile(
    r"\b(connect|network|ecosystem|relationship|consortium|bridge|map|who works|"
    r"collaborat|partner|graph|actors?|supply chain|landscape)\b",
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


def has_declared_uncertainty_cue(query: str) -> bool:
    """C1 route signal — declared uncertainty about the question itself (not advisor elicit)."""
    q = query.strip()
    if not q:
        return False
    return bool(_UNCERTAINTY_CUE_RE.search(q))


def is_substantive_canvas_query(query: str) -> bool:
    """True when the message should refresh the canvas (in-domain strategic ask)."""
    q = query.strip()
    if not q or _OFF_TOPIC_RE.search(q):
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


def is_connect_network_query(query: str) -> bool:
    q = query.strip()
    if not q:
        return False
    return bool(_CONNECT_RE.search(q))
