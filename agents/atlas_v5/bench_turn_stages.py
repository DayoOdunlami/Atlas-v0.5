"""
One-off stage timing for Atlas v5 substantive turns.
Usage: node scripts/python-bin.mjs agents/atlas_v5/bench_turn_stages.py
"""

from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

_root = Path(__file__).resolve().parent.parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

try:
    from dotenv import load_dotenv

    load_dotenv(_root / ".env", override=False)
    load_dotenv(_root / "agents" / ".env", override=False)
    load_dotenv(_root / ".env.local", override=True)
except ImportError:
    pass

QUERIES = [
    ("chat", "Hello — what can you help me with?"),
    (
        "orient",
        "What is the state of rail decarbonisation in the CPC corpus?",
    ),
    (
        "swot",
        "For CPC Rail Business Unit, perform a SWOT analysis and explain their value proposition.",
    ),
]

MOCK_STATS = None  # lazy import


def _mock_wide(query: str, outcome: str = "find_path"):
    global MOCK_STATS
    from agents.atlas_v5.j1t1_types import FunderBreakdownRow, J1T1CorpusStats
    from agents.atlas_v5.wide_pass import WidePassResult

    if MOCK_STATS is None:
        MOCK_STATS = J1T1CorpusStats(
            project_count=55,
            funding_sum=8_172_702.05,
            null_funding_count=18,
            funded_row_count=37,
            org_count=30,
            live_since_2024=27,
            funders=[FunderBreakdownRow("Innovate UK", 36, 1, 7_903_940.05)],
            top_citations=[],
            queried_at="2026-06-17T00:00:00Z",
        )
    return WidePassResult(
        outcome=outcome,
        query=query,
        stats=MOCK_STATS,
        retrieval_meta={
            "external_skipped": True,
            "lane_mode": "corpus_only",
            "corpus_ms": 1200,
            "external_ms": 0,
        },
    )


def _ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 0)


async def bench_query(label: str, query: str) -> dict:
    from agents.atlas_v5.deep_synthesis import apply_deep_pass
    from agents.atlas_v5.source_shopper import build_shopping_list
    from agents.atlas_v5.turn_classifier import classify_turn
    from agents.atlas_v5.wide_pass import assemble_spec_from_wide_pass, run_wide_pass

    t0 = time.perf_counter()
    row: dict = {"label": label, "query": query[:60]}

    t = time.perf_counter()
    decision = classify_turn(query, None)
    row["route_ms"] = _ms(t)
    row["route"] = decision.route
    row["outcome"] = decision.outcome_hint
    row["route_source"] = decision.source

    if decision.route in ("chat", "clarify"):
        row["total_ms"] = _ms(t0)
        row["note"] = "chat/clarify — no wide/deep pass"
        return row

    t = time.perf_counter()
    shopping = build_shopping_list(query, decision.outcome_hint or "orient")
    row["shopper_ms"] = _ms(t)
    row["shopper_source"] = shopping.source

    t = time.perf_counter()
    wide = await run_wide_pass(query, outcome_hint=decision.outcome_hint)
    row["wide_pass_ms"] = _ms(t)
    meta = wide.retrieval_meta or {}
    row["lane"] = meta.get("lane_mode")
    row["external_skipped"] = meta.get("external_skipped")
    row["corpus_ms"] = meta.get("corpus_ms")
    row["external_ms"] = meta.get("external_ms")
    row["projects"] = wide.stats.project_count if wide.stats else 0

    t = time.perf_counter()
    skeleton = assemble_spec_from_wide_pass(wide)
    row["assemble_ms"] = _ms(t)

    t = time.perf_counter()
    _spec, reply, dev_meta, _upd = await apply_deep_pass(
        query, skeleton, wide, substantive=True
    )
    row["deep_pass_ms"] = _ms(t)
    row["gate"] = dev_meta.get("gate_status")
    row["composition"] = (dev_meta.get("disposition") or {}).get("composition_mode")
    row["reply_chars"] = len(reply or "")
    row["total_ms"] = _ms(t0)
    return row


