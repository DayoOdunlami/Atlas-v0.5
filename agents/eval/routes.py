"""
agents.eval.routes
==================

FastAPI routes for eval trace export (Phase B observability).
"""
from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/eval", tags=["eval"])


class EvalRunRequest(BaseModel):
    query: str = Field(..., min_length=3)
    expected_outcome: Literal["orient", "connect", "diagnose", "act", "defend"] | None = None
    include_judge: bool = True


class EvalBatteryRequest(BaseModel):
    limit: int | None = Field(None, ge=1, le=50)
    include_judge: bool = True


@router.get("/health")
def eval_health() -> dict[str, str]:
    return {"status": "ok", "service": "atlas-eval"}


@router.post("/run")
def eval_run(body: EvalRunRequest) -> dict[str, Any]:
    """Run one query through the orchestrator and return full trace JSON."""
    from agents.eval.trace import run_orchestrator_eval

    return run_orchestrator_eval(
        body.query,
        expected_outcome=body.expected_outcome,
        include_quality=True,
        include_judge=body.include_judge,
    )


@router.post("/battery")
def eval_battery(body: EvalBatteryRequest) -> dict[str, Any]:
    """Run golden battery (may take several minutes)."""
    from agents.eval.runner import run_battery

    return run_battery(include_judge=body.include_judge, limit=body.limit)
