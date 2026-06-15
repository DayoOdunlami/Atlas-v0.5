"""
agents.orchestrator.latency
============================

Latency budget tracking and early-exit for the orchestrator loop.

Budget tiers (per ADR-0001)
---------------------------
  clarify    0 s   (no tool calls — instant reply)
  refine     8 s   (corpus search only)
  analyze    20 s  (corpus + synthesis)
  deep       55 s  (corpus + external + falsification; Vercel maxDuration=300)

If the tool-calling loop exceeds the budget, it exits early and returns
whatever synthesis is available with a lowered confidence tier and a
budget_exceeded flag in the render model.

Usage
-----
    from agents.orchestrator.latency import LatencyBudget

    budget = LatencyBudget(effort="analyze")
    budget.start()
    ...
    if budget.is_exceeded():
        return budget.early_exit_model(partial_model)
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

BUDGETS_SECONDS: dict[str, float] = {
    "clarify": 0.0,
    "refine": 8.0,
    "analyze": 20.0,
    "deep": 55.0,
}

TIER_ORDER = ("Speculative", "Indicative", "Supported", "Robust")
TIER_RANK = {t: i for i, t in enumerate(TIER_ORDER)}


@dataclass
class LatencyBudget:
    effort: str
    _start: float = field(default=0.0, init=False)
    _budget: float = field(default=0.0, init=False)

    def __post_init__(self) -> None:
        self._budget = BUDGETS_SECONDS.get(self.effort, 20.0)

    def start(self) -> None:
        self._start = time.monotonic()

    @property
    def elapsed(self) -> float:
        return time.monotonic() - self._start if self._start else 0.0

    @property
    def remaining(self) -> float:
        return max(0.0, self._budget - self.elapsed)

    def is_exceeded(self) -> bool:
        return self.elapsed > self._budget

    def fraction_used(self) -> float:
        if self._budget <= 0:
            return 1.0
        return min(1.0, self.elapsed / self._budget)

    def early_exit_model(
        self, partial_model: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Return a copy of partial_model with:
          - budget_exceeded flag set
          - confidence_tier capped to Indicative (incomplete synthesis)
          - insight_card annotated
        """
        updated = dict(partial_model)
        tier = updated.get("confidence_tier", "Speculative")
        # Cap to Indicative — incomplete run can't claim higher
        capped = TIER_ORDER[min(TIER_RANK.get(tier, 0), TIER_RANK["Indicative"])]
        updated["confidence_tier"] = capped
        updated["budget_exceeded"] = True
        updated["elapsed_seconds"] = round(self.elapsed, 1)
        original_insight = updated.get("insight_card", "")
        updated["insight_card"] = (
            f"[Partial response — latency budget exceeded ({self.elapsed:.1f}s > {self._budget}s)] "
            + original_insight
        )
        return updated
