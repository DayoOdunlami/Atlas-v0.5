"""D5.1 — latency budget smoke on orchestrator fixture queries."""
from __future__ import annotations

import time

import pytest

from agents.orchestrator.outcome_builders import build_outcome_model


@pytest.mark.parametrize("outcome", ["orient", "connect", "act", "defend"])
def test_outcome_builder_under_budget(outcome: str):
    """Deterministic builders should stay under 8s analyze budget (local)."""
    start = time.perf_counter()
    build_outcome_model(
        query="What is CPC good at in rail?",
        outcome=outcome,
    )
    elapsed = time.perf_counter() - start
    assert elapsed < 8.0, f"{outcome} builder took {elapsed:.1f}s"
