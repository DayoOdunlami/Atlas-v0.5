"""
Atlas 5 — Agent test battery.

Three tiers:
  Tier 1 (Python unit)   — fast, no network, tests graph logic directly via run_atlas()
  Tier 2 (HTTP smoke)    — medium, calls the running server via HTTP
  Tier 3 (Quality grader)— full eval of a real substantive query, checks output contract

Run from atlas5-clone-dashboard/:
    python agents/test_atlas5_battery.py

Prerequisites:
    - Python env with agents/ deps installed
    - agents/server.py running on port 8001 (for Tier 2)
    - ANTHROPIC_API_KEY + POSTGRES_URL set in .env.local
"""

from __future__ import annotations

import json
import sys
import time
import uuid
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_root))

try:
    from dotenv import load_dotenv
    # Load .env first (defaults), then .env.local (overrides) — same order as Next.js
    load_dotenv(_root / ".env", override=False)
    load_dotenv(_root / ".env.local", override=True)
except ImportError:
    pass

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PASS = "[PASS]"
FAIL = "[FAIL]"
SKIP = "[SKIP]"
_results: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, note: str = "") -> bool:
    status = PASS if condition else FAIL
    msg = f"  {status}  {name}"
    if note:
        msg += f"  [{note}]"
    print(msg)
    _results.append((name, condition, note))
    return condition


def section(title: str) -> None:
    print(f"\n{'-' * 60}")
    print(f"  {title}")
    print(f"{'-' * 60}")


# ---------------------------------------------------------------------------
# Tier 1 — Python unit tests
# ---------------------------------------------------------------------------

def tier1_unit() -> None:
    section("Tier 1 — Python unit tests (direct graph invocation)")

    from agents.atlas.graph import run_atlas

    # ── T1-A: Conversational gate ──────────────────────────────────────────
    t0 = time.time()
    r = run_atlas("hello")
    elapsed = time.time() - t0
    has_sections = bool(r.get("sections", {}))
    has_citations = bool(r.get("corpus_citations", []))
    check(
        "T1-A  Conversational gate skips pipeline for 'hello'",
        not has_sections and not has_citations and elapsed < 12,
        f"elapsed={elapsed:.1f}s, sections={'non-empty' if has_sections else 'empty'}, citations={'non-empty' if has_citations else 'empty'}",
    )

    # ── T1-B: Domain query routes through pipeline ─────────────────────────
    r2 = run_atlas("What is the case for autonomous freight corridors in the UK?")
    check(
        "T1-B  Domain query populates sections",
        bool(r2.get("sections")),
        f"sections_count={len(r2.get('sections', {}))}",
    )
    check(
        "T1-C  Recipe is brief_five_case",
        r2.get("recipe") == "brief_five_case",
        f"recipe={r2.get('recipe')}",
    )
    check(
        "T1-D  confidence_tier is valid",
        r2.get("confidence_tier") in ("Speculative", "Indicative", "Supported", "Robust"),
        f"tier={r2.get('confidence_tier')}",
    )
    check(
        "T1-E  decision_spine present",
        isinstance(r2.get("decision_spine"), dict),
        f"type={type(r2.get('decision_spine')).__name__}",
    )
    check(
        "T1-F  corpus_citations present",
        len(r2.get("corpus_citations", [])) > 0,
        f"count={len(r2.get('corpus_citations', []))}",
    )
    # ── T1-G: Artifact block + charts ──────────────────────────────────────
    ab = r2.get("artifact_block") or {}
    check(
        "T1-G  artifact_block populated",
        bool(ab),
        f"keys={list(ab.keys())[:5]}",
    )
    check(
        "T1-H  chart_specs generated when citations present",
        len(r2.get("corpus_citations", [])) == 0 or len(ab.get("chart_specs", [])) > 0,
        f"charts={len(ab.get('chart_specs', []))} citations={len(r2.get('corpus_citations', []))}",
    )


# ---------------------------------------------------------------------------
# Tier 2 — HTTP smoke tests (running server on port 8001)
# ---------------------------------------------------------------------------

