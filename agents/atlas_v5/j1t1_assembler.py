"""
GATE 2 — assemble validated AnswerSpec from J1T1 corpus stats.

Deterministic synthesis for J1T1 orient (matches mouth bootstrap).
Heavy model pass plugs in here for non-J1T1 / generative turns.
"""

from __future__ import annotations

from agents.atlas_v5.j1t1_types import J1T1CorpusStats
from agents.contracts.answer_spec import AnswerSpec

WEB_UPPER_GBP = 11_700_000_000.0


def format_gbp_compact(amount: float, *, approximate: bool = False) -> str:
    abs_amt = abs(amount)
    if abs_amt >= 1_000_000_000:
        bn = abs_amt / 1_000_000_000
        label = (
            f"{bn:.1f}".rstrip("0").rstrip(".")
            if approximate or bn < 10
            else f"{bn:.0f}"
        )
        return f"~£{label}bn" if approximate else f"£{label}bn"
    if abs_amt >= 1_000_000:
        return f"£{abs_amt / 1_000_000:.2f}m"
    if abs_amt >= 1_000:
        return f"£{round(abs_amt / 1_000)}k"
    return f"£{round(abs_amt)}"


def _format_ratio(upper: float, lower: float) -> str:
    if lower <= 0:
        return "—"
    ratio = upper / lower
    if ratio >= 100:
        rounded = round(ratio / 10) * 10
        return f"≈ {rounded:,}×"
    return f"≈ {round(ratio)}×"


def _build_blindspot_structure(stats: J1T1CorpusStats) -> dict[str, str]:
    epsrc = next((f for f in stats.funders if f.lead_funder == "EPSRC"), None)
    iuk = next((f for f in stats.funders if f.lead_funder == "Innovate UK"), None)
    epsrc_nulls = epsrc.null_funding_count if epsrc else 0
    iuk_nulls = iuk.null_funding_count if iuk else 0
    iuk_count = iuk.project_count if iuk else 0

    if epsrc and epsrc_nulls > 0:
        pattern = (
            f"Nulls concentrate in EPSRC research-council awards ({epsrc_nulls} of "
            f"{stats.null_funding_count} nulls; all {epsrc.project_count} EPSRC projects "
            f"at £0 recorded); Innovate UK {iuk_nulls} null in {iuk_count}."
        )
    else:
        pattern = (
            f"{stats.null_funding_count} of {stats.project_count} projects carry no "
            "funding figure — structured missingness, not random holes."
        )

    iuk_sum = iuk.funding_sum if iuk else 0
    if iuk and iuk_sum > 0:
        implication = (
            f"{format_gbp_compact(stats.funding_sum)} ≈ complete Innovate UK innovation "
            "spend in this slice — a structured floor, not a random hole."
        )
    else:
        implication = (
            f"Known funding is a floor ({format_gbp_compact(stats.funding_sum)}) — "
            "null rows are concentrated by funder, not scattered."
        )

    return {"pattern": pattern, "implication": implication}


def _epsrc_count(stats: J1T1CorpusStats) -> int:
    epsrc = next((f for f in stats.funders if f.lead_funder == "EPSRC"), None)
    return epsrc.project_count if epsrc else 0


