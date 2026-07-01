"""
Atlas v5 follow-up chat router — conversational vs canvas-update turns.

Reuses agents.base.is_conversational; adds artifact-aware replies for /atlas.
"""

from __future__ import annotations

import re
from typing import Any, Literal

from agents.atlas_v5.j1t1_corpus import J1T1_QUERY_PHRASE
from agents.atlas_v5.intent import (
    is_connect_network_query,
    is_explicit_canvas_request,
    is_meta_chat_query,
    is_j1t1_orient_query,
    is_substantive_canvas_query,
)
from agents.atlas_v5.showcase import (
    get_showcase_state,
    is_showcase_advance,
    is_showcase_menu_trigger,
    parse_domain_selection,
)
from agents.base import is_conversational
from agents.contracts.answer_spec import AnswerSpec

TurnRoute = Literal["chat_only", "canvas_update"]

_GREETING_RE = re.compile(
    r"^(?:hi|hello|hey|howdy|hiya|yo|hl+o+)\b",
    re.I,
)

_CANVAS_COMMAND_RE = re.compile(
    r"\b(clear|reset|empty|wipe|refresh)\b.*\b(canvas|artifact|screen|panel|view)\b"
    r"|\b(canvas|artifact|screen)\b.*\b(clear|reset|empty|wipe)\b",
    re.I,
)

_ARTIFACT_META_RE = re.compile(
    r"("
    r"what(?:'s| is| am)?\s+(?:on(?:\s+the)?\s+screen|am\s+i\s+looking\s+at|i\s+looking\s+at|this(?:\s+about)?|here)|"
    r"summari[sz]e\s+(?:this|that|the\s+(?:canvas|artifact|view))|"
    r"in\s+one\s+(?:line|sentence)|"
    r"what(?:'s| is)\s+(?:the\s+)?(?:verdict|takeaway|bottom\s+line)|"
    r"explain\s+(?:this|the\s+canvas|what\s+i\s+see)"
    r")",
    re.I,
)

_SHOW_ME_RE = re.compile(
    r"\b(show me|update the canvas|update the ui|refresh the canvas|on the canvas|"
    r"render it|display it|show insights)\b",
    re.I,
)

_SUBSTANTIVE_HINT_RE = re.compile(
    r"\b(swot|network|map|ecosystem|state of play|rail|decarbon|cpc|hydrogen|"
    r"opportunity|funding|portfolio|landscape|supply chain)\b",
    re.I,
)

_CONFUSION_RE = re.compile(
    r"\b("
    r"not\s+(?:responding|working|answer)|"
    r"same\s+(?:reply|response|answer)|"
    r"why\s+(?:do\s+you\s+)?keep\s+(?:saying|repeating)|"
    r"got\s+to\s+do\s+with\s+my\s+question|"
    r"not\s+what\s+i\s+asked|"
    r"doesn'?t\s+answer|"
    r"\b(?:stuck|broken)\b"
    r")\b",
    re.I,
)


def _spec_summary(ctx: dict[str, Any] | None) -> dict[str, str]:
    if not ctx:
        return {
            "mode": "At rest",
            "tier": "—",
            "recipe": "none",
            "verdict": "",
            "stats": "",
        }
    verdict = (ctx.get("verdict") or {}).get("sentence") or ""
    instrument = ctx.get("instrument") or {}
    stats_bits: list[str] = []
    for s in ctx.get("stats") or []:
        if isinstance(s, dict) and s.get("value") and s.get("label"):
            stats_bits.append(f"{s['value']} {s['label'].lower()}")
    return {
        "mode": str(ctx.get("mode") or "Orient"),
        "tier": str(ctx.get("tier") or "Supported"),
        "recipe": str(instrument.get("recipe") or "none"),
        "verdict": verdict,
        "stats": " · ".join(stats_bits[:2]),
    }


def is_clear_canvas_query(query: str) -> bool:
    return bool(_CANVAS_COMMAND_RE.search(query.strip()))


def classify_follow_up(
    query: str,
    current_spec: dict[str, Any] | None = None,
    prior_dev_meta: dict[str, Any] | None = None,
) -> TurnRoute:
    q = query.strip()
    if not q:
        return "chat_only"

    if is_showcase_menu_trigger(q) or parse_domain_selection(q) or is_showcase_advance(q):
        return "chat_only"

    if is_explicit_canvas_request(q):
        return "canvas_update"

    if is_meta_chat_query(q):
        return "chat_only"

    if get_showcase_state(prior_dev_meta) and is_showcase_advance(q):
        return "chat_only"

    if q.lower() == J1T1_QUERY_PHRASE.lower():
        return "canvas_update"

    if is_connect_network_query(q) or is_j1t1_orient_query(q):
        return "canvas_update"

    if _SHOW_ME_RE.search(q) and _SUBSTANTIVE_HINT_RE.search(q):
        return "canvas_update"

    if re.search(r"\b(swot|biggest opportunity)\b", q, re.I) and re.search(
        r"\b(cpc|corpus|rail|show|canvas)\b", q, re.I
    ):
        return "canvas_update"

    if _CANVAS_COMMAND_RE.search(q) or _ARTIFACT_META_RE.search(q) or _CONFUSION_RE.search(q):
        return "chat_only"

    if _GREETING_RE.match(q) or is_conversational(q):
        if is_substantive_canvas_query(q):
            return "canvas_update"
        return "chat_only"

    if is_substantive_canvas_query(q):
        return "canvas_update"

    return "chat_only"


