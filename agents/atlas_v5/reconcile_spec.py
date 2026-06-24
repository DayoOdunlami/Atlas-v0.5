"""Dual-peer reconciliation — corpus and web are parallel sources, not ranked."""

from __future__ import annotations

from typing import Any

from agents.contracts.answer_spec import (
    AnswerSpec,
    Claim,
    ProvenanceEntry,
    Reconciliation,
    ReconciliationNote,
    RetrievalMeta,
    WebEvidence,
)
from agents.orchestrator.retrieval_fabric import EvidenceBag

_TIER_ORDER = ("Speculative", "Indicative", "Supported", "Robust")


def _tier_rank(tier: str) -> int:
    try:
        return _TIER_ORDER.index(tier)
    except ValueError:
        return 0


def _cap_tier(current: str, cap: str) -> str:
    return current if _tier_rank(current) <= _tier_rank(cap) else cap


def _boost_tier(current: str, steps: int = 1) -> str:
    i = _tier_rank(current)
    return _TIER_ORDER[min(i + steps, len(_TIER_ORDER) - 1)]


def _external_to_web_evidence(items: list[dict[str, Any]]) -> list[WebEvidence]:
    out: list[WebEvidence] = []
    for i, item in enumerate(items[:10]):
        out.append(
            WebEvidence(
                id=f"web-{i + 1}",
                title=(item.get("title") or "External source")[:240],
                url=item.get("url") or "",
                publisher=item.get("publisher"),
                snippet=(item.get("snippet") or "")[:400] or None,
                retrieval_tool=item.get("retrieval_tool"),
            )
        )
    return out


def reconcile_answer_spec(
    spec: AnswerSpec,
    bag: EvidenceBag,
    *,
    query: str = "",
) -> AnswerSpec:
    del query
    notes: list[ReconciliationNote] = []
    tier = spec.tier

    web = _external_to_web_evidence(bag.external)
    corpus_n = len(spec.corpus_citations)
    web_n = len(web)
    meta = bag.as_meta()
    meta["corpus_thin"] = bag.corpus_thin
    meta["conflict_count"] = 0
    meta["dual_peer"] = bag.lane_mode == "dual"
    meta["external_led"] = web_n > corpus_n and web_n > 0

    if bag.lane_mode == "dual":
        notes.append(
            ReconciliationNote(
                type="corroborate",
                message=(
                    "Parallel evidence lanes — corpus (structured CPC projects) and web "
                    "(GovUK + Exa) fetched together; synthesise both, neither is default authority."
                ),
            )
        )

    if corpus_n and web_n:
        notes.append(
            ReconciliationNote(
                type="corroborate",
                message=(
                    f"{corpus_n} corpus citation(s) and {web_n} web source(s) — "
                    "cross-check claims; prefer corpus for project IDs, web for policy/programme context."
                ),
                corpus_signal=str(corpus_n),
                external_signal=str(web_n),
            )
        )
        tier = _boost_tier(tier, 1)
    elif web_n and not corpus_n:
        notes.append(
            ReconciliationNote(
                type="discover",
                message=(
                    f"Web lane returned {web_n} source(s); corpus slice thin or unmatched — "
                    "treat web as primary signal for this query, still mark as candidate."
                ),
                external_signal=str(web_n),
            )
        )
        tier = _cap_tier(_boost_tier(tier, 1), "Supported")
    elif corpus_n and not web_n and bag.lane_mode == "dual":
        notes.append(
            ReconciliationNote(
                type="discover",
                message=(
                    f"Corpus returned {corpus_n} citation(s); web lane ran but returned no "
                    "verified candidates — do not assume national context is absent from the world."
                ),
                corpus_signal=str(corpus_n),
            )
        )

    if bag.candidates:
        notes.append(
            ReconciliationNote(
                type="discover",
                message=(
                    f"{len(bag.candidates)} funding/opportunity candidate(s) from web — "
                    "flag for ingestion; not yet corpus-owned."
                ),
            )
        )

    if bag.errors:
        notes.append(
            ReconciliationNote(
                type="corroborate",
                message=f"Partial retrieval: {'; '.join(bag.errors[:3])}",
            )
        )

    return spec.model_copy(
        update={
            "tier": tier,
            "web_evidence": web,
            "reconciliation": Reconciliation(
                notes=notes,
                retrieval=RetrievalMeta(**meta),
            ),
        },
    )


def apply_declared_claims_to_spec(
    spec: AnswerSpec,
    declared: list,
) -> AnswerSpec:
    """Merge declared case-file claims into AnswerSpec trust rail."""
    from agents.atlas_v5.case_file import to_answer_spec_claims

    if not declared:
        return spec

    declared_claims = to_answer_spec_claims(declared)
    other = [c for c in spec.claims if c.source != "declared"]
    prov = dict(spec.provenance)
    for c in declared_claims:
        key = c.provId or f"declared-{c.id[:8]}"
        prov[key] = ProvenanceEntry(
            ref=c.provId or c.id,
            scope="declared",
            trust="declared",
            trustNote=f"Stated by user · {c.tier} max",
            row=c.text[:120],
        )

    notes = list(spec.reconciliation.notes) if spec.reconciliation else []
    notes.append(
        ReconciliationNote(
            type="discover",
            message=(
                f"{len(declared_claims)} declared situation claim(s) — "
                "self-reported; trust material capped at Indicative."
            ),
        )
    )
    recon = spec.reconciliation
    retrieval = recon.retrieval if recon else RetrievalMeta(lane_mode="corpus_only")

    return spec.model_copy(
        update={
            "claims": other + declared_claims,
            "provenance": prov,
            "reconciliation": Reconciliation(notes=notes, retrieval=retrieval),
        },
    )
