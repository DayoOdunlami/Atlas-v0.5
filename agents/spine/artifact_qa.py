"""
agents.spine.artifact_qa
========================

Deterministic artifact QA — content/evidence scoring and issue list.

Promoted from agents.atlas.artifact_qa per ADR-0001 (D0.3).
No LLM calls. Runs after citation_guard in verify_citations.
"""
from __future__ import annotations

from typing import Any

TIER_ORDER = ("Speculative", "Indicative", "Supported", "Robust")
TIER_RANK = {t: i for i, t in enumerate(TIER_ORDER)}


def _content_score(ab: dict[str, Any]) -> int:
    pts = 0
    headline = str(ab.get("headline") or "").strip()
    insight = str(ab.get("insight_card") or "").strip()
    if len(headline) >= 15:
        pts += 25
    if len(insight) >= 20:
        pts += 25
    sections = ab.get("sections") or {}
    filled = sum(1 for v in sections.values() if v and str(v).strip())
    pts += min(30, filled * 10)
    blocks = ab.get("visual_blocks") or []
    if blocks:
        pts += 20
    return min(100, pts)


def _evidence_score(ab: dict[str, Any]) -> int:
    cites = ab.get("corpus_citations") or []
    tier = str(ab.get("confidence_tier") or "Speculative")
    pts = min(80, len(cites) * 15)
    if tier in TIER_RANK:
        pts += TIER_RANK[tier] * 5
    cg = ab.get("citation_guard") or {}
    if cg.get("status") == "warn":
        pts -= 15
    if cg.get("status") == "fail":
        pts -= 30
    return max(0, min(100, pts))


def run_artifact_qa(ab: dict[str, Any]) -> dict[str, Any]:
    """Return artifact_qa payload for artifact_block."""
    issues: list[dict[str, Any]] = []
    cites = ab.get("corpus_citations") or []
    tier = str(ab.get("confidence_tier") or "Speculative")
    headline = str(ab.get("headline") or "").strip()
    content = _content_score(ab)
    evidence = _evidence_score(ab)

    if len(headline) < 15:
        issues.append({
            "severity": "major",
            "type": "layout_violation",
            "target_id": "headline",
            "message": "Headline missing or too short for waterfall contract",
            "auto_fixable": False,
        })

    if tier in ("Supported", "Robust") and len(cites) < 3:
        issues.append({
            "severity": "critical",
            "type": "confidence_mismatch",
            "target_id": "confidence_tier",
            "message": f"Tier {tier} with only {len(cites)} corpus citations",
            "auto_fixable": True,
        })

    cg = ab.get("citation_guard") or {}
    if cg.get("status") in ("warn", "fail"):
        issues.append({
            "severity": "major" if cg.get("status") == "warn" else "critical",
            "type": "confidence_mismatch",
            "target_id": "citation_guard",
            "message": cg.get("reason", "Citation guard adjusted tier"),
            "auto_fixable": True,
        })

    if not ab.get("insight_card") and ab.get("recipe") in (
        "orient", "diagnose", "act", "brief_five_case", "connect",
    ):
        issues.append({
            "severity": "minor",
            "type": "layout_violation",
            "target_id": "insight_card",
            "message": "insight_card absent from artifact waterfall",
            "auto_fixable": False,
        })

    critical = sum(1 for i in issues if i["severity"] == "critical")
    major = sum(1 for i in issues if i["severity"] == "major")

    if critical:
        status = "fail"
    elif major or evidence < 30:
        status = "warn"
    else:
        status = "pass"

    claim_support = evidence / 100.0 if cites else 0.0

    return {
        "status": status,
        "issues": issues,
        "metrics": {
            "content_score": content,
            "evidence_score": evidence,
            "citation_coverage": round(min(1.0, len(cites) / 5.0), 2),
            "claim_support_rate": round(claim_support, 2),
            "contradiction_rate": 0.0,
        },
    }
