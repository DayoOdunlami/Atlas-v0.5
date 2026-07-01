"""Merge corpus project hits with knowledge-document hits for retrieval + citations."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from agents.contracts.answer_spec import AnswerSpec, CorpusCitation
from agents.orchestrator.retrieval_fabric import EvidenceBag

if TYPE_CHECKING:
    from agents.atlas_v5.wide_pass import WidePassResult


def normalize_document_hit(row: dict[str, Any]) -> dict[str, Any]:
    """Shape evidence_for_claim rows for shared corpus hit handling."""
    doc_id = str(row.get("document_id") or row.get("id") or "").strip()
    return {
        "id": doc_id,
        "document_id": doc_id,
        "chunk_id": row.get("chunk_id"),
        "title": row.get("title") or "Knowledge document",
        "organisation": row.get("publisher") or row.get("organisation") or "",
        "publisher": row.get("publisher") or "",
        "similarity": row.get("similarity"),
        "score": row.get("similarity") or row.get("score"),
        "source_type": "knowledge_doc",
        "validation_tier": row.get("validation_tier"),
        "body": (row.get("body") or "")[:400],
    }


def merge_corpus_hits(bag: EvidenceBag | None) -> list[dict[str, Any]]:
    if not bag:
        return []
    projects = list(bag.corpus_raw or [])
    docs = [normalize_document_hit(d) for d in (bag.corpus_documents or []) if d.get("document_id")]
    seen: set[str] = set()
    merged: list[dict[str, Any]] = []
    for row in projects + docs:
        key = f"{row.get('source_type')}:{row.get('id')}"
        if not row.get("id") or key in seen:
            continue
        seen.add(key)
        merged.append(row)
    return merged


def corpus_hits_from_wide(wide: WidePassResult) -> list[dict[str, Any]]:
    if wide.corpus_hits:
        return list(wide.corpus_hits)
    return merge_corpus_hits(wide.evidence_bag)


def citations_from_hits(hits: list[dict[str, Any]], *, limit: int = 12) -> list[CorpusCitation]:
    out: list[CorpusCitation] = []
    for h in hits[:limit]:
        hit_id = str(h.get("id") or h.get("document_id") or "").strip()
        if not hit_id:
            continue
        score = h.get("similarity") if h.get("similarity") is not None else h.get("score")
        try:
            score_f = float(score) if score is not None else 0.0
        except (TypeError, ValueError):
            score_f = 0.0
        st = str(h.get("source_type") or "project")
        org = h.get("organisation") or h.get("publisher") or h.get("lead_org_name") or ""
        out.append(
            CorpusCitation(
                id=hit_id,
                title=str(h.get("title") or ("Knowledge document" if st == "knowledge_doc" else "Corpus project"))[
                    :240
                ],
                organisation=str(org)[:120] or None,
                score=round(score_f, 4),
                source_type=st,
                validation_tier=h.get("validation_tier"),
                document_id=h.get("document_id") if st == "knowledge_doc" else None,
                chunk_id=h.get("chunk_id"),
                publisher=h.get("publisher") or (str(org)[:120] if st == "knowledge_doc" else None),
            )
        )
    return out


def merge_document_citations_into_spec(spec: AnswerSpec, wide: WidePassResult) -> AnswerSpec:
    """Append retrieved knowledge-document citations not already on the spec."""
    bag = wide.evidence_bag
    if not bag or not bag.corpus_documents:
        return spec
    existing = {c.id for c in spec.corpus_citations}
    doc_cites = citations_from_hits(
        [normalize_document_hit(d) for d in bag.corpus_documents],
        limit=6,
    )
    new_cites = [c for c in doc_cites if c.id not in existing]
    if not new_cites:
        return spec
    return spec.model_copy(update={"corpus_citations": list(spec.corpus_citations) + new_cites})
