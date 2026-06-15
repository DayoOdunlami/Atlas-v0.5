"""
Deterministic citation / confidence tier guard for ATLAS artifacts.

⚠ LEGACY SHIM (ADR-0001 D0.3) — canonical logic is now in agents.spine.citation_guard.
All symbols are re-exported here so existing imports are not broken.

Do not add logic here — extend agents/spine/citation_guard.py instead.
"""
from agents.spine.citation_guard import (  # noqa: F401
    TIER_ORDER,
    TIER_RANK,
    STRONG_HEADLINE_RE,
    max_tier_for_citation_count,
    _cap_tier,
    apply_citation_guard,
)
