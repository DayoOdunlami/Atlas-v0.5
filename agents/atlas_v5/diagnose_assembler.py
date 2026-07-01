"""Diagnose turn — evidence gap matrix from corpus stats + blindspot structure."""

from __future__ import annotations

from agents.atlas_v5.intent import is_strategy_alignment_query
from agents.atlas_v5.j1t1_assembler import assemble_j1t1_spec, format_gbp_compact
from agents.atlas_v5.j1t1_types import J1T1CorpusStats
from agents.contracts.answer_spec import AnswerSpec


def _build_corpus_hygiene_dimensions(stats: J1T1CorpusStats, object_label: str) -> list[dict]:
    funding_display = format_gbp_compact(stats.funding_sum)
    iuk = next((f for f in stats.funders if f.lead_funder == "Innovate UK"), None)
    epsrc = next((f for f in stats.funders if f.lead_funder == "EPSRC"), None)

    dims: list[dict] = [
        {
            "id": "funding",
            "label": "Funding completeness",
            "verdict": "GAP" if stats.null_funding_count > stats.project_count * 0.2 else "PARTIAL",
            "signal": (
                f"{stats.null_funding_count}/{stats.project_count} projects with no funding figure · "
                f"floor {funding_display}"
            ),
            "move": "Ingest grant annexes and TRIG rows to close null concentration",
        },
        {
            "id": "programme",
            "label": "National programme layer",
            "verdict": "GAP",
            "signal": "Corpus captures SME grant tier; multi-billion infrastructure programmes absent",
            "move": "Enable web lane or ingest DfT / programme datasets",
        },
        {
            "id": "partners",
            "label": "Consortium / partner coverage",
            "verdict": "GAP",
            "signal": "Lead-org-only recording under-counts consortium depth",
            "move": "Ingest partnership schedules (RSSB, Innovate UK annexes)",
        },
    ]

    if iuk:
        dims.append(
            {
                "id": "funder-mix",
                "label": "Funder diversity",
                "verdict": "PARTIAL" if iuk.project_count < stats.project_count else "HAVE",
                "signal": (
                    f"Innovate UK {iuk.project_count}/{stats.project_count} projects · "
                    f"{format_gbp_compact(iuk.funding_sum)} recorded"
                ),
                "move": "Cross-check EPSRC and industry co-funding rows",
            }
        )

    if epsrc and epsrc.null_funding_count == epsrc.project_count:
        dims.append(
            {
                "id": "epsrc",
                "label": "Research council awards",
                "verdict": "MOVE",
                "signal": f"All {epsrc.project_count} EPSRC rows at £0 — structured missingness",
                "move": "Reconcile EPSRC funding_amount ingestion pipeline",
            }
        )

    dims.append(
        {
            "id": "freshness",
            "label": "Live activity",
            "verdict": "HAVE" if stats.live_since_2024 >= 10 else "PARTIAL",
            "signal": f"{stats.live_since_2024} projects live since 2024 in {object_label} slice",
            "move": "Refresh stale end_dates on closed programmes",
        }
    )
    return dims


def _build_strategy_alignment_dimensions(stats: J1T1CorpusStats, object_label: str) -> list[dict]:
    funding_display = format_gbp_compact(stats.funding_sum)
    return [
        {
            "id": "concordance",
            "label": "Published concordance",
            "verdict": "GAP",
            "signal": (
                "No CPC–DfT or CPC–Innovate UK alignment mapping in corpus or web lane"
            ),
            "move": (
                "One-time tagging: map project abstracts to Better Connected pillars "
                "and Innovate UK SDP themes"
            ),
        },
        {
            "id": "pillar-tags",
            "label": "Programme pillar tags",
            "verdict": "GAP",
            "signal": (
                f"{stats.project_count} projects in {object_label} slice — "
                "none tagged to external strategy pillars"
            ),
            "move": "Add pillar dimension to atlas.projects or run offline concordance pass",
        },
        {
            "id": "t1-docs",
            "label": "T1 strategy documents",
            "verdict": "PARTIAL",
            "signal": (
                "Better Connected and Innovate UK SDP ingested as T1 anchors — "
                "searchable but not linked to project rows"
            ),
            "move": "Cite T1 docs in alignment briefs; wire document→project theme proximity",
        },
        {
            "id": "thematic-overlap",
            "label": "Thematic overlap (inferred)",
            "verdict": "PARTIAL",
            "signal": (
                "CAM, decarbonisation, and place-based digital appear in corpus abstracts "
                "and both external frameworks — inferential only"
            ),
            "move": "Promote to Supported only after pillar tagging closes concordance gap",
        },
        {
            "id": "programme-scale",
            "label": "National programme layer",
            "verdict": "GAP",
            "signal": (
                f"Corpus floor {funding_display} captures grant tier; "
                "multi-billion infrastructure programmes absent"
            ),
            "move": "Enable web lane comparison or ingest DfT programme datasets",
        },
        {
            "id": "freshness",
            "label": "Live portfolio activity",
            "verdict": "HAVE" if stats.live_since_2024 >= 10 else "PARTIAL",
            "signal": f"{stats.live_since_2024} projects live since 2024 in {object_label} slice",
            "move": "Refresh stale end_dates; re-run alignment after corpus update",
        },
    ]


