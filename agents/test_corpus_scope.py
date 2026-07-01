"""Tests for corpus scope resolution — header object label must match query domain."""

from __future__ import annotations

import unittest

from agents.atlas_v5.corpus_scope import corpus_scope_for_query


class CorpusScopeTests(unittest.TestCase):
    def test_rural_transport_not_maritime(self) -> None:
        q = "what are the best ways or opportunities to fix rural transport issues?"
        _where, label, mode = corpus_scope_for_query(q)
        self.assertEqual(label, "Rural transport")
        self.assertEqual(mode, "rural")
        self.assertNotEqual(label, "Maritime decarbonisation")

    def test_transport_suffix_does_not_trigger_maritime(self) -> None:
        q = "how can we decarbonise urban transport networks?"
        _where, label, _mode = corpus_scope_for_query(q)
        self.assertNotEqual(label, "Maritime decarbonisation")

    def test_maritime_still_matches_explicit(self) -> None:
        q = "state of play on maritime decarbonisation in our corpus"
        _where, label, mode = corpus_scope_for_query(q)
        self.assertEqual(label, "Maritime decarbonisation")
        self.assertEqual(mode, "maritime")

    def test_dft_cpc_strategy_alignment_scope(self) -> None:
        q = (
            "what is the alignment or misalignment or overlap or connections "
            "between dft strategy and cpc strategy"
        )
        _where, label, mode = corpus_scope_for_query(q)
        self.assertEqual(label, "UK transport strategy alignment")
        self.assertEqual(mode, "strategy")


if __name__ == "__main__":
    unittest.main()
