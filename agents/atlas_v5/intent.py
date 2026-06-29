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
    """Meta questions about Atlas as a product — chat-first, no corpus orient."""
    q = query.strip()
    if not q:
        return False
    return bool(_ATLAS_SELF_REFLECTION_RE.search(q))


def is_meta_chat_query(query: str) -> bool:
    """Chat-only meta turns — persona/analogy or Atlas self-assessment."""
    return is_identity_analogy_query(query) or is_atlas_self_reflection_query(query)


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


def is_connect_network_query(query: str) -> bool:
    q = query.strip()
    if not q:
        return False
    return bool(_CONNECT_RE.search(q))
