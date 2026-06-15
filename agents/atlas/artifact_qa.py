"""
Deterministic artifact QA — content/evidence scoring and issue list.

⚠ LEGACY SHIM (ADR-0001 D0.3) — canonical logic is now in agents.spine.artifact_qa.
All symbols are re-exported here so existing imports are not broken.

Do not add logic here — extend agents/spine/artifact_qa.py instead.
"""
from agents.spine.artifact_qa import (  # noqa: F401
    TIER_ORDER,
    TIER_RANK,
    run_artifact_qa,
)
