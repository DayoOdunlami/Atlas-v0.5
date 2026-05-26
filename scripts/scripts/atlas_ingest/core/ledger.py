"""Run ledger: read/write atlas.ingest_runs.

Each top-level ingest run creates a record at start (status='running'),
and the engine finalises it to 'completed' or 'failed' at the end.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from .models import RunCounters


def start_run(conn, source: str) -> Optional[UUID]:
    """Insert a new 'running' row into atlas.ingest_runs and return its id.

    Returns None if the ledger table is unavailable (e.g. migration not yet
    applied). The ingest run proceeds regardless — the ledger is observability,
    not a gate.
    """
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO atlas.ingest_runs (source, started_at, status)
                VALUES (%s, %s, 'running')
                RETURNING id
                """,
                (source, datetime.now(timezone.utc)),
            )
            run_id = cur.fetchone()[0]
        conn.commit()
        return run_id
    except Exception as exc:
        # Roll back so the connection stays usable for the actual ingest work.
        try:
            conn.rollback()
        except Exception:
            pass
        print(
            f"  [ledger] WARNING: could not create run record for '{source}': {exc}. "
            "Ingest will proceed without ledger tracking.",
            flush=True,
        )
        return None


def finish_run(
    conn,
    run_id: Optional[UUID],
    status: str,
    counters: RunCounters,
    notes: Optional[str] = None,
) -> None:
    """Update the run record with final counters and status.

    No-ops silently if run_id is None (ledger unavailable) or if the update
    fails for any reason. Ingest correctness is never affected.
    """
    if run_id is None:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE atlas.ingest_runs SET
                    finished_at            = %s,
                    status                 = %s,
                    fetched                = %s,
                    l1_passed              = %s,
                    classified_relevant    = %s,
                    classified_borderline  = %s,
                    classified_irrelevant  = %s,
                    inserted               = %s,
                    updated                = %s,
                    skipped_existing       = %s,
                    failed                 = %s,
                    embedded               = %s,
                    routed_live_call       = %s,
                    routed_knowledge_doc   = %s,
                    cost_estimate_usd      = %s,
                    notes                  = %s
                WHERE id = %s
                """,
                (
                    datetime.now(timezone.utc),
                    status,
                    counters.fetched,
                    counters.l1_passed,
                    counters.classified_relevant,
                    counters.classified_borderline,
                    counters.classified_irrelevant,
                    counters.inserted,
                    counters.updated,
                    counters.skipped_existing,
                    counters.failed,
                    counters.embedded,
                    counters.routed_live_call,
                    counters.routed_knowledge_doc,
                    round(counters.cost_estimate_usd, 6),
                    notes,
                    run_id,
                ),
            )
        conn.commit()
    except Exception as exc:
        try:
            conn.rollback()
        except Exception:
            pass
        print(f"  [ledger] WARNING: could not finalise run record {run_id}: {exc}", flush=True)


def print_run_summary(source: str, counters: RunCounters) -> None:
    """Print a human-readable run summary to stdout."""
    print(f"\n{'=' * 55}", flush=True)
    print(f"COMPLETE: {source}", flush=True)
    print(f"  Fetched              : {counters.fetched}", flush=True)
    print(f"  L1 passed            : {counters.l1_passed}", flush=True)
    print(f"  Haiku relevant       : {counters.classified_relevant}", flush=True)
    print(f"  Haiku borderline     : {counters.classified_borderline}", flush=True)
    print(f"  Haiku irrelevant     : {counters.classified_irrelevant}", flush=True)
    print(f"  Inserted             : {counters.inserted}", flush=True)
    print(f"  Updated              : {counters.updated}", flush=True)
    print(f"  Skipped (existing)   : {counters.skipped_existing}", flush=True)
    print(f"  Failed               : {counters.failed}", flush=True)
    print(f"  Embedded             : {counters.embedded}", flush=True)
    print(f"  Routed live_call     : {counters.routed_live_call}", flush=True)
    print(f"  Routed knowledge_doc : {counters.routed_knowledge_doc}", flush=True)
    if counters.cost_estimate_usd:
        print(f"  Est. cost (USD)      : ${counters.cost_estimate_usd:.4f}", flush=True)
    print(f"{'=' * 55}", flush=True)
