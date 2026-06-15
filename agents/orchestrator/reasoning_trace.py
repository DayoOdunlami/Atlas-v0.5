"""Reasoning step payloads surfaced to the workbench UI (U7)."""
from __future__ import annotations

from typing import Any


def steps_for_pipeline(
    *,
    outcome: str,
    effort: str,
    path: str,
) -> list[dict[str, Any]]:
    """Build reasoning_steps list for a completed deterministic pipeline run."""
    base = [
        {"label": "Triage query", "detail": f"outcome={outcome}, effort={effort}", "status": "complete"},
        {"label": f"Run {path}", "detail": "Corpus + matcher vertical", "status": "complete"},
        {"label": "Trust spine verify", "detail": "citation_guard + artifact_qa", "status": "complete"},
        {"label": "Format pass", "detail": "Select blocks + materialize payloads", "status": "complete"},
    ]
    return base


def steps_active(label: str, detail: str = "") -> list[dict[str, Any]]:
    return [{"label": label, "detail": detail, "status": "active"}]
