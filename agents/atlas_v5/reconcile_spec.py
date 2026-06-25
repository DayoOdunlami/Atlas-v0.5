"""Dual-peer reconciliation — fit-weighted prominence; honest tier corroboration rules."""

from __future__ import annotations

from typing import Any

from agents.spine.citation_guard import TIER_ORDER, _cap_tier
from agents.atlas_v5.keyed_figures import KeyedFigureIndex
from agents.atlas_v5.source_shopper import ReconcileLead, ShoppingList
from agents.atlas_v5.trust.reconcile_v2 import resolve_lead_lane
from agents.atlas_v5.trust.tier_from_evidence import tier_from_multi_lane_evidence
from agents.atlas_v5.trust.validate_web import _validation_for_item
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


def _boost_tier(current: str, steps: int = 1) -> str:
    tier = current if current in TIER_ORDER else "Speculative"
    i = TIER_ORDER.index(tier)
    return TIER_ORDER[min(i + steps, len(TIER_ORDER) - 1)]


def _external_to_web_evidence(items: list[dict[str, Any]]) -> list[WebEvidence]:
    out: list[WebEvidence] = []
    for i, item in enumerate(items[:10]):
        status, _refs = _validation_for_item(item)
        out.append(
            WebEvidence(
                id=f"web-{i + 1}",
                title=(item.get("title") or "External source")[:240],
                url=item.get("url") or "",
                publisher=item.get("publisher"),
                snippet=(item.get("snippet") or "")[:400] or None,
                retrieval_tool=item.get("retrieval_tool"),
                verification_state=status if status in ("verified", "candidate") else "candidate",
            )
        )
    return out


def lane_corpus_substantive(
    bag: EvidenceBag,
    *,
    has_sql_stats: bool = False,
) -> bool:
    """
    Corpus lane returned meaningful signal (not merely present).

    SQL-owned stats anchor analyst turns; semantic project/doc hits anchor search.
    """
    if has_sql_stats and bag.project_hit_count >= 1:
        return True
    if bag.project_hit_count >= 2:
        return True
    if bag.document_hit_count >= 2:
        return True
    return False


def lane_web_substantive(bag: EvidenceBag) -> bool:
    """Web lane returned meaningful signal — not a single weak hit."""
    if len(bag.external) >= 2:
        return True
    if len(bag.external) >= 1 and len(bag.candidates) >= 1:
        return True
    return False


def apply_peer_tier_rules(
    tier: str,
    *,
    corpus_substantive: bool,
    web_substantive: bool,
) -> tuple[str, bool, str]:
    """
    Honest tier adjustment for dual-lane turns.

    Returns (new_tier, corroboration_boost_applied, tier_reason).

    Rules (explicit — do not conflate prominence with corroboration):
    - +1 boost ONLY when BOTH lanes are substantively populated.
    - Web-led with thin corpus: single-lane web cap (Supported), NO dual-peer boost.
    - Corpus-led with thin web: no boost — presence of SQL stats does not fake web agreement.
    - Never boost when only one lane substantively returned signal.
    """
    if corpus_substantive and web_substantive:
        return (
            _boost_tier(tier, 1),
            True,
            "both lanes substantive — corroboration boost applied",
        )

    if web_substantive and not corpus_substantive:
        return (
            _cap_tier(_boost_tier(tier, 1), "Supported"),
            False,
            "web substantive, corpus thin — web-led cap, no dual-peer boost",
        )

    if corpus_substantive and not web_substantive:
        return (
            tier,
            False,
            "corpus substantive, web thin — no corroboration boost",
        )

    return tier, False, "both lanes thin — tier unchanged"


def _lead_message(lead: str, corpus_n: int, web_n: int, doc_n: int) -> str:
    if lead == "corpus":
        return (
            f"Corpus-led turn — {corpus_n} project citation(s), {doc_n} document chunk(s); "
            f"web ({web_n} source(s)) cross-checked where present."
        )
    if lead == "web":
        return (
            f"Web-led turn — {web_n} validated web source(s) lead for programme/policy scale; "
            f"corpus ({corpus_n} citations, {doc_n} docs) grounds project IDs where matched."
        )
    return (
        f"Balanced synthesis — {corpus_n} corpus + {web_n} web source(s) "
        f"({doc_n} document chunks); compare lanes, neither default authority."
    )


