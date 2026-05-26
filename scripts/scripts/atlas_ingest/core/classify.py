"""Classification utilities for the ingest engine.

Four classifiers:
  1. classify_relevance  — relevance tag (relevant/borderline/irrelevant)
  2. classify_route      — for ambiguous GOV.UK doc types: live_call vs knowledge_document
  3. infer_modes_themes  — populate modes[] and themes[] legacy columns for knowledge_documents
  4. classify_taxonomy   — Haiku-against-registry: produces labels for atlas.classifications
                           using the full classifier_prompt stored in atlas.taxonomies

The relevance prompt is the same across all sources (previously duplicated in
ingest_fts_tenders.py and ingest_live_calls.py).

The route prompt follows the reviewer's recommendation: ask "new opportunity
you can apply to" vs "outcome/general announcement", defaulting to
knowledge_document when ambiguous.

Modes/themes lexicons are ported from src/lib/kb/retrieval-strategies.ts and
used for the legacy text[] columns on knowledge_documents. The canonical
classification store is atlas.classifications, written by classify_taxonomy().
"""

from __future__ import annotations

import re
import time
from typing import Optional

from anthropic import Anthropic

HAIKU_MODEL = "claude-haiku-4-5"

# Shared relevance classifier prompt — matches existing FTS/Horizon prompt.
RELEVANCE_SYSTEM = (
    "You classify UK public sector tender notices for relevance to transport "
    "innovation, autonomous systems, clean energy, and advanced engineering. "
    "Transport innovation includes: rail, aviation, maritime, highways, autonomous vehicles, "
    "drones/UAS, electrification, digital infrastructure, smart cities, decarbonisation, "
    "and related technology R&D and procurement. "
    "Operational procurement (housing maintenance, food safety, laundry, fire alarm "
    "servicing, insurance compliance, catering, cleaning) is irrelevant even if from a "
    "transport body. "
    "Reply with exactly one of: relevant, borderline, irrelevant "
    "Then on a new line, one sentence explaining why (max 15 words)."
)

# Routing classifier prompt for ambiguous GOV.UK doc types.
ROUTE_SYSTEM = (
    "You determine how a UK government content item should be stored in an innovation database. "
    "Read the title and description, then decide: "
    "Is this announcing a NEW funding opportunity or competition that organisations can CURRENTLY APPLY TO? "
    "Or is this an announcement about the OUTCOME of an already-completed process, "
    "a policy statement, general news, or a historical record? "
    "Reply with exactly one of: live_call, knowledge_document "
    "Then on a new line, one sentence explaining why (max 15 words). "
    "When in doubt, use knowledge_document."
)

# Mode and theme lexicons ported from src/lib/kb/retrieval-strategies.ts
_MODE_PATTERNS: dict[str, re.Pattern] = {
    "rail": re.compile(r"\brail|cp7|network rail|orr\b", re.IGNORECASE),
    "aviation": re.compile(
        r"\baviation|airport|jet zero|saf\b|caa\b|flight|aam\b|evtol\b", re.IGNORECASE
    ),
    "maritime": re.compile(
        r"\bmaritime\b|\bports?\b|shipping|vessel|mca\b|harbour", re.IGNORECASE
    ),
    "hit": re.compile(
        r"\bhighways?|integrated transport|ris3\b|road|vehicles?|self-driving|automated vehicles?\b",
        re.IGNORECASE,
    ),
    "data_digital": re.compile(
        r"\bdata\b|\bdigital\b|\btestbed britain\b|\binnovation passport(s)?\b|\binteroperab",
        re.IGNORECASE,
    ),
}

_THEME_PATTERNS: dict[str, re.Pattern] = {
    "autonomy": re.compile(
        r"\bautonom|automation|driverless|self-driving|drone|cav\b", re.IGNORECASE
    ),
    "decarbonisation": re.compile(
        r"\bdecarbon|net zero|hydrogen|saf\b|electrification|emission", re.IGNORECASE
    ),
    "people_experience": re.compile(
        r"\bpassenger|accessib|inclusion|safety|customer|people\b", re.IGNORECASE
    ),
    "hubs_clusters": re.compile(
        r"\bhub|cluster|intermodal|place|placemaking|region\b", re.IGNORECASE
    ),
    "planning_operation": re.compile(
        r"\bplanning|operations?|delivery plan|system integration|resilience\b",
        re.IGNORECASE,
    ),
    "industry": re.compile(
        r"\bindustry|supply chain|commercial|market|investment|funding\b", re.IGNORECASE
    ),
    "data_infrastructure": re.compile(
        r"\bdata infrastructure|data layer|data platform\b", re.IGNORECASE
    ),
    "assurance_trust": re.compile(
        r"\bassurance|trust|portable trust|conformance|verification|provenance\b",
        re.IGNORECASE,
    ),
    "interoperability": re.compile(
        r"\binteroperab|standards?|exchange|semantic|schema|federat", re.IGNORECASE
    ),
    "testbeds_innovation": re.compile(
        r"\btestbed|pilot|demonstrat|trial|sandbox|innovation passport", re.IGNORECASE
    ),
    "governance_stewardship": re.compile(
        r"\bgovernance|stewardship|policy boundary|sovereign|accountability\b",
        re.IGNORECASE,
    ),
}

