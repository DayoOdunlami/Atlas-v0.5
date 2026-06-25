"""
Practitioner calibration rubrics — Increment 1B-eval.

Five fixed turns with layer-tagged criteria. Reusable pattern: import rubric set +
agent_id into behavioral_grader harness.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from agents.eval.behavioral_grader import RubricCriterion

PRACTITIONER_AGENT_ID = "atlas_v5_practitioner"


@dataclass
class CalibrationCase:
    id: str
    label: str
    query: str
    rubric: list[RubricCriterion]
    prior_queries: list[str] = field(default_factory=list)
    follow_up_query: str | None = None
    notes: str = ""


CALIBRATION_CASES: list[CalibrationCase] = [
    CalibrationCase(
        id="cal_01_hello",
        label="#1 hello",
        query="hello",
        rubric=[
            RubricCriterion(
                id="cal_01_warm_greeting",
                layer="disposition",
                description=(
                    "Warm one-liner welcome — practitioner tone, not ceremony, "
                    "not a product tour or bullet list"
                ),
            ),
            RubricCriterion(
                id="cal_01_no_canvas",
                layer="disposition",
                description="Canvas unchanged — chat route, no substantive landscape refresh",
            ),
        ],
    ),
    CalibrationCase(
        id="cal_02_haribo",
        label="#2 Haribo joke",
        query="What are the latest Haribo innovations?",
        rubric=[
            RubricCriterion(
                id="cal_02_warm_redirect",
                layer="disposition",
                description=(
                    "Warm redirect off-topic — acknowledges the joke/topic lightly, "
                    "invites a real in-scope question"
                ),
            ),
            RubricCriterion(
                id="cal_02_seeks_real_question",
                layer="disposition",
                description=(
                    "Checks for a real strategic question under the joke — thinking-partner, "
                    "not a hard refusal"
                ),
            ),
            RubricCriterion(
                id="cal_02_no_brick_wall",
                layer="disposition",
                description="Does not brick-wall or scold — no 'I cannot help with that' dead end",
                load_bearing=True,
            ),
        ],
    ),
    CalibrationCase(
        id="cal_03_lost_rail",
        label="#3 lost + rail",
        query="I've got a rail idea, not sure what I'm asking",
        follow_up_query="What kind of funding might fit an SME innovator like that?",
        rubric=[
            RubricCriterion(
                id="cal_03_routing_find_path",
                layer="routing",
                description=(
                    "Routes find_path (substantive + find_path outcome) — NOT orient, "
                    "NOT dead-end chat-only"
                ),
            ),
            RubricCriterion(
                id="cal_03_thinking_partner",
                layer="disposition",
                description=(
                    "Thinking-partner mode — surfaces the real question beneath uncertainty; "
                    "does not dump a full landscape brief"
                ),
            ),
            RubricCriterion(
                id="cal_03_declared_persisted",
                layer="persistence",
                description=(
                    "Stated situation appears as declared in the case file store after the turn "
                    "(uncertainty / user situation captured)"
                ),
            ),
            RubricCriterion(
                id="cal_03_t3_surface",
                layer="render",
                description=(
                    "T3 find-my-path surface — declared panel + reflected question + at most "
                    "1–3 matches; NOT OpportunityList / R4 ranked list"
                ),
            ),
            RubricCriterion(
                id="cal_03_followup_reference",
                layer="persistence",
                description=(
                    "On follow-up turn: prior declared claim is referenced or visibly available "
                    "— context→storage→N+1 seam is sound"
                ),
                load_bearing=True,
            ),
        ],
        notes="C1 proof case — routing + persistence + render",
    ),
    CalibrationCase(
        id="cal_04_clean_rail",
        label="#4 clean rail",
        query="State of play on rail decarbonisation in our corpus",
        rubric=[
            RubricCriterion(
                id="cal_04_direct_answer",
                layer="disposition",
                description=(
                    "Answers the analyst question directly — does NOT pre-emptively reframe "
                    "('before we answer…', 'what you really mean…'). A reframe here is score 0 "
                    "even if evidence is good"
                ),
            ),
            RubricCriterion(
                id="cal_04_retrieval_balance",
                layer="retrieval",
                description=(
                    "Uses corpus appropriately for an analyst orient query; web lane supports "
                    "without overriding corpus when corpus is substantive"
                ),
                load_bearing=False,
            ),
        ],
        notes="Over-reframe trap — disposition 0 is load-bearing",
    ),
    CalibrationCase(
        id="cal_05_tangled",
        label="#5 tangled SME",
        query=(
            "We're an SME pursuing ISO certification for rail components but have no trial "
            "partner yet — my bonus depends on hitting Q3 milestones and I'm not sure which "
            "funding path is realistic"
        ),
        rubric=[
            RubricCriterion(
                id="cal_05_tension",
                layer="reasoning",
                description=(
                    "Notices the load-bearing tension (partner gap vs milestone pressure vs "
                    "funding path) — not just a flat list of user claims"
                ),
            ),
            RubricCriterion(
                id="cal_05_adaptive_disposition",
                layer="disposition",
                description=(
                    "Adaptive disposition — reconciles the tangle without interrogating or "
                    "form-filling; advisor voice not intake form"
                ),
            ),
            RubricCriterion(
                id="cal_05_writeback",
                layer="persistence",
                description=(
                    "Writes refined or split claims back to the case file (constraint / "
                    "uncertainty / hypothesis as appropriate)"
                ),
            ),
            RubricCriterion(
                id="cal_05_advisor_not_underwriter",
                layer="reasoning",
                description=(
                    "Advisor-not-underwriter — flags what needs independent verification; "
                    "does not certify bonus, ISO, or funding as facts"
                ),
            ),
        ],
        notes="Tangled practitioner — reasoning + persistence",
    ),
]


def get_calibration_case(case_id: str) -> CalibrationCase | None:
    for case in CALIBRATION_CASES:
        if case.id == case_id:
            return case
    return None