async def bench_light_llm(label: str, query: str) -> dict:
    from agents.atlas_v5.source_shopper import build_shopping_list
    from agents.atlas_v5.turn_classifier import classify_turn

    row: dict = {"label": f"{label}_light_llm"}
    t = time.perf_counter()
    decision = classify_turn(query, None)
    row["route_ms"] = _ms(t)
    row["route"] = decision.route
    row["route_source"] = decision.source
    if decision.route in ("chat", "clarify"):
        return row
    t = time.perf_counter()
    shopping = build_shopping_list(query, decision.outcome_hint or "orient")
    row["shopper_ms"] = _ms(t)
    row["shopper_source"] = shopping.source
    return row


async def bench_deep_only(label: str, query: str, outcome: str = "find_path") -> dict:
    """Isolate deep pass (Sonnet) — corpus mocked so network cannot skew results."""
    from agents.atlas_v5.deep_synthesis import apply_deep_pass
    from agents.atlas_v5.turn_classifier import classify_turn
    from agents.atlas_v5.wide_pass import assemble_spec_from_wide_pass

    t0 = time.perf_counter()
    row: dict = {"label": f"{label}_deep_only", "mode": "mock_corpus"}

    t = time.perf_counter()
    decision = classify_turn(query, None)
    row["route_ms"] = _ms(t)

    wide = _mock_wide(query, outcome=outcome or decision.outcome_hint or "orient")
    skeleton = assemble_spec_from_wide_pass(wide)

    t = time.perf_counter()
    _spec, reply, dev_meta, _upd = await apply_deep_pass(
        query, skeleton, wide, substantive=True
    )
    row["deep_pass_ms"] = _ms(t)
    row["gate"] = dev_meta.get("gate_status")
    row["composition"] = (dev_meta.get("disposition") or {}).get("composition_mode")
    row["total_ms"] = _ms(t0)
    return row


async def main() -> None:
    import os

    print("Atlas v5 stage benchmark (local agents env)")
    print(f"  ANTHROPIC_API_KEY: {'set' if os.getenv('ANTHROPIC_API_KEY') else 'missing'}")
    print(f"  EXA_API_KEY: {'set' if os.getenv('EXA_API_KEY') else 'missing'}\n")

    if os.getenv("ATLAS_BENCH_LIVE", "0") == "1":
        for label, q in QUERIES:
            try:
                row = await bench_query(label, q)
                print(f"=== {label} (live corpus) ===")
                for k, v in row.items():
                    if k != "query":
                        print(f"  {k}: {v}")
                print()
            except Exception as exc:
                print(f"=== {label} (live corpus) FAILED ===")
                print(f"  {exc}\n")
    else:
        print("Skipping live corpus (set ATLAS_BENCH_LIVE=1 to enable)\n")

    print("--- Light LLM only (route + shopper) ---\n")
    for label, q in QUERIES:
        try:
            row = await bench_light_llm(label, q)
            print(f"=== {row['label']} ===")
            for k, v in row.items():
                print(f"  {k}: {v}")
            print()
        except Exception as exc:
            print(f"=== {label}_light FAILED ===")
            print(f"  {exc}\n")

    if not os.getenv("ANTHROPIC_API_KEY", "").strip():
        print("Skipping deep-only bench — ANTHROPIC_API_KEY not set\n")
        return

    print("--- Deep pass only (mock corpus, real Sonnet) ---\n")
    for label, q in QUERIES[1:]:
        outcome = "find_path" if label == "swot" else "orient"
        try:
            row = await bench_deep_only(label, q, outcome=outcome)
            print(f"=== {row['label']} ===")
            for k, v in row.items():
                print(f"  {k}: {v}")
            print()
        except Exception as exc:
            print(f"=== {label}_deep_only FAILED ===")
            print(f"  {exc}\n")


if __name__ == "__main__":
    asyncio.run(main())
