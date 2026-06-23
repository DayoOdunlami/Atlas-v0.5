"""Disposition heuristic tests."""

from __future__ import annotations

from agents.atlas_v5.disposition_heuristic import infer_disposition_heuristic
from agents.test_atlas_v5_run_turn import MOCK_SPEC


def test_hello_chat_only():
    d = infer_disposition_heuristic("hello", current_spec=MOCK_SPEC, substantive=False)
    assert d.canvas_action == "none"
    assert d.primary_surface == "chat_only"


def test_orient_canvas_replace():
    d = infer_disposition_heuristic(
        "state of play on rail decarbonisation",
        substantive=True,
    )
    assert d.canvas_action == "replace"
    assert d.primary_surface == "canvas_primary"


def test_artifact_meta_no_canvas():
    d = infer_disposition_heuristic(
        "what am I looking at?",
        current_spec=MOCK_SPEC,
        substantive=False,
    )
    assert d.canvas_action == "none"
