"""Multi-turn accretion — carry prior canvas context into the next AnswerSpec."""

from __future__ import annotations

import re
from typing import Any

from agents.contracts.answer_spec import AnswerSpec, CarriedFrom, SoWhat


def _parse_turn_label(label: str | None) -> int:
    if not label:
        return 1
    m = re.match(r"\s*(\d+)\s*/", label)
    return int(m.group(1)) if m else 1


def _prior_turn_number(prior: dict[str, Any] | None) -> int:
    if not prior:
        return 0
    carried = prior.get("carriedFrom") or {}
    if carried.get("turn"):
        return int(carried["turn"])
    so_what = prior.get("soWhat") or {}
    return _parse_turn_label(so_what.get("turn"))


def apply_turn_accretion(
    spec: AnswerSpec,
    prior: dict[str, Any] | None,
    *,
    query: str,
) -> AnswerSpec:
    """Increment turn counter and attach carriedFrom when continuing a session."""
    if not prior:
        turn = 1
        summary = f"Turn 1 · {spec.mode} · {query[:80]}"
        carried = CarriedFrom(
            turn=turn,
            of=4,
            summary=summary,
            fromTurns=[turn],
            evolvedFields=["verdict", "instrument"],
        )
    else:
        prev_turn = _prior_turn_number(prior)
        turn = min(prev_turn + 1, 4)
        prev_mode = str(prior.get("mode") or "Orient")
        prev_summary = (prior.get("carriedFrom") or {}).get("summary") or prev_mode
        from_turns = list((prior.get("carriedFrom") or {}).get("fromTurns") or [])
        if turn not in from_turns:
            from_turns.append(turn)
        carried = CarriedFrom(
            turn=turn,
            of=4,
            summary=f"{prev_summary} → {spec.mode} (turn {turn})",
            fromTurns=from_turns[:4],
            evolvedFields=["verdict", "instrument", "blindspot", "tier"],
        )

    so_what = spec.soWhat.model_copy(
        update={"turn": f"{turn} / 4"},
    )
    return spec.model_copy(update={"carriedFrom": carried, "soWhat": so_what})
