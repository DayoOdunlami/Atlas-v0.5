"""Find-my-path skeleton — T3 surface seed (Increment 1B). Not R4 OpportunityList."""

from __future__ import annotations

from agents.atlas_v5.case_file import (
    CaseClaim,
    declared_markup_block,
    to_answer_spec_claims,
)
from agents.atlas_v5.j1t1_assembler import format_gbp_compact
from agents.atlas_v5.j1t1_types import J1T1CorpusStats
from agents.atlas_v5.wide_pass import WidePassResult
from agents.contracts.answer_spec import (
    AnswerSpec,
    Blindspot,
    CanvasBlock,
    SoWhat,
    Stat,
    Verdict,
)


def build_find_path_markup(claims: list[CaseClaim], query: str) -> str:
    """Public wrapper — T3 canvas seed with find-my-path testid."""
    return _find_path_markup(claims, query)


def _t3_markup_valid(markup: str) -> bool:
    """T3 requires find-my-path wrapper before any orphan declared panel."""
    if 'data-testid="find-my-path"' not in markup:
        return False
    fp = markup.find('data-testid="find-my-path"')
    dec = markup.find('data-testid="declared-situation"')
    if dec >= 0 and dec < fp:
        return False
    return fp < 800


def enforce_find_path_surface(
    spec: AnswerSpec,
    wide: WidePassResult,
    session_claims: list[CaseClaim],
) -> AnswerSpec:
    """Kill R4 recipe leakage; guarantee T3 testid when wide pass routed find_path."""
    markup = (spec.canvas.merged_markup if spec.canvas else "") or ""
    object_label = wide.object_label or "your situation"
    scope = f"PRACTITIONER · FIND PATH · {object_label[:48]}"
    if not _t3_markup_valid(markup):
        markup = build_find_path_markup(session_claims, wide.query)
    gate_status = spec.canvas.gate_status if spec.canvas else "pass"
    return spec.model_copy(
        update={
            "mode": "FindPath",
            "object": object_label,
            "scope": scope,
            "instrument": None,
            "chart": None,
            "canvas": CanvasBlock(merged_markup=markup, gate_status=gate_status),
        }
    )


def _find_path_markup(claims: list[CaseClaim], query: str) -> str:
    declared = declared_markup_block(claims)
    reflected = (
        '<p data-testid="find-path-reflection" style="font-size:13px;line-height:1.5;'
        'color:#2E2A24;margin:12px 0">'
        "Working through what you're really trying to decide — matches will appear here "
        "once Atlas has shaped the evidence."
        "</p>"
    )
    matches_shell = (
        '<section data-testid="find-path-matches" style="margin-top:16px">'
        '<div style="font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.08em;'
        'color:#56524C;margin-bottom:8px">POSSIBLE PATHS · BORROWED + OWNED</div>'
        '<ul style="margin:0;padding-left:16px;font-size:12.5px;color:#46423C">'
        "<li>Deep pass will add at most 1–3 corpus/web matches — not a ranked list.</li>"
        "</ul></section>"
    )
    body = declared + reflected + matches_shell
    return (
        f'<section data-testid="find-my-path" data-surface="T3" '
        f'data-query="{_esc(query[:200])}">{body}</section>'
    )


def _esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def assemble_find_path_spec(wide: WidePassResult) -> AnswerSpec:
    """Minimal find_path skeleton — deep pass composes T3 markup; instrument stays null."""
    stats = wide.stats
    session_claims: list[CaseClaim] = list(wide.session_claims or [])
    spec_claims = to_answer_spec_claims(session_claims)
    object_label = wide.object_label or "your situation"
    scope = f"PRACTITIONER · FIND PATH · {object_label[:48]}"

    stat_rows = None
    if stats:
        stat_rows = [
            Stat(
                value=str(stats.project_count),
                label="Corpus projects (context)",
                provId="stats.project_count",
                tone="corpus",
            ),
            Stat(
                value=format_gbp_compact(stats.funding_sum),
                label="Funding floor (context)",
                provId="stats.funding_sum",
                tone="corpus",
            ),
        ]

    verdict_sentence = (
        "You're working through an half-formed question — let's surface what you're "
        "really trying to decide before ranking options."
    )
    if session_claims:
        kinds = {c.kind for c in session_claims}
        if "uncertainty" in kinds:
            verdict_sentence = (
                "You've named the uncertainty directly — the next move is to reflect the "
                "question beneath your question, then match 1–3 realistic paths."
            )

    markup = build_find_path_markup(session_claims, wide.query)

    return AnswerSpec(
        object=object_label,
        scope=scope,
        mode="FindPath",
        tier="Indicative",
        tierCapReason="Declared user situation · max Indicative until evidence checked",
        verdict=Verdict(
            sentence=verdict_sentence,
            tail="Practitioner find-path — not a landscape orient brief.",
        ),
        stats=stat_rows,
        blindspot=Blindspot(
            sign="absence",
            gap="Paths depend on your stated constraints — corpus matches are illustrative.",
            closable="Refine declared claims; Atlas will re-match.",
        ),
        instrument=None,
        chart=None,
        canvas=CanvasBlock(merged_markup=markup, gate_status="pass"),
        claims=spec_claims,
        soWhat=SoWhat(
            lookingAt=f"Find my path · {object_label}",
            oneDecision="Name the real question before picking a funding or partner route.",
            gate="Declared · max Indicative",
            primaryAction="Reflect the question beneath your question",
            turn="FindPath · T3",
        ),
        query=wide.query,
    )
