"""Dump full calibration turn transcripts as JSON."""
from __future__ import annotations

import asyncio
import json
import sys
import uuid
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

try:
    from dotenv import load_dotenv

    load_dotenv(_root / ".env.local", override=True)
    load_dotenv(_root / "agents" / ".env", override=False)
except ImportError:
    pass

from agents.atlas_v5.calibration_eval import _turn_record, reset_case_file
from agents.atlas_v5.calibration_rubric import CALIBRATION_CASES
from agents.atlas_v5.run_turn import run_turn_response


async def run_case(case):
    tid = f"cal-dump-{case.id}-{uuid.uuid4().hex[:6]}"
    reset_case_file(tid)
    spec = None
    meta = None
    turns = []
    for q in case.prior_queries:
        p = await run_turn_response(q, thread_id=tid, current_spec=spec, prior_dev_meta=meta)
        turns.append(_turn_record(q, p))
        spec = p.get("spec") or spec
        meta = p.get("dev_meta")
    p = await run_turn_response(case.query, thread_id=tid, current_spec=spec, prior_dev_meta=meta)
    turns.append(_turn_record(case.query, p))
    if case.follow_up_query:
        p2 = await run_turn_response(
            case.follow_up_query,
            thread_id=tid,
            current_spec=p.get("spec"),
            prior_dev_meta=p.get("dev_meta"),
        )
        turns.append(_turn_record(case.follow_up_query, p2))
    return {
        "case_id": case.id,
        "label": case.label,
        "query": case.query,
        "follow_up_query": case.follow_up_query,
        "turns": turns,
    }


async def main() -> None:
    out = [await run_case(c) for c in CALIBRATION_CASES]
    dest = _root / "eval" / "baselines" / "calibration_transcripts.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {dest}")


if __name__ == "__main__":
    asyncio.run(main())