_CROSS_CUTTING_MODES = ["rail", "aviation", "maritime", "hit"]


def classify_relevance(
    client: Anthropic,
    title: str,
    funder: Optional[str],
    description: Optional[str],
    sleep_secs: float = 0.05,
) -> tuple[str, str]:
    """Return (tag, reason) where tag is 'relevant'|'borderline'|'irrelevant'.

    Defaults to 'borderline' on parse failure.
    """
    user_msg = (
        f"Title: {title}\n"
        f"Funder: {funder or 'Unknown'}\n"
        f"Description: {(description or '')[:400] or 'No description'}"
    )
    msg = client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=80,
        system=RELEVANCE_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )
    if sleep_secs:
        time.sleep(sleep_secs)
    return _parse_tag_reason(msg, default_tag="borderline")


def classify_route(
    client: Anthropic,
    title: str,
    description: Optional[str],
    sleep_secs: float = 0.05,
) -> str:
    """Return 'live_call' or 'knowledge_document' for ambiguous GOV.UK types.

    Used for press_release and news_story doc types where keyword matching
    cannot reliably distinguish 'new opportunity' from 'award announcement'.
    Defaults to 'knowledge_document' on parse failure.
    """
    user_msg = (
        f"Title: {title}\n"
        f"Description: {(description or '')[:400] or 'No description'}"
    )
    msg = client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=60,
        system=ROUTE_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )
    if sleep_secs:
        time.sleep(sleep_secs)
    tag, _ = _parse_tag_reason(msg, default_tag="knowledge_document")
    return tag if tag in ("live_call", "knowledge_document") else "knowledge_document"


def infer_modes_themes(
    title: str, description: Optional[str]
) -> tuple[list[str], list[str]]:
    """Infer modes[] and themes[] from text using the KB retrieval lexicons.

    Returns (modes, themes). Both may be empty lists. Falls back to all
    cross-cutting modes if no specific mode matches (matching the TypeScript
    behaviour in retrieval-strategies.ts for the "generic_innovation" case).
    """
    text = f"{title} {description or ''}"
    modes = [name for name, rx in _MODE_PATTERNS.items() if rx.search(text)]
    themes = [name for name, rx in _THEME_PATTERNS.items() if rx.search(text)]
    if not modes:
        modes = _CROSS_CUTTING_MODES[:]
    return modes, themes


def classify_taxonomy(
    client: Anthropic,
    title: str,
    description: Optional[str],
    taxonomy_id: str,
    valid_labels: list[str],
    classifier_prompt: str,
    sleep_secs: float = 0.05,
) -> tuple[list[str], str]:
    """Classify a row against a specific taxonomy using its stored Haiku prompt.

    Returns (matched_labels, rationale). matched_labels is a subset of
    valid_labels. Returns ([], '') on parse failure or API error so callers
    can degrade gracefully.

    The taxonomy classifier_prompt (from atlas.taxonomies) asks for JSON:
      {"labels": ["Label A", "Label B"], "rationale": "one sentence"}

    We validate the returned labels against valid_labels to prevent hallucinated
    values from reaching atlas.classifications.
    """
    import json as _json

    user_msg = (
        f"Title: {title}\n"
        f"Description: {(description or '')[:600] or 'No description'}"
    )
    try:
        msg = client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=200,
            system=classifier_prompt,
            messages=[{"role": "user", "content": user_msg}],
        )
        if sleep_secs:
            time.sleep(sleep_secs)
        raw_text = ""
        if msg.content and msg.content[0].type == "text":
            raw_text = msg.content[0].text.strip()
        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            raw_text = "\n".join(
                ln for ln in raw_text.splitlines()
                if not ln.startswith("```")
            ).strip()
        parsed = _json.loads(raw_text)
        returned_labels = parsed.get("labels") or []
        rationale = (parsed.get("rationale") or "")[:500]
        # Validate: only keep labels that are in the taxonomy's label list
        valid_set = {lbl.lower(): lbl for lbl in valid_labels}
        cleaned = [
            valid_set[rl.lower()]
            for rl in returned_labels
            if isinstance(rl, str) and rl.lower() in valid_set
        ]
        return cleaned, rationale
    except Exception as exc:
        return [], f"classify_taxonomy error: {exc}"[:500]


def _parse_tag_reason(msg, default_tag: str) -> tuple[str, str]:
    text = ""
    if msg.content and msg.content[0].type == "text":
        text = msg.content[0].text.strip()
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    tag = default_tag
    if lines:
        first = lines[0].lower()
        for candidate in ("relevant", "borderline", "irrelevant", "live_call", "knowledge_document"):
            if first.startswith(candidate):
                tag = candidate
                break
    reason = lines[1][:500] if len(lines) > 1 else ""
    return tag, reason
