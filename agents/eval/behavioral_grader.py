"""
agents.eval.behavioral_grader
=============================

Reusable LLM-as-judge harness: rubric criteria (layer-tagged, 0–3), per-turn SWOT,
and pattern-based verdict. Agent-agnostic — supply rubric + transcript pack per agent.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError

LayerTag = Literal[
    "reasoning",
    "disposition",
    "retrieval",
    "persistence",
    "render",
    "routing",
]

Verdict = Literal["ship", "tune", "broken"]
GraderMethod = Literal["llm", "heuristic", "heuristic_fallback"]


class RubricCriterion(BaseModel):
    id: str
    layer: LayerTag
    description: str
    load_bearing: bool = True


class TurnSwot(BaseModel):
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    opportunities: list[str] = Field(default_factory=list)
    threats: list[str] = Field(default_factory=list)


class GradedCriterion(BaseModel):
    id: str
    layer: LayerTag
    score: int = Field(ge=0, le=3)
    reason: str


class GraderOutput(BaseModel):
    criteria: list[GradedCriterion]
    turn_swot: TurnSwot
    diagnosis: str
    verdict: Verdict


@dataclass
class BehavioralGradeResult:
    agent_id: str
    case_id: str
    method: GraderMethod
    model: str | None
    criteria: list[GradedCriterion]
    turn_swot: TurnSwot
    diagnosis: str
    verdict: Verdict
    grader_verdict: Verdict | None = None
    structural_signals: dict[str, Any] = field(default_factory=dict)
    transcript: dict[str, Any] = field(default_factory=dict)
    llm_error: str | None = None
    note: str | None = None


DEFAULT_GRADER_MODEL = os.getenv("CALIBRATION_GRADER_MODEL", "claude-sonnet-4-6")

_LAYER_FIX_HINT: dict[LayerTag, str] = {
    "reasoning": "deep_pass_prompt.py or model strength",
    "disposition": "prompt Blocks A–E",
    "retrieval": "shopper / lanes",
    "persistence": "case_file / Supabase wiring",
    "render": "assembler / visual path",
    "routing": "C1 / turn_classifier",
}


def compute_verdict(
    criteria: list[GradedCriterion],
    rubric: list[RubricCriterion],
) -> Verdict:
    """Pattern verdict — not a hard score cutoff."""
    load_ids = {r.id for r in rubric if r.load_bearing}
    by_id = {c.id: c for c in criteria}

    for cid in load_ids:
        item = by_id.get(cid)
        if item and item.score == 0:
            return "broken"

    scores = [c.score for c in criteria]
    if not scores:
        return "tune"

    if any(s == 0 for s in scores):
        return "broken"

    threes = sum(1 for s in scores if s == 3)
    twos = sum(1 for s in scores if s == 2)
    ones = sum(1 for s in scores if s == 1)

    if threes == len(scores):
        return "ship"
    if threes >= max(1, int(len(scores) * 0.6)) and ones == 0:
        return "ship"
    if ones >= 2 or (twos >= len(scores) // 2 + 1 and threes == 0):
        return "tune"
    if threes >= twos:
        return "ship"
    return "tune"


def bottleneck_layer(criteria: list[GradedCriterion]) -> LayerTag:
    """Lowest-scoring layer — tie-break by load-bearing order."""
    if not criteria:
        return "disposition"
    worst = min(c.score for c in criteria)
    weak = [c for c in criteria if c.score == worst]
    order: list[LayerTag] = [
        "routing",
        "persistence",
        "render",
        "retrieval",
        "disposition",
        "reasoning",
    ]
    weak_layers = {c.layer for c in weak}
    for layer in order:
        if layer in weak_layers:
            return layer
    return weak[0].layer


def build_diagnosis(criteria: list[GradedCriterion], rubric: list[RubricCriterion]) -> str:
    layer = bottleneck_layer(criteria)
    fix = _LAYER_FIX_HINT.get(layer, "unknown layer")
    worst = min((c.score for c in criteria), default=0)
    return f"{layer} bottleneck (min score {worst}) — fix in {fix}"


def _rubric_block(rubric: list[RubricCriterion]) -> str:
    lines = []
    for r in rubric:
        tag = "LOAD-BEARING" if r.load_bearing else "advisory"
        lines.append(
            f"- id={r.id} layer={r.layer} [{tag}]: {r.description}"
        )
    return "\n".join(lines)


def _build_grader_prompt(
    *,
    agent_id: str,
    case_label: str,
    rubric: list[RubricCriterion],
    transcript: dict[str, Any],
    structural_signals: dict[str, Any],
) -> str:
    return f"""You are a behavioural quality director for agent "{agent_id}".
