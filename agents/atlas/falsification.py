"""
Falsification lane — disconfirming search before artifact publish.

⚠ LEGACY SHIM (ADR-0001 D0.3) — canonical logic is now in agents.spine.falsification.
All symbols are re-exported here so existing imports are not broken.

Do not add logic here — extend agents/spine/falsification.py instead.
"""
from agents.spine.falsification import (  # noqa: F401
    build_disconfirm_query,
    run_falsification_lane,
)
