"""Integration test — SWOT queries get quadrant markup even without deep pass."""

from __future__ import annotations

import asyncio
import os

import pytest


@pytest.mark.asyncio
async def test_swot_turn_gets_quadrant_markup_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    from agents.atlas_v5.run_turn import run_turn_response

    payload = await run_turn_response("Perform a SWOT analysis on CPC for me")
    spec = payload.get("spec") or {}
    canvas = spec.get("canvas") or {}
    merged = canvas.get("merged_markup") or ""
    assert payload.get("update_canvas") is True
    assert "swot-quadrant" in merged.lower() or "STRENGTHS" in merged
    assert payload.get("dev_meta", {}).get("gate_status") in ("pass", "fallback_recipe", None)
