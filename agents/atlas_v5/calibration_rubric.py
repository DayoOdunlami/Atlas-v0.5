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
    CalibrationCase(
        id="cal_06_connect",
        label="#6 connect ecosystem",
        query="Map the rail decarbonisation ecosystem — who connects to whom in our corpus",
        rubric=[
            RubricCriterion(
                id="cal_06_substantive_connect",
                layer="routing",
                description=(
                    "Routes substantive connect — canvas updates with network/ecosystem surface, "
                    "not chat-only deferral"
                ),
                load_bearing=True,
            ),
            RubricCriterion(
                id="cal_06_graph_nodes",
                layer="render",
                description=(
                    "Returns real graph nodes/edges from corpus over REST — "
                    "node_count >= 2, not empty canvas"
                ),
                load_bearing=True,
            ),
        ],
        notes="Connect graph over 443 — REST-first network_corpus",
    ),
    CalibrationCase(
        id="cal_07_lane_relevance",
        label="#7 academic lane relevance",
        query="What does academic research say about effective climate measures for transport?",
        rubric=[
            RubricCriterion(
                id="cal_07_research_lead",
                layer="retrieval",
                description=(
                    "Leads from research/academic lane (OpenAlex) or web — NOT punished because "
                    "corpus is thin; reconcile_lead research or web, not corpus-empty degradation"
                ),
                load_bearing=True,
            ),
            RubricCriterion(
                id="cal_07_not_speculative_on_corpus",
                layer="disposition",
                description=(
                    "Does NOT cap to Speculative solely because corpus_count=0 when corpus was "
                    "not the expected source — tier reflects leading lane honestly (Indicative+ "
                    "when research/web substantive)"
                ),
                load_bearing=True,
            ),
            RubricCriterion(
                id="cal_07_direct_answer",
                layer="disposition",
                description=(
                    "Answers the academic question directly with research-backed synthesis — "
                    "not a brick wall or corpus gate offer"
                ),
            ),
        ],
        notes="Lane-relevance — de-corpus-centred tier honesty",
    ),
    CalibrationCase(
        id="cal_08_strategy",
        label="#8 strategy alignment",
        query="UK transport strategy alignment",
        prior_queries=[
            "How does CPC align with DfT Better Connected and Innovate UK strategic delivery plan?",
        ],
        rubric=[
            RubricCriterion(
                id="cal_08_routing_diagnose",
                layer="routing",
                description=(
                    "Routes diagnose (not orient/connect) — strategy alignment is a policy "
                    "concordance question, not a landscape orient"
                ),
                load_bearing=True,
            ),
            RubricCriterion(
                id="cal_08_no_portfolio_charts",
                layer="render",
                description=(
                    "No generic portfolio charts (funding by funder, evidence flow, sankey) — "
                    "strategy turns are prose + alignment gap matrix only"
                ),
                load_bearing=True,
            ),
            RubricCriterion(
                id="cal_08_alignment_gaps",
                layer="render",
                description=(
                    "Gap matrix speaks to concordance / pillar tags / T1 strategy documents — "
                    "not EPSRC null-funding hygiene rows"
                ),
            ),
            RubricCriterion(
                id="cal_08_indicative_ceiling",
                layer="disposition",
                description=(
                    "Honest Indicative tier — no Robust claims without published concordance"
                ),
            ),
            RubricCriterion(
                id="cal_08_followup_stays_diagnose",
                layer="routing",
                description=(
                    "Follow-up turn stays on diagnose/strategy thread — does not drift to "
                    "Orient with generic stat-strip charts"
                ),
            ),
        ],
        notes="Strategy alignment — suppress portfolio charts; alignment-specific gap matrix",
    ),
]


def get_calibration_case(case_id: str) -> CalibrationCase | None:
    for case in CALIBRATION_CASES:
        if case.id == case_id:
            return case
    return None