def tier2_http() -> None:
    section("Tier 2 — HTTP smoke tests (server on port 8001)")

    import os
    agent_url = (os.getenv("AGENT_URL") or "http://localhost:8001").rstrip("/")

    try:
        import httpx
    except ImportError:
        print(f"  {SKIP}  httpx not installed — install with: pip install httpx")
        return

    # ── T2-A: Service health ───────────────────────────────────────────────
    try:
        r = httpx.get(f"{agent_url}/health", timeout=5)
        check("T2-A  GET /health → 200 ok", r.status_code == 200 and r.json().get("status") == "ok",
              f"status={r.status_code}")
    except Exception as e:
        check("T2-A  GET /health → 200 ok", False, f"error={e}")
        print(f"       → Server not running? Start with: uvicorn agents.server:app --port 8001")
        return

    # ── T2-B: ATLAS agent health ───────────────────────────────────────────
    try:
        r = httpx.get(f"{agent_url}/atlas/health", timeout=5)
        check("T2-B  GET /atlas/health → 200 ok",
              r.status_code == 200 and r.json().get("agent", {}).get("name") == "atlas",
              f"body={r.text[:80]}")
    except Exception as e:
        check("T2-B  GET /atlas/health → 200 ok", False, f"error={e}")

    # ── T2-C: JARVIS agent health ──────────────────────────────────────────
    try:
        r = httpx.get(f"{agent_url}/jarvis/health", timeout=5)
        check("T2-C  GET /jarvis/health → 200 ok",
              r.status_code == 200 and r.json().get("agent", {}).get("name") == "jarvis",
              f"body={r.text[:80]}")
    except Exception as e:
        check("T2-C  GET /jarvis/health → 200 ok", False, f"error={e}")

    # ── T2-D: ATLAS AG-UI stream returns events ────────────────────────────
    # We only check that the stream opens and returns at least one JSON-lines event.
    # Full end-to-end AG-UI testing requires CopilotKit headers.
    try:
        payload = {
            "runId": str(uuid.uuid4()),
            "threadId": str(uuid.uuid4()),
            "messages": [{"role": "user", "content": "hello", "id": str(uuid.uuid4())}],
            "state": {},
            "actions": [],
            "context": [],
            "tools": [],
            "forwardedProps": {},
        }
        with httpx.stream("POST", f"{agent_url}/atlas", json=payload, timeout=30) as resp:
            first_line = ""
            for chunk in resp.iter_lines():
                if chunk.strip():
                    first_line = chunk.strip()
                    break
        check("T2-D  POST /atlas returns AG-UI event stream",
              resp.status_code < 400 and bool(first_line),
              f"status={resp.status_code} first_bytes={first_line[:60]}")
    except Exception as e:
        check("T2-D  POST /atlas returns AG-UI event stream", False, f"error={e}")


# ---------------------------------------------------------------------------
# Tier 3 — Quality grader (eval contract check for a real query)
# ---------------------------------------------------------------------------

def tier3_quality() -> None:
    section("Tier 3 — Quality grader (full eval contract check)")

    try:
        from agents.atlas.graph import run_atlas
    except ImportError as e:
        print(f"  {SKIP}  Cannot import run_atlas: {e}")
        return

    QUERY = "What is the investment case for EV charging infrastructure on UK motorways?"
    print(f"  Query: '{QUERY}'")
    t0 = time.time()
    r = run_atlas(QUERY)
    elapsed = time.time() - t0
    print(f"  Elapsed: {elapsed:.1f}s")

    # G1: Five Case recipe
    check("G1  recipe=brief_five_case", r.get("recipe") == "brief_five_case")

    # G1: Sections populated
    five_case_keys = {"Strategic Case", "Economic Case", "Commercial Case", "Financial Case", "Management Case"}
    sections = r.get("sections", {})
    has_five_case = any(k in sections for k in five_case_keys)
    check("G1  At least one Five Case section present", has_five_case,
          f"keys={list(sections.keys())}")

    # G2: Decision spine
    ds = r.get("decision_spine") or {}
    check("G2  decision_spine.decision present", bool(ds.get("decision")),
          f"decision={str(ds.get('decision', ''))[:60]}")
    check("G2  decision_spine.recommendation present", bool(ds.get("recommendation")),
          f"rec={str(ds.get('recommendation', ''))[:60]}")

    # G3: Citations are dicts with 'id' and 'title'
    citations = r.get("corpus_citations", [])
    cit_valid = all(isinstance(c, dict) and c.get("id") and c.get("title") for c in citations[:3])
    check("G3  corpus_citations have id + title fields", cit_valid or len(citations) == 0,
          f"count={len(citations)}")

    # G4: confidence_tier is valid
    tier = r.get("confidence_tier")
    check("G4  confidence_tier in allowed set",
          tier in ("Speculative", "Indicative", "Supported", "Robust"),
          f"tier={tier}")
    check("G4  confidence_tier better than Speculative when citations present",
          len(citations) == 0 or tier in ("Indicative", "Supported", "Robust"),
          f"tier={tier}, citations={len(citations)}")

    # G5: Tool calls logged
    check("G5  tool_calls list present", isinstance(r.get("tool_calls"), list),
          f"count={len(r.get('tool_calls', []))}")

    # Bonus: Charts
    ab = r.get("artifact_block") or {}
    charts = ab.get("chart_specs", [])
    check("B1  chart_specs generated when citations present",
          len(citations) == 0 or len(charts) > 0,
          f"charts={len(charts)}")
    if charts:
        check("B2  Evidence Scores chart has data",
              any(c.get("title") == "Evidence Scores" and c.get("data") for c in charts),
              f"chart_titles={[c.get('title') for c in charts]}")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--tier", choices=["1", "2", "3", "all"], default="1",
                        help="Which test tier to run (default: 1)")
    parser.add_argument("--no-color", action="store_true")
    args = parser.parse_args()

    tiers = {"1": [tier1_unit], "2": [tier2_http], "3": [tier3_quality],
             "all": [tier1_unit, tier2_http, tier3_quality]}
    for fn in tiers[args.tier]:
        fn()

    total = len(_results)
    passed = sum(1 for _, ok, _ in _results if ok)
    print(f"\n{'-' * 60}")
    print(f"  Results: {passed}/{total} passed")
    print(f"{'-' * 60}\n")
    sys.exit(0 if passed == total else 1)
