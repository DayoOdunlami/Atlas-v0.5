"""Showcase mode — menu, journey picker, step runner."""

from __future__ import annotations

import re
from typing import Any

from agents.atlas_v5.showcase_catalog import (
    JOURNEYS,
    DOMAIN_ALIASES,
    ShowcaseDomain,
    ShowcaseJourney,
)

_MENU_RE = re.compile(
    r"\b("
    r"show\s+me\s+what\s+you\s+can\s+do|"
    r"what\s+can\s+you\s+do|"
    r"showcase|"
    r"demo\s+mode|"
    r"run\s+(?:a\s+)?demo|"
    r"flex\s+your\s+digital\s+muscle"
    r")\b",
    re.I,
)

_SELECT_RE = re.compile(
    r"\b(?:demo|showcase|journey|run)\s+(?:on\s+)?(rail|aviation|flex|air|muscle|digital)\b",
    re.I,
)

_NEXT_RE = re.compile(
    r"^\s*(?:next|continue|demo\s+next|showcase\s+next|step\s+next)\s*\.?\s*$",
    re.I,
)


def is_showcase_menu_trigger(query: str) -> bool:
    return bool(_MENU_RE.search(query.strip()))


def parse_domain_selection(query: str) -> ShowcaseDomain | None:
    ql = query.strip().lower()
    m = _SELECT_RE.search(ql)
    if m:
        token = m.group(1).lower()
        if token in ("air",):
            return "aviation"
        if token in ("muscle", "digital"):
            return "flex"
        return token  # type: ignore[return-value]
    if ql in DOMAIN_ALIASES:
        return DOMAIN_ALIASES[ql]
    for domain, journey in JOURNEYS.items():
        if journey.title.lower() in ql or f"demo {domain}" in ql:
            return domain
    return None


def is_showcase_advance(query: str) -> bool:
    return bool(_NEXT_RE.match(query.strip()))


def get_showcase_state(prior_dev_meta: dict[str, Any] | None) -> dict[str, Any] | None:
    if not prior_dev_meta:
        return None
    state = prior_dev_meta.get("showcase")
    return state if isinstance(state, dict) and state.get("active") else None


def build_menu_reply() -> str:
    lines = [
        "**Atlas showcase** — pick a journey or type a domain:",
        "",
        "1. **Rail** — 4-turn CPC rail decarbonisation (orient → diagnose → network → act)",
        "2. **Aviation** — SAF / aviation decarbonisation slice",
        "3. **Flex** — *flex your digital muscle* — surface morph demo",
        "",
        "Reply **`demo rail`**, **`demo aviation`**, or **`demo flex`** to start.",
        "Then say **`next`** to advance, or ask your own question anytime.",
        "",
        "Or open **`/atlas/showcase`** for the scene picker.",
    ]
    return "\n".join(lines)


def build_menu_dev_meta() -> dict[str, Any]:
    return {
        "showcase": {
            "active": False,
            "mode": "menu",
            "options": [
                {"id": "rail", "label": "Rail journey", "command": "demo rail"},
                {"id": "aviation", "label": "Aviation journey", "command": "demo aviation"},
                {"id": "flex", "label": "Flex digital muscle", "command": "demo flex"},
            ],
        }
    }


def start_journey(domain: ShowcaseDomain) -> tuple[str, dict[str, Any], str]:
    journey = JOURNEYS[domain]
    step = journey.steps[0]
    meta = {
        "showcase": {
            "active": True,
            "mode": "running",
            "domain": domain,
            "step": 0,
            "total": len(journey.steps),
            "title": journey.title,
            "options": [
                {"id": "next", "label": "Next step →", "command": "next"},
            ],
        }
    }
    reply = (
        f"**{journey.title}** — step 1/{len(journey.steps)}: **{step.label}**\n\n"
        f"_{step.hint}_\n\n"
        f"Running: “{step.query}”"
    )
    return step.query, meta, reply


def advance_journey(state: dict[str, Any]) -> tuple[str | None, dict[str, Any], str]:
    domain = state.get("domain")
    if domain not in JOURNEYS:
        return None, build_menu_dev_meta(), build_menu_reply()
    journey: ShowcaseJourney = JOURNEYS[domain]  # type: ignore[index]
    step_idx = int(state.get("step", 0)) + 1
    if step_idx >= len(journey.steps):
        meta = {
            "showcase": {
                "active": False,
                "mode": "complete",
                "domain": domain,
                "total": len(journey.steps),
            }
        }
        return None, meta, (
            f"**{journey.title}** complete — all {len(journey.steps)} surfaces shown.\n\n"
            "Ask anything new, **`demo rail`**, or *show me what you can do* for the menu."
        )
    step = journey.steps[step_idx]
    meta = {
        "showcase": {
            "active": True,
            "mode": "running",
            "domain": domain,
            "step": step_idx,
            "total": len(journey.steps),
            "title": journey.title,
            "options": [{"id": "next", "label": "Next step →", "command": "next"}],
        }
    }
    reply = (
        f"**{journey.title}** — step {step_idx + 1}/{len(journey.steps)}: **{step.label}**\n\n"
        f"_{step.hint}_\n\n"
        f"Running: “{step.query}”"
    )
    return step.query, meta, reply


def resolve_showcase_turn(
    query: str,
    prior_dev_meta: dict[str, Any] | None,
) -> tuple[str | None, dict[str, Any] | None, str | None]:
    """
    Returns (substantive_query_or_none, dev_meta_patch, chat_reply_or_none).
    If substantive_query is set, caller should run substantive turn with that query.
    If only chat_reply, return chat-only response.
    """
    q = query.strip()

    if is_showcase_menu_trigger(q) and not parse_domain_selection(q):
        return None, build_menu_dev_meta(), build_menu_reply()

    domain = parse_domain_selection(q)
    if domain:
        sub_q, meta, reply = start_journey(domain)
        return sub_q, meta, reply

    state = get_showcase_state(prior_dev_meta)
    if state and is_showcase_advance(q):
        sub_q, meta, reply = advance_journey(state)
        return sub_q, meta, reply

    return None, None, None