def build_chat_only_reply(
    query: str,
    current_spec: dict[str, Any] | None = None,
) -> str:
    q = query.strip()
    ql = q.lower()
    summary = _spec_summary(current_spec)

    if _CANVAS_COMMAND_RE.search(q):
        return (
            "Canvas cleared. Ask a landscape or network question when you're ready — "
            "e.g. *state of play on rail decarbonisation* or *map the ecosystem*."
        )

    if _GREETING_RE.match(q) or (is_conversational(q) and len(ql.split()) <= 6):
        if not current_spec:
            return (
                "Hi — Atlas v5 here. The canvas is **at rest** until you ask a strategic question.\n\n"
                "Try:\n"
                "• *Show me what you can do* — demo menu (rail · aviation · flex)\n"
                "• *State of play on rail decarbonisation* (orient)\n"
                "• *Map the ecosystem* (connect)\n"
                "• *What am I looking at?* (summarise the canvas)"
            )
        on_screen = summary["mode"]
        return (
            f"Hi — Atlas v5 here. The canvas currently shows **{on_screen}** "
            f"(`{summary['recipe']}`).\n\n"
            "Ask a strategic question when you're ready, or try:\n"
            "• *Show me what you can do* — demo menu (rail · aviation · flex)\n"
            "• *State of play on rail decarbonisation* (orient)\n"
            "• *Map the ecosystem* (connect)\n"
            "• *What am I looking at?* (summarise the canvas)"
        )

    if current_spec and _ARTIFACT_META_RE.search(q):
        stats = f" ({summary['stats']})" if summary["stats"] else ""
        return (
            f"You're on **{summary['mode']}** at **{summary['tier']}** tier{stats}.\n\n"
            f"{summary['verdict']}\n\n"
            f"Canvas instrument: `{summary['recipe']}`. "
            "Try **map the ecosystem** for NetworkMap, or ask about a specific blindspot (e.g. TRIG ingestion)."
        )

    if _CONFUSION_RE.search(q):
        return (
            "You're right to flag that — greetings and meta messages should not re-post the orient blob.\n\n"
            "I'm in chat-only mode for short or unclear inputs. Ask something substantive "
            "(network, orient refresh, or *what am I looking at?*) and I'll answer in context."
        )

    if is_conversational(q):
        return (
            "I'm the **/atlas** answer surface — corpus-backed orient and connect turns, not general chat.\n\n"
            f"Right now: **{summary['mode']}** · `{summary['recipe']}` · {summary['tier']} tier.\n\n"
            "Ask a CPC / rail / network question, or *what are your limits?*"
        )

    # Substantive but not routed to a known canvas turn
    return (
        f"I didn't map “{q[:100]}” to a built turn yet (orient or connect/network).\n\n"
        f"Canvas is still **{summary['mode']}** with `{summary['recipe']}`. Try:\n"
        "• *State of play on rail decarbonisation*\n"
        "• *Map the ecosystem / cross-modal bridges*\n"
        "• *What am I looking at?*"
    )


def build_canvas_update_reply(spec: AnswerSpec, query: str) -> str:
    del query
    instrument = spec.instrument.recipe if spec.instrument else "brief"
    stats_preview = ""
    if spec.stats and len(spec.stats) >= 2:
        stats_preview = f" ({spec.stats[0].value} projects · {spec.stats[1].value} funding floor)"

    if spec.mode == "Connect":
        data = (spec.instrument.data if spec.instrument else {}) or {}
        nodes = data.get("nodes") or []
        edges = data.get("edges") or []
        return (
            f"Switched to **Connect** — {spec.verdict.sentence}\n\n"
            f"Canvas now shows **NetworkMap** ({len(nodes)} nodes, {len(edges)} edges). "
            f"{spec.soWhat.oneDecision}"
        )

    if spec.mode == "Diagnose":
        data = (spec.instrument.data if spec.instrument else {}) or {}
        dims = data.get("dimensions") or []
        return (
            f"**Diagnose** — {spec.verdict.sentence}\n\n"
            f"Canvas: **EvidenceGapMatrix** ({len(dims)} dimensions). "
            f"{spec.soWhat.gate}"
        )

    return (
        f"**Orient** refreshed{stats_preview} — {spec.verdict.sentence}\n\n"
        f"Canvas: `{instrument}`. {spec.soWhat.oneDecision}"
    )
