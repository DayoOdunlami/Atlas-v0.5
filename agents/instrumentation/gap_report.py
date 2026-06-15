"""
agents.instrumentation.gap_report
===================================

Aggregates gap signals into a per-CQ capability-gap report.

The report surfaces patterns across runs — e.g. "the diagnose outcome
always falls back to document mode" — which indicates a skill or block
coverage gap that needs human attention.

This is the "self-revealing" capability from ADR-0001 §9.

Usage
-----
    from agents.instrumentation.gap_report import GapReport, add_signal

    report = GapReport()
    for sig in extract_signals_from_model(verified_model):
        add_signal(report, sig)

    summary = report.summarise()
"""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any

from agents.instrumentation.signals import GapSignal, SignalType


@dataclass
class GapReport:
    """Aggregated capability-gap state across multiple query runs."""

    signals: list[GapSignal] = field(default_factory=list)
    """All signals recorded so far."""

    run_count: int = 0
    """Number of query runs recorded."""

    def add(self, signal: GapSignal) -> None:
        self.signals.append(signal)

    def increment_run(self) -> None:
        self.run_count += 1

    def summarise(self) -> dict[str, Any]:
        """Produce a human + machine readable summary of the gap report."""
        total = len(self.signals)
        by_type: Counter[str] = Counter(s.signal_type for s in self.signals)
        by_severity: Counter[str] = Counter(s.severity for s in self.signals)
        by_cq: dict[str, list[str]] = defaultdict(list)
        for s in self.signals:
            key = s.canonical_question_id or "unknown_cq"
            by_cq[key].append(s.signal_type)

        # Top recurring gaps across CQs
        top_gaps: list[dict[str, Any]] = [
            {"signal_type": stype, "count": count,
             "rate": round(count / max(self.run_count, 1), 2)}
            for stype, count in by_type.most_common(10)
        ]

        return {
            "run_count": self.run_count,
            "total_signals": total,
            "by_type": dict(by_type),
            "by_severity": dict(by_severity),
            "top_gaps": top_gaps,
            "per_cq": {cq: dict(Counter(types)) for cq, types in by_cq.items()},
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.summarise(), indent=indent)

    @property
    def has_critical(self) -> bool:
        return any(s.severity == "critical" for s in self.signals)

    @property
    def prose_fallback_rate(self) -> float:
        if self.run_count == 0:
            return 0.0
        count = sum(1 for s in self.signals if s.signal_type == "prose_fallback")
        return round(count / self.run_count, 2)

    @property
    def tier_low_rate(self) -> float:
        if self.run_count == 0:
            return 0.0
        count = sum(1 for s in self.signals if s.signal_type == "tier_low")
        return round(count / self.run_count, 2)


def add_signal(report: GapReport, signal: GapSignal) -> None:
    """Convenience function to add a signal to a report."""
    report.add(signal)


def build_report_from_model(
    model: dict[str, Any],
    *,
    query: str = "",
    render_mode: str = "blocks",
    report: GapReport | None = None,
) -> GapReport:
    """
    Build (or extend) a GapReport from a single verified render_model.

    Combines signal extraction + aggregation in one call.
    """
    from agents.instrumentation.signals import extract_signals_from_model

    rpt = report or GapReport()
    signals = extract_signals_from_model(
        model,
        query=query,
        format_node_render_mode=render_mode,
    )
    for s in signals:
        rpt.add(s)
    rpt.increment_run()
    return rpt