def _build_dimensions(stats: J1T1CorpusStats, object_label: str, query: str) -> list[dict]:
    if is_strategy_alignment_query(query):
        return _build_strategy_alignment_dimensions(stats, object_label)
    return _build_corpus_hygiene_dimensions(stats, object_label)


def assemble_diagnose_spec(
    stats: J1T1CorpusStats,
    *,
    query: str,
    object_label: str = "Rail decarbonisation",
    prior_summary: str | None = None,
) -> AnswerSpec:
    orient = assemble_j1t1_spec(stats)
    strategy = is_strategy_alignment_query(query)
    dimensions = _build_dimensions(stats, object_label, query)
    gap_count = sum(1 for d in dimensions if d["verdict"] in ("GAP", "MOVE"))

    if strategy:
        scope = f"STRATEGY ALIGNMENT · {gap_count} GAPS · DIAGNOSE"
        tier = "Indicative"
        tier_cap = (
            "No published concordance — alignment claims are structural/inferential until "
            "pillar tagging completes"
        )
        verdict_sentence = (
            "CPC portfolio overlap with DfT Better Connected and Innovate UK SDP is "
            "structural and inferential — no published concordance exists, so this canvas "
            "cannot certify pillar-level alignment."
        )
        verdict_tail = (
            "The highest-leverage close is a one-time tagging exercise: map project abstracts "
            "to Better Connected pillars and IUK SDP themes. Until then, use T1 strategy "
            "documents for policy intent and corpus projects for thematic pattern only."
        )
        one_decision = (
            "Run the concordance tagging exercise before using alignment for investment cases"
        )
        gate = (
            "Close concordance + pillar-tag gaps before alignment claims drive budget decisions"
        )
    else:
        scope = f"CORPUS · {gap_count} GAPS · DIAGNOSE"
        tier = "Indicative" if gap_count >= 3 else "Supported"
        tier_cap = f"Gap matrix from live aggregate; {gap_count} dimensions flagged GAP/MOVE"
        verdict_sentence = (
            f"The corpus is structurally thin on {gap_count} dimensions — "
            "this is missingness you can close, not random noise."
        )
        verdict_tail = (
            "Funding floors and partner coverage are under-counts by design. "
            "National programme spend and CPC TRIG remain the highest-leverage ingestion gates."
        )
        one_decision = (
            "Which gap blocks your next move — TRIG ingestion, web augmentation, or partner graph?"
        )
        gate = "Close TRIG + null funding concentration before gap analysis drives investment."

    spec = orient.model_copy(
        update={
            "object": object_label,
            "mode": "Diagnose",
            "scope": scope,
            "tier": tier,
            "tierCapReason": tier_cap,
            "verdict": {
                "sentence": verdict_sentence,
                "tail": verdict_tail,
            },
            "instrument": {
                "recipe": "EvidenceGapMatrix",
                "data": {
                    "dimensions": dimensions,
                    "subjectQuery": query,
                    "strategyAlignment": strategy,
                },
                "honesty": {
                    "toScale": False,
                    "label": (
                        "strategy alignment gaps — policy concordance"
                        if strategy
                        else "verdict matrix — corpus-grounded gaps only"
                    ),
                },
            },
            "soWhat": {
                "lookingAt": (
                    f"A strategy alignment diagnose on {object_label.lower()}"
                    if strategy
                    else f"A diagnose pass on {object_label.lower()} — "
                    f"{gap_count} load-bearing gaps before you commit budget."
                ),
                "oneDecision": one_decision,
                "gate": gate,
                "primaryAction": (
                    "Start concordance tagging → pillar map"
                    if strategy
                    else "Pick top gap → ingestion or web pass"
                ),
                "turn": "2 / 4",
            },
            "carriedFrom": {
                "turn": 2,
                "of": 4,
                "summary": prior_summary or f"From orient: {stats.project_count} projects",
                "fromTurns": [1, 2],
                "evolvedFields": ["mode", "instrument", "verdict", "blindspot"],
            },
            "query": query,
        }
    )
    return AnswerSpec.model_validate(spec.model_dump(mode="json"))