def reconcile_answer_spec(
    spec: AnswerSpec,
    bag: EvidenceBag,
    *,
    query: str = "",
    shopping: ShoppingList | None = None,
    has_sql_stats: bool = False,
) -> AnswerSpec:
    notes: list[ReconciliationNote] = []
    tier = spec.tier

    web = _external_to_web_evidence(bag.external)
    corpus_n = len(spec.corpus_citations)
    web_n = len(web)
    doc_n = bag.document_hit_count or len(bag.corpus_documents)

    corpus_sub = lane_corpus_substantive(bag, has_sql_stats=has_sql_stats)
    web_sub = lane_web_substantive(bag)
    lead: ReconcileLead = shopping.reconcile_lead if shopping else "balanced"

    lead_lane = resolve_lead_lane(
        query,
        shopping=shopping,
        corpus_substantive=corpus_sub,
        web_substantive=web_sub,
        index=KeyedFigureIndex(),
    )
    web_verified = sum(
        1 for item in bag.external if _validation_for_item(item)[0] == "verified"
    )
    corpus_depth = max(corpus_n, bag.project_hit_count if has_sql_stats else 0)
    if has_sql_stats and corpus_sub:
        corpus_depth = max(corpus_depth, 5)

    meta = bag.as_meta()
    meta["corpus_thin"] = bag.corpus_thin
    meta["conflict_count"] = 0
    meta["dual_peer"] = bag.lane_mode == "dual"
    meta["external_led"] = web_sub and not corpus_sub
    meta["corpus_substantive"] = corpus_sub
    meta["web_substantive"] = web_sub
    meta["lead_lane"] = lead_lane
    if shopping:
        meta["reconcile_lead"] = lead

    tier, boost_applied, tier_reason = apply_peer_tier_rules(
        tier,
        corpus_substantive=corpus_sub,
        web_substantive=web_sub,
    )
    tier, tier_cap_reason = tier_from_multi_lane_evidence(
        tier,
        corpus_citation_count=corpus_depth,
        web_verified_count=web_verified,
        corpus_substantive=corpus_sub,
        web_substantive=web_sub,
        lead_lane=lead_lane,
    )
    meta["corroboration_boost"] = boost_applied
    meta["tier_reason"] = f"{tier_reason}; {tier_cap_reason}"

    retrieval_fields = set(RetrievalMeta.model_fields.keys())
    retrieval_payload = {k: v for k, v in meta.items() if k in retrieval_fields}

    if bag.lane_mode == "dual":
        notes.append(
            ReconciliationNote(
                type="corroborate",
                message=(
                    "Parallel evidence lanes — corpus and web always fetched; "
                    "validate each lane on its merits — neither default authority."
                ),
            )
        )
        notes.append(
            ReconciliationNote(
                type="discover" if lead_lane == "web" else "corroborate",
                message=_lead_message(lead_lane, corpus_n, web_n, doc_n),
                corpus_signal=str(corpus_n),
                external_signal=str(web_n),
            )
        )

    if boost_applied:
        notes.append(
            ReconciliationNote(
                type="corroborate",
                message=(
                    f"Corroboration tier boost — {tier_reason}. "
                    f"{corpus_n} corpus + {web_n} web hits both substantive."
                ),
                corpus_signal=str(corpus_n),
                external_signal=str(web_n),
            )
        )
    elif web_sub and not corpus_sub:
        notes.append(
            ReconciliationNote(
                type="discover",
                message=(
                    f"Web lane substantive ({web_n} source(s)); corpus search thin — "
                    "tier capped for web-led signal, not dual-peer corroboration."
                ),
                external_signal=str(web_n),
            )
        )
    elif corpus_sub and not web_sub and bag.lane_mode == "dual":
        notes.append(
            ReconciliationNote(
                type="discover",
                message=(
                    f"Corpus substantive ({corpus_n} citations, {doc_n} docs); "
                    "web lane ran but returned thin signal — no corroboration boost."
                ),
                corpus_signal=str(corpus_n),
            )
        )
    elif web_n and not corpus_n and not boost_applied:
        notes.append(
            ReconciliationNote(
                type="discover",
                message=(
                    f"Web returned {web_n} source(s); corpus slice thin — "
                    "web-led, validated web signal — peer lane, not second-class input."
                ),
                external_signal=str(web_n),
            )
        )

    if doc_n >= 2:
        notes.append(
            ReconciliationNote(
                type="corroborate",
                message=f"{doc_n} ingested document chunk(s) from knowledge corpus.",
                corpus_signal=str(doc_n),
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
                retrieval=RetrievalMeta(**retrieval_payload),
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
