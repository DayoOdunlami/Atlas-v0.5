"""Tests for KB validation tier inference."""

from __future__ import annotations

from scripts.kb.validation_tier import DocShape, infer_validation_tier


def test_manifest_is_t1():
    tier, _ = infer_validation_tier(
        DocShape("x", "approved", 82, 82, "http://x", "Better Connected", is_manifest=True)
    )
    assert tier == "T1_anchor"


def test_proposed_is_t4():
    tier, _ = infer_validation_tier(
        DocShape("x", "proposed", 0, 0, "http://x", "Draft")
    )
    assert tier == "T4_candidate"


def test_many_chunks_is_t2():
    tier, _ = infer_validation_tier(
        DocShape("x", "approved", 10, 10, "http://x", "Full PDF")
    )
    assert tier == "T2_embedded"


def test_few_chunks_is_t3():
    tier, _ = infer_validation_tier(
        DocShape("x", "approved", 2, 2, "http://x", "Landing page")
    )
    assert tier == "T3_thin"
