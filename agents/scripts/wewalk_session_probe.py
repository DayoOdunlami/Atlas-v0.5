"""Probe WeWalk 3-turn flow via run_turn_response + optional HTTP."""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

_root = Path(__file__).resolve().parents[2]
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from dotenv import load_dotenv

load_dotenv(_root / ".env.local")

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


async def via_run_turn() -> None:
    from agents.atlas_v5.run_turn import run_turn_response

    print("=== run_turn_response (direct brain) ===\n")
    spec = None
    meta = None
    for i, q in enumerate(TURNS, 1):
        print(f"--- Turn {i} ---")
        print(f"Q: {q[:90]}...")
        try:
            out = await run_turn_response(q, current_spec=spec, prior_dev_meta=meta)
            print(f"route={out.get('route')} update_canvas={out.get('update_canvas')}")
            print(f"reply: {(out.get('reply') or '')[:600]}\n")
            if out.get("spec"):
                s = out["spec"]
                print(
                    f"canvas mode={s.get('mode')} "
                    f"verdict={(s.get('verdict') or {}).get('sentence', '')[:120]}\n"
                )
                spec = s
            meta = out.get("dev_meta") or meta
        except Exception as exc:
            print(f"ERROR: {type(exc).__name__}: {exc}\n")


async def via_http() -> None:
    import urllib.request

    base = os.getenv("PYTHON_AGENTS_URL", "http://localhost:8000").rstrip("/")
    print(f"=== POST {base}/atlas-v5/turn ===\n")
    spec = None
    for i, q in enumerate(TURNS, 1):
        print(f"--- Turn {i} ---")
        body = {"message": q}
        if spec:
            body["current_spec"] = spec
        req = urllib.request.Request(
            f"{base}/atlas-v5/turn",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                out = json.loads(resp.read().decode())
            print(f"route={out.get('route')} update_canvas={out.get('update_canvas')}")
            print(f"reply: {(out.get('reply') or '')[:600]}\n")
            if out.get("spec"):
                spec = out["spec"]
        except Exception as exc:
            print(f"ERROR: {exc}\n")


async def corpus_probe() -> None:
    print("=== CPC corpus keyword search (quick) ===\n")
    try:
        import mcps.cpc_corpus.queries as cq

        for term in ["WeWalk", "accessible rail station"]:
            try:
                rows = cq.search_projects(term, limit=3)
                print(f"{term!r}: {len(rows)} hits")
                for r in rows[:3]:
                    print(f"  - {r.get('project_title', '')[:80]}")
            except Exception as exc:
                print(f"{term!r}: {type(exc).__name__} {str(exc)[:100]}")
            print()
    except Exception as exc:
        print(f"corpus import failed: {exc}\n")


async def main() -> None:
    await corpus_probe()
    mode = os.getenv("PROBE_MODE", "http")
    if mode == "direct":
        await via_run_turn()
    else:
        await via_http()


if __name__ == "__main__":
    asyncio.run(main())
