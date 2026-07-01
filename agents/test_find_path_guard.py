"""Find-my-path continuation and T3 surface guards — cal_03 T2 regression."""

from __future__ import annotations

import unittest

from agents.atlas_v5.case_file import CaseClaim
from agents.atlas_v5.find_path_assembler import (
    _t3_markup_valid,
    enforce_find_path_surface,
)
from agents.atlas_v5.intent import should_continue_find_path
from agents.atlas_v5.judgement_merge import merge_judgement_onto_skeleton
from agents.atlas_v5.judgement_models import JudgementFieldsOutput
from agents.atlas_v5.wide_pass import WidePassResult
from agents.contracts.answer_spec import (
    AnswerSpec,
    Blindspot,
    CanvasBlock,
    Instrument,
    SoWhat,
    Verdict,
)


def _uncertainty_claims() -> list[CaseClaim]:
    return [
        CaseClaim(
            id="c1",
            text="I've got a rail idea, not sure what I'm asking",
            kind="uncertainty",
            confidence_tier="Indicative",
        ),
    ]


class FindPathContinuationTests(unittest.TestCase):
    def test_cal_03_turn2_continues_find_path(self) -> None:
        q = "What kind of funding might fit an SME innovator like that?"
        self.assertTrue(should_continue_find_path(q, _uncertainty_claims()))

    def test_clean_orient_does_not_continue(self) -> None:
        q = "State of play on rail decarbonisation in our corpus"
        self.assertFalse(should_continue_find_path(q, _uncertainty_claims()))


class FindPathSurfaceGuardTests(unittest.TestCase):
    def test_merge_preserves_find_path_not_opportunity_list(self) -> None:
        skeleton = AnswerSpec(
            object="Rail decarbonisation",
            scope="PRACTITIONER · FIND PATH · Rail decarbonisation",
            mode="FindPath",
            tier="Indicative",
            tierCapReason="Declared",
            verdict=Verdict(sentence="Reflect first."),
            instrument=None,
            soWhat=SoWhat(
                lookingAt="Find my path",
                oneDecision="—",
                gate="—",
                primaryAction="—",
                turn="1 / 4",
            ),
        )
        judgement = JudgementFieldsOutput(
            mode="Orient",
            tier="Indicative",
            verdict=Verdict(sentence="Funding routes exist."),
            soWhat=SoWhat(
                lookingAt="Orient",
                oneDecision="—",
                gate="—",
                primaryAction="—",
                turn="2 / 4",
            ),
            instrument_recipe="OpportunityList",
            chat_complement="Here are routes.",
        )
        merged = merge_judgement_onto_skeleton(skeleton, judgement)
        self.assertEqual(merged.mode, "FindPath")
        self.assertIsNone(merged.instrument)

    def test_t3_invalid_when_declared_precedes_wrapper(self) -> None:
        markup = (
            '<section data-testid="declared-situation">x</section>'
            '<section data-testid="find-my-path">y</section>'
        )
        self.assertFalse(_t3_markup_valid(markup))

    def test_enforce_injects_find_my_path_testid(self) -> None:
        claims = _uncertainty_claims()
        wide = WidePassResult(
            outcome="find_path",
            query="What kind of funding might fit an SME innovator like that?",
            session_claims=claims,
            object_label="Rail decarbonisation",
        )
        spec = AnswerSpec(
            object="Rail decarbonisation",
            scope="CORPUS · 8 OBJECTS · ORIENT",
            mode="Orient",
            tier="Indicative",
            tierCapReason="—",
            verdict=Verdict(sentence="Several routes exist."),
            instrument=Instrument(recipe="OpportunityList", data={"items": []}),
            canvas=CanvasBlock(
                merged_markup='<section data-testid="declared-situation">only</section>',
                gate_status="pass",
            ),
            blindspot=Blindspot(sign="absence", gap="—"),
            soWhat=SoWhat(
                lookingAt="—",
                oneDecision="—",
                gate="—",
                primaryAction="—",
                turn="2 / 4",
            ),
        )
        fixed = enforce_find_path_surface(spec, wide, claims)
        markup = (fixed.canvas.merged_markup if fixed.canvas else "") or ""
        self.assertTrue(markup.startswith('<section data-testid="find-my-path"') or markup.find('data-testid="find-my-path"') < 80)
        self.assertIsNone(fixed.instrument)
        self.assertEqual(fixed.mode, "FindPath")
        self.assertIn("FIND PATH", fixed.scope)


if __name__ == "__main__":
    unittest.main()
