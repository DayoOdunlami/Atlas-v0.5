"""Diagnose turn — evidence gap matrix from corpus stats + blindspot structure."""

from __future__ import annotations

from agents.atlas_v5.j1t1_assembler import assemble_j1t1_spec, format_gbp_compact
from agents.atlas_v5.j1t1_types import J1T1CorpusStats
from agents.contracts.answer_spec import AnswerSpec


def _build_dimensions(stats: J1T1CorpusStats, object_label: str) -> list[dict]:
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


def assemble_diagnose_spec(
    stats: J1T1CorpusStats,
    *,
    query: str,
    object_label: str = "Rail decarbonisation",
    prior_summary: str | None = None,
) -> AnswerSpec:
    orient = assemble_j1t1_spec(stats)
    dimensions = _build_dimensions(stats, object_label)
    gap_count = sum(1 for d in dimensions if d["verdict"] in ("GAP", "MOVE"))

    spec = orient.model_copy(
        update={
            "object": object_label,
            "mode": "Diagnose",
            "scope": f"CORPUS · {gap_count} GAPS · DIAGNOSE",
            "tier": "Indicative" if gap_count >= 3 else "Supported",
            "tierCapReason": (
                f"Gap matrix from live aggregate; {gap_count} dimensions flagged GAP/MOVE"
            ),
            "verdict": {
                "sentence": (
                    f"The corpus is structurally thin on {gap_count} dimensions — "
                    "this is missingness you can close, not random noise."
                ),
                "tail": (
                    "Funding floors and partner coverage are under-counts by design. "
                    "National programme spend and CPC TRIG remain the highest-leverage ingestion gates."
                ),
            },
            "instrument": {
                "recipe": "EvidenceGapMatrix",
                "data": {
                    "dimensions": dimensions,
                    "subjectQuery": query,
                },
                "honesty": {
                    "toScale": False,
                    "label": "verdict matrix — corpus-grounded gaps only",
                },
            },
            "soWhat": {
                "lookingAt": (
                    f"A diagnose pass on {object_label.lower()} — "
                    f"{gap_count} load-bearing gaps before you commit budget."
                ),
                "oneDecision": (
                    "Which gap blocks your next move — TRIG ingestion, web augmentation, or partner graph?"
                ),
                "gate": "Close TRIG + null funding concentration before gap analysis drives investment.",
                "primaryAction": "Pick top gap → ingestion or web pass",
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
