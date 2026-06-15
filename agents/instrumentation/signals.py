"""
agents.instrumentation.signals
================================

Gap-signal emitters — structured diagnostic events from every spine node.

Each signal describes something the system couldn't do well.  Signals are
consumed by agents.instrumentation.gap_report to produce a per-CQ
capability-gap report (D2.2).

Signal types
------------
  tier_low          confidence_tier is Speculative (≤0 citations) after guard
  citations_dropped citation_guard capped the tier (evidence too weak)
  prose_fallback    format pass fell back to document mode (no blocks available)
  block_missing     a block required for the outcome has no data
  falsification_hit disconfirming findings were found for a deep query
  artifact_qa_fail  artifact_qa returned fail or warn status
  skill_gap         orchestrator emitted a synthesis without using key tools
  tool_error        a tool call raised an exception during the loop
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Literal

SignalType = Literal[
    "tier_low",
    "citations_dropped",
    "prose_fallback",
    "block_missing",
    "falsification_hit",
    "artifact_qa_fail",
    "skill_gap",
    "tool_error",
]

Severity = Literal["info", "warn", "critical"]


@dataclass
class GapSignal:
    """A single diagnostic event emitted from a spine node."""

    signal_type: SignalType
    severity: Severity
    message: str
    """Human-readable description of the gap."""

    node: str
    """Node that emitted the signal (triage | loop | verify | format)."""

    canonical_question_id: str | None = None
    """CQ ID if known (from render_model.canonical_question_id)."""

    thread_id: str | None = None
    """LangGraph thread ID for tracing."""

    query: str = ""
    """Original user query (truncated to 200 chars)."""

    meta: dict[str, Any] = field(default_factory=dict)
    """Node-specific metadata (tier values, tool names, etc.)."""

    emitted_at: float = field(default_factory=time.time)


# ---------------------------------------------------------------------------
# Emitter helpers — called from spine nodes
# ---------------------------------------------------------------------------

def emit_tier_low(
    *,
    node: str,
    tier: str,
    citation_count: int,
    query: str = "",
    canonical_question_id: str | None = None,
    thread_id: str | None = None,
) -> GapSignal:
    return GapSignal(
        signal_type="tier_low",
        severity="warn",
        message=f"Confidence tier is {tier} with {citation_count} citations — insufficient evidence.",
        node=node,
        canonical_question_id=canonical_question_id,
        thread_id=thread_id,
        query=query[:200],
        meta={"tier": tier, "citation_count": citation_count},
    )


def emit_citations_dropped(
    *,
    node: str,
    original_tier: str,
    final_tier: str,
    citation_count: int,
    reason: str = "",
    query: str = "",
    canonical_question_id: str | None = None,
    thread_id: str | None = None,
) -> GapSignal:
    return GapSignal(
        signal_type="citations_dropped",
        severity="warn",
        message=f"Citation guard capped tier from {original_tier} → {final_tier}. Reason: {reason}",
        node=node,
        canonical_question_id=canonical_question_id,
        thread_id=thread_id,
        query=query[:200],
        meta={"original_tier": original_tier, "final_tier": final_tier,
              "citation_count": citation_count, "reason": reason},
    )


def emit_prose_fallback(
    *,
    node: str,
    reason: str = "",
    query: str = "",
    canonical_question_id: str | None = None,
    thread_id: str | None = None,
) -> GapSignal:
    return GapSignal(
        signal_type="prose_fallback",
        severity="info",
        message=f"Format pass fell back to document mode. {reason}",
        node=node,
        canonical_question_id=canonical_question_id,
        thread_id=thread_id,
        query=query[:200],
        meta={"reason": reason},
    )


def emit_artifact_qa_fail(
    *,
    node: str,
    status: str,
    issues: list[dict[str, Any]],
    query: str = "",
    canonical_question_id: str | None = None,
    thread_id: str | None = None,
) -> GapSignal:
    critical_count = sum(1 for i in issues if i.get("severity") == "critical")
    return GapSignal(
        signal_type="artifact_qa_fail",
        severity="critical" if status == "fail" else "warn",
        message=(
            f"Artifact QA returned {status} with {len(issues)} issue(s) "
            f"({critical_count} critical)."
        ),
        node=node,
        canonical_question_id=canonical_question_id,
        thread_id=thread_id,
        query=query[:200],
        meta={"status": status, "issue_count": len(issues),
              "critical_count": critical_count, "issues": issues[:5]},
    )


def emit_falsification_hit(
    *,
    node: str,
    finding_count: int,
    tier_cap: str | None,
    query: str = "",
    canonical_question_id: str | None = None,
    thread_id: str | None = None,
) -> GapSignal:
    return GapSignal(
        signal_type="falsification_hit",
        severity="warn",
        message=(
            f"Disconfirming search found {finding_count} contradicting source(s). "
            + (f"Tier capped to {tier_cap}." if tier_cap else "No tier change.")
        ),
        node=node,
        canonical_question_id=canonical_question_id,
        thread_id=thread_id,
        query=query[:200],
        meta={"finding_count": finding_count, "tier_cap": tier_cap},
    )


def emit_tool_error(
    *,
    node: str,
    tool_name: str,
    error: str,
    query: str = "",
    canonical_question_id: str | None = None,
    thread_id: str | None = None,
) -> GapSignal:
    return GapSignal(
        signal_type="tool_error",
        severity="warn",
        message=f"Tool {tool_name!r} raised an error: {error[:200]}",
        node=node,
        canonical_question_id=canonical_question_id,
        thread_id=thread_id,
        query=query[:200],
        meta={"tool_name": tool_name, "error": error[:400]},
    )


# ---------------------------------------------------------------------------
# extract_signals — convenience function that reads a verified render_model
# and emits all applicable signals in one pass
# ---------------------------------------------------------------------------

def extract_signals_from_model(
    model: dict[str, Any],
    *,
    query: str = "",
    format_node_render_mode: str = "blocks",
) -> list[GapSignal]:
    """
    Inspect a verified AtlasRenderModel and return all applicable gap signals.

    Typically called at the end of the format node.
    """
    signals: list[GapSignal] = []
    cq_id = model.get("canonical_question_id")
    thread_id = model.get("thread_id")
    q = query or model.get("query", "")

    tier = model.get("confidence_tier", "Speculative")
    citations = model.get("corpus_citations") or []

    # Tier low
    if tier == "Speculative":
        signals.append(emit_tier_low(
            node="verify",
            tier=tier,
            citation_count=len(citations),
            query=q,
            canonical_question_id=cq_id,
            thread_id=thread_id,
        ))

    # Citations dropped
    cg = model.get("citation_guard") or {}
    if cg.get("status") in ("warn", "fail"):
        original = cg.get("original_tier", tier)
        final = cg.get("final_tier", tier)
        if original != final:
            signals.append(emit_citations_dropped(
                node="verify",
                original_tier=original,
                final_tier=final,
                citation_count=cg.get("citation_count", len(citations)),
                reason=cg.get("reason", ""),
                query=q,
                canonical_question_id=cq_id,
                thread_id=thread_id,
            ))

    # Prose fallback
    if format_node_render_mode == "document":
        signals.append(emit_prose_fallback(
            node="format",
            reason=f"tier={tier}, render_mode=document",
            query=q,
            canonical_question_id=cq_id,
            thread_id=thread_id,
        ))

    # Artifact QA
    qa = model.get("artifact_qa") or {}
    if qa.get("status") in ("warn", "fail"):
        signals.append(emit_artifact_qa_fail(
            node="verify",
            status=qa["status"],
            issues=qa.get("issues", []),
            query=q,
            canonical_question_id=cq_id,
            thread_id=thread_id,
        ))

    # Falsification hit
    fs = model.get("falsification") or {}
    if fs.get("status") == "contradictions_found" and fs.get("finding_count", 0) > 0:
        signals.append(emit_falsification_hit(
            node="verify",
            finding_count=fs["finding_count"],
            tier_cap=fs.get("tier_cap_recommended"),
            query=q,
            canonical_question_id=cq_id,
            thread_id=thread_id,
        ))

    return signals
