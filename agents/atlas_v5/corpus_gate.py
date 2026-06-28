"""
Corpus evidence gate — block cosmetic canvas when there is nothing verified to show.

Policy: no orient/connect/act canvas without SQL stats OR at least one verified project hit
(semantic / Postgres). ILIKE keyword matches are not used. Online-only requires consent.
"""

from __future__ import annotations

from typing import Any

from agents.atlas_v5.online_only import build_online_only_offer, corpus_connectivity_note
from agents.atlas_v5.rest_fallback_assembler import _corpus_hits
from agents.atlas_v5.turn_classifier import TurnDecision
from agents.atlas_v5.wide_pass import WidePassResult
from mcps.cpc_corpus import transport

MIN_VERIFIED_PROJECT_HITS = 1


class CorpusEvidenceRequired(Exception):
    """Substantive canvas cannot be assembled without verified corpus evidence."""


def verified_project_hits(wide: WidePassResult) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for h in _corpus_hits(wide):
        pid = str(h.get("id") or "").strip()
        if len(pid) >= 32 and pid.count("-") >= 4:
            out.append(h)
    return out


def can_compose_substantive_canvas(
    wide: WidePassResult,
    *,
    online_only: bool = False,
) -> bool:
    """True when an orient-style canvas is allowed (real evidence present)."""
    if online_only:
        return True
    if wide.stats is not None:
        return True
    if wide.outcome == "find_path":
        return True
    if wide.outcome == "connect" and wide.graph is not None:
        return True
    return len(verified_project_hits(wide)) >= MIN_VERIFIED_PROJECT_HITS


def insufficient_evidence_note(wide: WidePassResult) -> str:
    tier = transport.get_last_transport()
    n = len(verified_project_hits(wide))
    parts: list[str] = []

    if tier == "unavailable":
        note = corpus_connectivity_note()
        return note or "CPC corpus unreachable on all transport tiers."

    if n == 0:
        parts.append(
            "Corpus is reachable but **no verified atlas.projects matches** were returned "
            "for this question (semantic search only — no keyword guessing)."
        )
    if wide.stats is None:
        parts.append(
            "SQL aggregate stats are unavailable (Postgres pooler blocked or timed out)."
        )
    parts.append(
        "Atlas will not paint an orient canvas with zero verified corpus evidence."
    )
    return " ".join(parts)


def substantive_blocked_offer(
    wide: WidePassResult,
    query: str,
    decision: TurnDecision,
    *,
    online_only: bool = False,
) -> dict[str, Any] | None:
    """Return chat-only consent offer when canvas would be misleading; else None."""
    if can_compose_substantive_canvas(wide, online_only=online_only):
        return None
    note = insufficient_evidence_note(wide)
    offer = build_online_only_offer(query, decision, corpus_note=note)
    dev_meta = offer.get("dev_meta") or {}
    offer["dev_meta"] = {
        **dev_meta,
        "corpus_status": "insufficient_evidence",
        "corpus_gate": {
            "verified_hits": len(verified_project_hits(wide)),
            "transport": transport.get_last_transport(),
            "stats_available": wide.stats is not None,
        },
        "disposition": {
            **(dev_meta.get("disposition") or {}),
            "composition_mode": "corpus_insufficient_offer",
            "reasoning": "No verified corpus evidence — canvas withheld pending consent",
        },
    }
    return offer