Grade ONE calibration turn against a fixed rubric. You are NOT a pass/fail gate —
score each criterion 0–3 and explain why.

Scoring scale (per criterion):
- 3 = practitioner-grade (behaviour a real advisor would show)
- 2 = acceptable but slightly stiff or thin
- 1 = present but wrong-shaped (named tension but did not reconcile, etc.)
- 0 = absent or anti-behaviour (brick-walled, interrogated, invented, wrong route)

Layer tags map failures to fix locations:
- reasoning → model judgement / deep_pass_prompt
- disposition → mode (answer vs surface question) / Blocks A–E
- retrieval → evidence lanes / shopper
- persistence → case file / cross-turn memory
- render → surface template (T3 vs R4, etc.)
- routing → turn_classifier / outcome_hint

Case: {case_label}

Rubric (score EVERY criterion by id):
{_rubric_block(rubric)}

Structural signals (deterministic — use as hints, not overrides):
{json.dumps(structural_signals, indent=2, default=str)}

Transcript (queries, replies, routing, spec excerpts, case file):
{json.dumps(transcript, indent=2, default=str)}

Return ONLY valid JSON matching this schema:
{{
  "criteria": [
    {{"id": "<rubric id>", "layer": "<layer tag>", "score": 0, "reason": "..."}}
  ],
  "turn_swot": {{
    "strengths": ["..."],
    "weaknesses": ["..."],
    "opportunities": ["..."],
    "threats": ["..."]
  }},
  "diagnosis": "one-line: which layer is the bottleneck this turn",
  "verdict": "ship | tune | broken"
}}

Verdict guidance (your suggestion — caller may recompute):
- any 0 on load-bearing criterion → broken
- mostly 2s with tune-able cause → tune
- mostly 3s → ship

