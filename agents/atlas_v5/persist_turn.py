"""Extract layout_signals from turn payload — mirrors src/lib/atlas/layout-signals.ts."""

from __future__ import annotations

import hashlib
import os
from typing import Any


def _simple_hash(text: str) -> str:
    return "h" + hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def extract_layout_signals(
    spec: dict[str, Any] | None,
    dev_meta: dict[str, Any] | None,
) -> dict[str, Any]:
    dev_meta = dev_meta or {}
    spec = spec or {}
    canvas = spec.get("canvas") or {}
    instrument = spec.get("instrument") or {}
    disposition = dev_meta.get("disposition") or {}
    markup = canvas.get("markup") or canvas.get("merged_markup") or ""
    markup_str = markup if isinstance(markup, str) else ""

    return {
        "composition_mode": disposition.get("composition_mode"),
        "instrument_recipe": instrument.get("recipe"),
        "visual_form": dev_meta.get("visual_intent"),
        "markup_hash": _simple_hash(markup_str[:8000]) if markup_str else None,
        "markup_bytes": len(markup_str) if markup_str else None,
        "keyed_key_count": len(dev_meta.get("keyed_keys") or []),
        "gate_status": dev_meta.get("gate_status") or canvas.get("gate_status"),
        "fallback_rung": dev_meta.get("fallback_rung"),
        "route": dev_meta.get("route"),
        "outcome_hint": dev_meta.get("outcome_hint"),
    }


def title_from_query(query: str) -> str:
    q = " ".join((query or "").strip().split())
    if not q:
        return "New session"
    return q if len(q) <= 72 else f"{q[:69]}…"


def persist_enabled() -> bool:
    return os.getenv("ATLAS_V5_TURN_PERSIST", "0").strip().lower() in (
        "1",
        "true",
        "yes",
    )
