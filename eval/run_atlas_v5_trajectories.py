#!/usr/bin/env python3
"""CLI entry — Atlas v5 multi-turn session trajectories."""

from __future__ import annotations

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

try:
    from dotenv import load_dotenv

    load_dotenv(_root / ".env.local", override=True)
    load_dotenv(_root / "agents" / ".env", override=False)
    load_dotenv(_root / ".env", override=False)
except ImportError:
    pass

from agents.atlas_v5.trajectory_eval import main

if __name__ == "__main__":
    raise SystemExit(main())
