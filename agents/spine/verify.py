"""
agents.spine.verify
===================

Shared trust spine — orchestrates all three verification passes.

Called by the orchestrator graph's verify node (D1.3).
Also callable standalone by any individual agent.

Pipeline:
  citation_guard  →  [falsification]  →  artifact_qa
                         (skipped if flag off or effort < deep)
"""
from __future__ import annotations

from typing import Any, Literal

from agents.spine.citation_guard import apply_citation_guard
from agents.spine.falsification import run_falsification_lane
from agents.spine.artifact_qa import run_artifact_qa


EffortBucket = Literal["clarify", "refine", "analyze", "deep"]


def run_verify_spine(
    *,
    artifact: dict[str, Any],
    query: str = "",
    headline: str = "",
    effort: EffortBucket = "analyze",
) -> dict[str, Any]:
    """
    Run the full trust spine and return an enriched artifact dict.

    Mutates a copy of `artifact` — never modifies the original.

    Parameters
    ----------
    artifact    The raw AtlasRenderModel-in-progress dict.
    query       The original user query (for falsification).
    headline    The artifact headline (for falsification + citation guard).
    effort      Triage effort bucket.  Falsification only runs for 'deep'.
    """
    out = dict(artifact)

    citations = out.get("corpus_citations") or []
    citation_count = len(citations)
    tier = str(out.get("confidence_tier") or "Speculative")

    guard_result = apply_citation_guard(
        confidence_tier=tier,
        citation_count=citation_count,
        headline=headline or str(out.get("headline") or ""),
    )
    out["confidence_tier"] = guard_result["confidence_tier"]
    out["citation_guard"] = guard_result["citation_guard"]
    if guard_result.get("headline_adjusted"):
        out["headline"] = guard_result["headline"]

    if effort == "deep":
        falsification_result = run_falsification_lane(
            query=query,
            headline=headline or str(out.get("headline") or ""),
            confidence_tier=out["confidence_tier"],
        )
        out["falsification"] = falsification_result
        if falsification_result.get("tier_cap_recommended"):
            from agents.spine.citation_guard import _cap_tier
            out["confidence_tier"] = _cap_tier(
                out["confidence_tier"],
                falsification_result["tier_cap_recommended"],
            )
    else:
        out["falsification"] = {
            "status": "skipped",
            "enabled": False,
            "reason": f"effort={effort} — falsification reserved for deep queries",
            "finding_count": 0,
            "findings": [],
            "tier_cap_recommended": None,
        }

    qa_result = run_artifact_qa(out)
    out["artifact_qa"] = qa_result

    return out
