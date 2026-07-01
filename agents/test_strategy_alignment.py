"""Strategy alignment routing — must not collapse to rail connect NetworkMap."""

from __future__ import annotations

import unittest

from agents.atlas_v5.intent import (
    is_connect_network_query,
    is_strategy_alignment_query,
)
from agents.atlas_v5.turn_classifier import infer_outcome_hint

DFT_CPC = (
    "what is the alignment or misalignment or overlap or connections "
    "between dft strategy and cpc strategy. also what are the other "
    "significant uk strategy we should consider"
)


class StrategyAlignmentTests(unittest.TestCase):
    def test_detects_strategy_alignment(self) -> None:
        self.assertTrue(is_strategy_alignment_query(DFT_CPC))

    def test_detects_short_audit_phrase(self) -> None:
        self.assertTrue(is_strategy_alignment_query("UK transport strategy alignment"))

    def test_not_connect_network(self) -> None:
        self.assertFalse(is_connect_network_query(DFT_CPC))

    def test_outcome_is_diagnose_not_connect(self) -> None:
        self.assertEqual(infer_outcome_hint(DFT_CPC), "diagnose")


if __name__ == "__main__":
    unittest.main()