def assemble_j1t1_spec(stats: J1T1CorpusStats) -> AnswerSpec:
    funding_display = format_gbp_compact(stats.funding_sum)
    iuk = next((f for f in stats.funders if f.lead_funder == "Innovate UK"), None)
    iuk_display = format_gbp_compact(iuk.funding_sum) if iuk else "—"
    ratio_label = _format_ratio(WEB_UPPER_GBP, stats.funding_sum)
    blindspot_structure = _build_blindspot_structure(stats)
    funding_formatted = f"{stats.funding_sum:,.2f}"

    return AnswerSpec.model_validate(
        {
            "specVersion": "0.2.1",
            "object": "Rail decarbonisation",
            "scope": f"CORPUS · {stats.project_count} OBJECTS · ORIENT",
            "mode": "Orient",
            "tier": "Supported" if stats.funded_row_count >= 30 else "Indicative",
            "tierCapReason": (
                f"{stats.funded_row_count} funded corpus rows with verified UUIDs; "
                "web £ context capped candidate"
            ),
            "verdict": {
                "sentence": (
                    "The corpus sees a busy but small-money field — and it's blind to "
                    "the part that matters most."
                ),
                "tail": (
                    "A thin, Innovate-UK-funded SME innovation layer sits beneath a national "
                    "electrification programme the corpus can't see. Any CPC play has to know "
                    "which tier it's entering."
                ),
            },
            "stats": [
                {
                    "value": str(stats.project_count),
                    "label": "projects",
                    "provId": "stat-corpus",
                    "tone": "corpus",
                },
                {
                    "value": funding_display,
                    "label": "known funding · a floor",
                    "provId": "stat-corpus",
                    "tone": "corpus",
                },
                {
                    "value": str(stats.live_since_2024),
                    "label": "live since 2024",
                    "provId": "stat-corpus",
                    "tone": "corpus",
                },
                {
                    "value": str(stats.org_count),
                    "label": "lead organisations",
                    "provId": "stat-corpus",
                    "tone": "corpus",
                },
            ],
            "blindspot": {
                "sign": "undercount",
                "gap": (
                    f"CPC TRIG grants and national programme spend are absent from the corpus — "
                    f"{funding_display} is the SME grant tier only."
                ),
                "closable": (
                    "Closable by ingestion for CPC-owned rows; national programme remains web context."
                ),
                "secondary": (
                    f"{stats.null_funding_count} of {stats.project_count} projects carry no "
                    "funding figure — not random missingness."
                ),
                "structure": blindspot_structure,
            },
            "instrument": {
                "recipe": "IncommensurableMagnitudes",
                "data": {
                    "upper": {
                        "label": "National electrification programme",
                        "display": format_gbp_compact(WEB_UPPER_GBP, approximate=True),
                        "source": "web",
                        "note": "11,700 single-track-km × ~£1m/km (TDNS)",
                    },
                    "lower": {
                        "label": "SME innovation layer (corpus)",
                        "display": funding_display,
                        "source": "corpus",
                        "note": (
                            f"{stats.project_count} projects · "
                            f"{iuk.project_count if iuk else 0} Innovate UK · "
                            "a floor, not a total"
                        ),
                    },
                    "ratioLabel": ratio_label,
                    "ratioNote": "three orders of magnitude — the gap is the finding",
                },
                "honesty": {"toScale": False, "label": "axis compressed at the gap"},
            },
            "claims": [],
            "corpus_citations": stats.top_citations,
            "hive_citations": [],
            "web_evidence": [
                {
                    "id": "ext-tdns-gbr",
                    "title": "TDNS / GBR strategy context",
                    "url": "https://www.gov.uk/",
                    "publisher": "DfT",
                    "verification_state": "candidate",
                    "provenance": "external",
                }
            ],
            "provenance": {
                "stat-corpus": {
                    "ref": "atlas.projects · aggregate",
                    "scope": (
                        "rail + decarbonisation · cpc_modes ∋ rail · "
                        "cpc_themes ∋ decarbonisation"
                    ),
                    "trust": "corpus",
                    "trustNote": (
                        f"SUM(funding_amount)={funding_formatted} over "
                        f"{stats.funded_row_count} funded rows; "
                        f"{stats.null_funding_count}/{stats.project_count} null"
                    ),
                    "row": "corpus aggregate",
                },
                "mag-upper": {
                    "ref": "web context · TDNS / GBR strategy",
                    "scope": "national programme",
                    "trust": "web",
                    "trustNote": "No atlas.projects.id — candidate only; compressed axis",
                    "row": "[W1·W2·W3]",
                },
                "funder": {
                    "ref": "atlas.projects · group by lead_funder",
                    "scope": "rail + decarbonisation",
                    "trust": "corpus",
                    "trustNote": (
                        f"Innovate UK = {iuk.project_count} of {stats.project_count} projects "
                        f"and {iuk_display} of {funding_display}. "
                        f"EPSRC = {_epsrc_count(stats)} projects, £0 recorded."
                        if iuk
                        else "Funder breakdown from live aggregate"
                    ),
                    "row": "corpus aggregate",
                },
            },
            "reconciliation": {
                "notes": [],
                "retrieval": {
                    "lane_mode": "corpus_only",
                    "corpus_count": stats.project_count,
                    "external_count": 0,
                    "candidate_count": 0,
                    "conflict_count": 0,
                    "errors": [],
                    "external_skipped": True,
                    "corpus_thin": stats.project_count < 20,
                },
            },
            "soWhat": {
                "lookingAt": (
                    "A two-tier field. The instrument is the whole story — what we fund "
                    "is a sliver of what's being spent."
                ),
                "oneDecision": (
                    "Which tier are we entering — the SME innovation layer we can see, or "
                    "the national programme we can't? It changes every downstream move."
                ),
                "gate": (
                    "Close the TRIG blind-spot before you commit budget. "
                    "It's the one gap you control."
                ),
                "primaryAction": "Diagnose the thinness → Ingest TRIG",
                "turn": "1 / 4",
            },
            "query": "State of play on rail decarbonisation in our corpus",
        }
    )
