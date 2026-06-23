"""Atlas v5 — user-visible chain-of-thought steps (pipeline stages, not raw LLM tokens)."""

from __future__ import annotations

from typing import Any


def trace_step(
    node: str,
    thought: str,
    *,
    evidence_count: int | None = None,
) -> dict[str, Any]:
    step: dict[str, Any] = {"node": node, "thought": thought}
    if evidence_count is not None:
        step["evidence_count"] = evidence_count
    return step


def append_trace(
    existing: list[dict[str, Any]] | None,
    *steps: dict[str, Any],
) -> list[dict[str, Any]]:
    return list(existing or []) + list(steps)
