"""Tests for session resume context formatting."""

from agents.atlas_v5.session_context import format_session_history


def test_format_session_history_empty():
    assert format_session_history(None) == ""
    assert format_session_history([]) == ""


def test_format_session_history_truncates():
    text = format_session_history(
        [
            {"role": "user", "content": "Where is funding thinnest?"},
            {"role": "assistant", "content": "Corpus floor is thin in Wales."},
        ]
    )
    assert "Prior turns" in text
    assert "USER:" in text
    assert "ASSISTANT:" in text
