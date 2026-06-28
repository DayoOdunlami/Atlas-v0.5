"""Compact prior-turn context for resumed sessions (Postgres rehydrate → co-agent state)."""

from __future__ import annotations

from typing import Any


def format_session_history(
    history: list[dict[str, Any]] | None,
    *,
    max_messages: int = 8,
) -> str:
    if not history:
        return ""
    lines: list[str] = []
    for item in history[-max_messages:]:
        role = str(item.get("role") or "user").upper()
        content = str(item.get("content") or "").strip()
        if not content:
            continue
        lines.append(f"{role}: {content[:600]}")
    if not lines:
        return ""
    return "Prior turns in this session (resume context — adapt, do not copy verbatim):\n" + "\n".join(
        lines
    )
