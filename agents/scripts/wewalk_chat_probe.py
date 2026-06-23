"""Chat-only WeWalk probe (no Postgres) — simulates session when canvas is empty."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

_root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_root))

from dotenv import load_dotenv

load_dotenv(_root / ".env.local")

from agents.atlas_v5.chat_router import classify_follow_up
from agents.atlas_v5.turn_classifier import classify_turn

TURNS = [
    (
        "I'm working with a company called WeWalk. I'd like to understand their product "
        "and service offering and potential opportunities / value transition, especially "
        "in a rail-focused application."
    ),
    "WeWalk is the company — smart cane for visually impaired people.",
    (
        "I want to know how WeWalk can translate to grow in the UK innovation landscape, "
        "specifically rail stations and passenger assistance."
    ),
]


async def main() -> None:
    from agents.atlas_v5.deep_synthesis import synthesize_chat_reply

    print("=== Routing (no DB) ===\n")
    for i, q in enumerate(TURNS, 1):
        d = classify_turn(q, None)
        f = classify_follow_up(q, None)
        print(f"Turn {i}: route={d.route} source={d.source} hint={d.outcome_hint} follow_up={f}")

    print("\n=== Chat replies (current_spec=None, empty canvas) ===\n")
    spec = None
    for i, q in enumerate(TURNS, 1):
        print(f"--- Turn {i} ---")
        reply = await synthesize_chat_reply(q, current_spec=spec)
        print(reply[:700])
        print()


if __name__ == "__main__":
    asyncio.run(main())
