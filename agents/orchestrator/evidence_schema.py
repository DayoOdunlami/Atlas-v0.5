"""
Unified evidence item schema for dual-lane (corpus + external) reconciliation.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

Provenance = Literal["corpus", "external", "synthesized"]
VerificationState = Literal["verified", "candidate", "conflicted"]
SourceTier = Literal["primary_gov", "funder", "publisher", "news", "other"]
LaneMode = Literal["corpus_only", "corpus_primary", "dual", "external_primary"]


def make_external_evidence(
    *,
    title: str,
    url: str = "",
    snippet: str = "",
    publisher: str = "",
    retrieval_tool: str = "exa_search",
    source_tier: SourceTier = "other",
    verification_state: VerificationState = "candidate",
    confidence_cap: str = "Indicative",
) -> dict[str, Any]:
    return {
        "id": f"ext-{uuid4()}",
        "provenance": "external",
        "verification_state": verification_state,
        "source_tier": source_tier,
        "publisher": publisher or "Unknown",
        "retrieval_tool": retrieval_tool,
        "url": url,
        "title": title,
        "snippet": snippet[:400] if snippet else "",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "confidence_cap": confidence_cap,
    }


def make_opportunity_candidate(
    *,
    title: str,
    url: str,
    publisher: str = "",
    funder: str = "",
    deadline: str = "",
    snippet: str = "",
) -> dict[str, Any]:
    return {
        "id": f"cand-{uuid4()}",
        "title": title,
        "organisation": funder or publisher or "External source",
        "funder": funder or publisher,
        "score": 0.0,
        "status": "candidate",
        "abstract": snippet[:200] if snippet else "Discovered via external search — not yet in CPC corpus.",
        "source": "external",
        "url": url,
        "verification_state": "candidate",
        "why_now": "Open call or funding signal found online; pending corpus ingest.",
        "why_cpc": "Assess fit after ingesting call metadata into live_calls.",
    }