turn_swot must appreciate the turn's quality in the system's own behaviour — not generic praise."""


def _parse_grader_json(raw: str, rubric: list[RubricCriterion]) -> GraderOutput:
    content = raw.strip()
    if "```" in content:
        parts = content.split("```")
        for part in parts:
            chunk = part.strip()
            if chunk.startswith("json"):
                chunk = chunk[4:].strip()
            if chunk.startswith("{"):
                content = chunk
                break
    data = json.loads(content)
    out = GraderOutput.model_validate(data)
    rubric_ids = {r.id for r in rubric}
    seen = {c.id for c in out.criteria}
    if rubric_ids - seen:
        raise ValueError(f"grader omitted criteria: {sorted(rubric_ids - seen)}")
    return out


def grade_with_llm(
    *,
    agent_id: str,
    case_id: str,
    case_label: str,
    rubric: list[RubricCriterion],
    transcript: dict[str, Any],
    structural_signals: dict[str, Any],
    model: str | None = None,
) -> BehavioralGradeResult:
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    judge_model = model or DEFAULT_GRADER_MODEL
    if not api_key:
        result = grade_heuristic(
            agent_id=agent_id,
            case_id=case_id,
            case_label=case_label,
            rubric=rubric,
            transcript=transcript,
            structural_signals=structural_signals,
        )
        result.note = "ANTHROPIC_API_KEY not set — heuristic only (audit grader separately)"
        return result

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)
        prompt = _build_grader_prompt(
            agent_id=agent_id,
            case_label=case_label,
            rubric=rubric,
            transcript=transcript,
            structural_signals=structural_signals,
        )
        message = client.messages.create(
            model=judge_model,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        parsed = _parse_grader_json(message.content[0].text, rubric)
        computed = compute_verdict(parsed.criteria, rubric)
        diagnosis = parsed.diagnosis.strip() or build_diagnosis(parsed.criteria, rubric)
        return BehavioralGradeResult(
            agent_id=agent_id,
            case_id=case_id,
            method="llm",
            model=judge_model,
            criteria=parsed.criteria,
            turn_swot=parsed.turn_swot,
            diagnosis=diagnosis,
            verdict=computed,
            grader_verdict=parsed.verdict,
            structural_signals=structural_signals,
            transcript=transcript,
        )
    except (ValidationError, json.JSONDecodeError, KeyError, ValueError) as exc:
        result = grade_heuristic(
            agent_id=agent_id,
            case_id=case_id,
            case_label=case_label,
            rubric=rubric,
            transcript=transcript,
            structural_signals=structural_signals,
        )
        result.method = "heuristic_fallback"
        result.llm_error = str(exc)
        result.note = "LLM grader failed — heuristic fallback"
        return result
    except Exception as exc:
        result = grade_heuristic(
            agent_id=agent_id,
            case_id=case_id,
            case_label=case_label,
            rubric=rubric,
            transcript=transcript,
            structural_signals=structural_signals,
        )
        result.method = "heuristic_fallback"
        result.llm_error = str(exc)
        result.note = "LLM grader error — heuristic fallback"
        return result


def grade_heuristic(
    *,
    agent_id: str,
    case_id: str,
    case_label: str,
    rubric: list[RubricCriterion],
    transcript: dict[str, Any],
    structural_signals: dict[str, Any],
) -> BehavioralGradeResult:
    """Structural proxy — NOT practitioner voice. Use when calibrating without API key."""
    sig = structural_signals
    graded: list[GradedCriterion] = []

    for item in rubric:
        score, reason = _heuristic_score(item, sig, transcript)
        graded.append(
            GradedCriterion(
                id=item.id,
                layer=item.layer,
                score=score,
                reason=reason,
            )
        )

    verdict = compute_verdict(graded, rubric)
    swot = _heuristic_swot(graded, sig)
    return BehavioralGradeResult(
        agent_id=agent_id,
        case_id=case_id,
        method="heuristic",
        model=None,
        criteria=graded,
        turn_swot=swot,
        diagnosis=build_diagnosis(graded, rubric),
        verdict=verdict,
        structural_signals=structural_signals,
        transcript=transcript,
        note="Heuristic proxy — calibrate grader against human read before trusting",
    )


def _primary_turn(transcript: dict[str, Any]) -> dict[str, Any]:
    turns = transcript.get("turns") or []
    return turns[-1] if turns else {}


def _heuristic_score(
    item: RubricCriterion,
    sig: dict[str, Any],
    transcript: dict[str, Any],
) -> tuple[int, str]:
    turn = _primary_turn(transcript)
    reply = str(turn.get("reply") or "")
    reply_lower = reply.lower()

    if item.id.endswith("_warm_greeting") or item.id.endswith("_warm_redirect"):
        if sig.get("route") == "chat" and len(reply.split()) >= 3:
            return 2, "chat route with non-empty reply (warmth not verified)"
        return 1, "route or reply thin"

    if item.id.endswith("_no_canvas") or "no_canvas" in item.id:
        if not sig.get("update_canvas"):
            return 2, "update_canvas=false"
        return 0, "canvas updated on greeting turn"

    if item.id.endswith("_no_brick_wall"):
        brick = any(
            p in reply_lower
            for p in ("i can't help", "i cannot help", "outside my scope", "not allowed")
        )
        return (0 if brick else 2, "brick-wall phrase detected" if brick else "no obvious brick wall")

    if item.id.endswith("_routing_find_path") or "find_path" in item.id:
        outcome = sig.get("outcome_hint")
        if outcome == "find_path":
            return 3, "outcome_hint=find_path"
        if outcome == "orient" and sig.get("route") == "substantive":
            return 0, "routed orient — expected find_path (C1)"
        return 1, f"outcome_hint={outcome!r}"

    if item.id.endswith("_t3_surface") or "t3" in item.id:
        recipe = sig.get("recipe")
        if recipe == "OpportunityList":
            return 0, "OpportunityList (R4) — expected T3 find-my-path surface"
        if sig.get("declared_in_markup"):
            return 2, "declared block present; T3 template not structurally verified"
        return 1, "no declared block or T3 markers"

    if "declared_persist" in item.id or item.id.endswith("_writeback"):
        count = int(sig.get("case_file_count") or 0)
        if count >= 1:
            return 2, f"case_file has {count} declared claim(s)"
        return 0, "case file empty after turn"

    if "followup_reference" in item.id or "n_plus_1" in item.id:
        if sig.get("followup_references_prior_declared"):
            return 2, "follow-up reply references prior declared situation"
        if sig.get("follow_up_ran"):
            return 1, "follow-up ran but no structural declared reference"
        return 2, "single-turn case — follow-up persistence not exercised"

    if item.id.endswith("_direct_answer") or "over_reframe" in item.id:
        reframe = any(
            p in reply_lower
            for p in ("before we answer", "let me reframe", "what you really mean", "the real question is")
        )
        if reframe and sig.get("route") == "substantive":
            return 0, "pre-emptive reframe on clean analyst query"
        if sig.get("update_canvas"):
            return 2, "substantive canvas update without obvious reframe"
        return 1, "inconclusive"

    if item.layer == "retrieval":
        lane = sig.get("lane_mode")
        if lane in ("dual", "corpus_primary") and int(sig.get("corpus_count") or 0) > 0:
            return 2, f"lane_mode={lane} with corpus hits"
        if lane == "corpus_only":
            return 1, "corpus_only — web lane may be thin"
        return 1, f"lane_mode={lane!r}"

    if item.layer == "reasoning":
        if len(reply.split()) >= 40:
            return 2, "substantive reply length — tension handling not verified"
        return 1, "short reply — reasoning depth not verified"

    if item.layer == "disposition":
        if sig.get("route") == "chat":
            return 2, "chat disposition path"
        return 1, "disposition not structurally verified"

    return 1, "heuristic default — needs LLM grader"


def _heuristic_swot(graded: list[GradedCriterion], sig: dict[str, Any]) -> TurnSwot:
    strengths: list[str] = []
    weaknesses: list[str] = []
    opportunities: list[str] = []
    threats: list[str] = []

    for c in graded:
        if c.score >= 3:
            strengths.append(f"{c.id}: {c.reason}")
        elif c.score <= 1:
            weaknesses.append(f"{c.id} ({c.layer}): {c.reason}")
            opportunities.append(
                f"Raise {c.id} via {_LAYER_FIX_HINT.get(c.layer, c.layer)}"
            )

    if sig.get("route") == "chat" and not sig.get("update_canvas"):
        strengths.append("Kept canvas unchanged on lightweight turn")
    if sig.get("outcome_hint") == "orient" and "find_path" in str(sig.get("case_id", "")):
        threats.append("Mis-route to orient will scale badly for practitioner uncertainty")

    return TurnSwot(
        strengths=strengths[:4],
        weaknesses=weaknesses[:4],
        opportunities=opportunities[:4],
        threats=threats[:3],
    )


def grade_turn(
    *,
    agent_id: str,
    case_id: str,
    case_label: str,
    rubric: list[RubricCriterion],
    transcript: dict[str, Any],
    structural_signals: dict[str, Any],
    prefer_heuristic: bool | None = None,
) -> BehavioralGradeResult:
    use_heuristic = prefer_heuristic
    if use_heuristic is None:
        use_heuristic = os.getenv("EVAL_HEURISTIC_JUDGE_ONLY", "").lower() in (
            "1",
            "true",
            "yes",
        )
    if use_heuristic:
        return grade_heuristic(
            agent_id=agent_id,
            case_id=case_id,
            case_label=case_label,
            rubric=rubric,
            transcript=transcript,
            structural_signals=structural_signals,
        )
    return grade_with_llm(
        agent_id=agent_id,
        case_id=case_id,
        case_label=case_label,
        rubric=rubric,
        transcript=transcript,
        structural_signals=structural_signals,
    )
