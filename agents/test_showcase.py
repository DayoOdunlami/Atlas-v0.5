"""Showcase mode routing tests."""

from __future__ import annotations

from agents.atlas_v5.showcase import (
    build_menu_reply,
    is_showcase_advance,
    is_showcase_menu_trigger,
    parse_domain_selection,
    resolve_showcase_turn,
    start_journey,
)


def test_showcase_menu_trigger():
    assert is_showcase_menu_trigger("Show me what you can do")
    assert is_showcase_menu_trigger("flex your digital muscle")


def test_parse_domain():
    assert parse_domain_selection("demo rail") == "rail"
    assert parse_domain_selection("demo aviation") == "aviation"
    assert parse_domain_selection("demo flex") == "flex"
    assert parse_domain_selection("2") == "aviation"
    assert parse_domain_selection("number 2") == "aviation"
    assert parse_domain_selection("#3") == "flex"


def test_resolve_menu():
    sub_q, meta, reply = resolve_showcase_turn("what can you do?", None)
    assert sub_q is None
    assert meta is not None
    assert "Rail" in reply
    assert meta["showcase"]["mode"] == "menu"


def test_start_rail_journey():
    sub_q, meta, reply = start_journey("rail")
    assert "rail decarbonisation" in sub_q.lower()
    assert meta["showcase"]["active"] is True
    assert "step 1" in reply.lower()


def test_showcase_advance():
    assert is_showcase_advance("next")
    _, meta, _ = start_journey("rail")
    sub_q, next_meta, reply = resolve_showcase_turn(
        "next",
        {"showcase": meta["showcase"]},
    )
    assert sub_q is not None
    assert "gap" in sub_q.lower() or "evidence" in sub_q.lower()
    assert next_meta["showcase"]["step"] == 1
