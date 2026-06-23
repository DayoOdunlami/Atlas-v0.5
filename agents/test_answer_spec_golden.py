"""GATE 0a — AnswerSpec golden fixture validates against Zod schema."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from agents.contracts.answer_spec import AnswerSpec

GOLDEN = (
    Path(__file__).resolve().parents[1]
    / "contracts"
    / "atlas-v5"
    / "fixtures"
    / "j1t1-rail-decarb.golden.json"
)


def test_j1t1_golden_parses_pydantic():
    data = json.loads(GOLDEN.read_text(encoding="utf-8"))
    spec = AnswerSpec.model_validate(data)
    assert spec.specVersion == "0.2.1"
    assert spec.blindspot is not None
    assert spec.blindspot.structure is not None
    assert "EPSRC" in spec.blindspot.structure.pattern
    assert spec.instrument is not None
    assert spec.instrument.honesty is not None
    assert spec.instrument.honesty.toScale is False
