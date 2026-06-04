"""
Citation helpers — shared retrieval → citation pipeline utilities.

Used by agents/atlas/graph.py verify_citations and mode builders.
"""
from __future__ import annotations

from typing import Any

from mcps.cpc_corpus.queries import get_project as _verify_project

CITABLE_SOURCE_TYPES = frozenset({"project", "live_call", "cpc_internal", "cpc_claim"})

_CITATION_RULE = (
    'corpus_citation.id MUST come from items with source_type '
    '"project", "live_call", "cpc_internal", or "cpc_claim" in results.'
)

# Artefact-level epistemic states the LLM may assign per citation (Principle 3).
# "contested" is a valid ClaimState but is not LLM-assignable per-citation here —
# it is reserved for code paths that detect conflicting sources.
_ASSIGNABLE_CLAIM_STATES = frozenset({"stated", "inferred", "unknown"})


def normalise_claim_state(value: Any, *, default: str = "inferred") -> str:
    """
    Validate an LLM-supplied claim_state to an assignable value.

    Never trusts the model blindly: anything outside stated|inferred|unknown
    falls back to a conservative default ("inferred" = adjacent, not direct).
    """
    if isinstance(value, str):
        v = value.strip().lower()
        if v in _ASSIGNABLE_CLAIM_STATES:
            return v
    return default


def result_score(r: dict[str, Any]) -> float:
    for key in ("similarity", "score"):
        val = r.get(key)
        if val is not None:
            try:
                return float(val)
            except (TypeError, ValueError):
                pass
    return 0.0


def raw_id_set(raw_results: list[dict[str, Any]]) -> set[str]:
    return {str(r["id"]) for r in raw_results if r.get("id")}


def raw_by_id(raw_results: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(r["id"]): r for r in raw_results if r.get("id")}


def suggested_citations_block(
    raw_results: list[dict[str, Any]],
    *,
    limit: int = 6,
    min_score: float = 0.35,
) -> str:
    """Top-N citable IDs for LLM prompt injection."""
    ranked: list[tuple[float, dict[str, Any]]] = []
    for r in raw_results:
        st = r.get("source_type", "project")
        if st not in CITABLE_SOURCE_TYPES:
            continue
        score = result_score(r)
        if score >= min_score:
            ranked.append((score, r))
    ranked.sort(key=lambda x: x[0], reverse=True)
    if not ranked:
        return "(no citable results above threshold — cite honestly or leave empty)"

    lines: list[str] = []
    for score, r in ranked[:limit]:
        st = r.get("source_type", "project")
        label = r.get("source_label") or st
        title = (r.get("title") or r.get("description") or "")[:100]
        lines.append(
            f'- id="{r.get("id")}" source_type={st} score={score:.3f} '
            f'label="{label}" title="{title}"'
        )
    return "\n".join(lines)


def filter_llm_citations(
    raw_cites: list[Any],
    raw_results: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Keep only citations whose IDs exist in search results and pass verification."""
    ids = raw_id_set(raw_results)
    by_id = raw_by_id(raw_results)
    safe: list[dict[str, Any]] = []

    for c in raw_cites:
        if not isinstance(c, dict) or not c.get("id"):
            continue
        cid = str(c["id"])
        if cid not in ids:
            continue
        row = by_id.get(cid, {})
        st = row.get("source_type") or c.get("source_type") or "project"

        if st in ("cpc_internal", "cpc_claim"):
            cpc_entry = {
                "id": cid,
                "title": c.get("title") or row.get("title") or "",
                "organisation": c.get("organisation") or row.get("organisation") or "Connected Places Catapult",
                "relevance_note": c.get("relevance_note", ""),
                "score": float(c.get("score") or result_score(row)),
                # CPC-internal rows default to "stated" (curated), but still validate.
                "claim_state": normalise_claim_state(c.get("claim_state"), default="stated"),
                "source_type": st,
                "source_label": row.get("source_label") or f"CPC internal — {st}",
            }
            if c.get("claim_rationale"):
                cpc_entry["claim_rationale"] = c["claim_rationale"]
            safe.append(cpc_entry)
        elif st in ("project", "live_call") and _verify_project(cid):
            entry = {
                "id": cid,
                "title": c.get("title") or row.get("title") or "",
                "organisation": c.get("organisation") or row.get("lead_org_name") or row.get("organisation") or "",
                "relevance_note": c.get("relevance_note", ""),
                "score": float(c.get("score") or result_score(row)),
                # Fix 2: carry the model's grounded claim_state for project/live_call
                # citations (was previously dropped, leaving the badge fixture-only).
                # Default to "inferred" — a cited-but-adjacent source is not "stated".
                "claim_state": normalise_claim_state(c.get("claim_state")),
                "source_type": st,
            }
            rationale = c.get("claim_rationale") or c.get("relevance_note")
            if rationale:
                entry["claim_rationale"] = rationale
            safe.append(entry)
    return safe


def inject_citation_fallback(
    verified: list[dict[str, Any]],
    raw_results: list[dict[str, Any]],
    *,
    min_score: float = 0.45,
    limit: int = 3,
) -> list[dict[str, Any]]:
    """If LLM returned 0 citations, inject top verified search hits (never fabricate)."""
    if verified:
        return verified

    ranked: list[tuple[float, dict[str, Any]]] = []
    for r in raw_results:
        st = r.get("source_type", "project")
        if st not in CITABLE_SOURCE_TYPES:
            continue
        score = result_score(r)
        if score < min_score:
            continue
        if st in ("project", "live_call") and not _verify_project(str(r["id"])):
            continue
        ranked.append((score, r))

    ranked.sort(key=lambda x: x[0], reverse=True)
    injected: list[dict[str, Any]] = []
    for score, r in ranked[:limit]:
        st = r.get("source_type", "project")
        cid = str(r["id"])
        injected.append({
            "id": cid,
            "title": r.get("title") or r.get("description") or "",
            "organisation": r.get("organisation") or r.get("lead_org_name") or "Connected Places Catapult",
            "relevance_note": "Auto-suggested from corpus search (LLM omitted citation)",
            "score": score,
            "claim_state": "inferred",
            "claim_rationale": "Adjacent corpus hit injected because the model returned no citation — not a direct source for the claim.",
            "source_type": st,
            "source_label": r.get("source_label"),
        })
    return injected
