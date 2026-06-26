"""Tests for layout signal extraction."""

from __future__ import annotations

from agents.atlas_v5.persist_turn import extract_layout_signals, title_from_query


def test_extract_layout_signals_from_spec():
    signals = extract_layout_signals(
        {
            "instrument": {"recipe": "OpportunityList"},
            "canvas": {"markup": "<section>test</section>", "gate_status": "pass"},
        },
        {
            "route": "substantive",
            "disposition": {"composition_mode": "free_compose"},
            "keyed_keys": ["stats.project_count"],
            "fallback_rung": "rendered",
        },
    )
    assert signals["instrument_recipe"] == "OpportunityList"
    assert signals["composition_mode"] == "free_compose"
    assert signals["markup_hash"] is not None
    assert signals["markup_bytes"] == len("<section>test</section>")
    assert signals["keyed_key_count"] == 1


def test_title_from_query_truncates():
    long_q = "x" * 100
    title = title_from_query(long_q)
    assert len(title) <= 72
    assert title.endswith("…")
    assert title.endswith("…")


def test_title_from_query_empty():
    assert title_from_query("") == "New session"
