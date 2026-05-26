"""Atlas Unified Ingest Engine — CLI entrypoint.

Usage:
    python -m atlas_ingest --source all
    python -m atlas_ingest --source horizon
    python -m atlas_ingest --source fts
    python -m atlas_ingest --source iuk
    python -m atlas_ingest --source govuk
    python -m atlas_ingest --source govuk --dry-run

Each source run:
  1. Creates an atlas.ingest_runs record (status='running')
  2. Loads existing source_urls to skip already-known items
  3. Iterates adapter rows through L1 pre-filter (where applicable)
  4. Classifies each row with claude-haiku-4-5
  5. Embeds relevant/borderline rows with text-embedding-3-small
  6. UMAP-projects embeddings to viz_x/viz_y
  7. Upserts to atlas.live_calls or atlas.knowledge_documents
  8. Finalises the run record (status='completed' or 'failed')

--dry-run:
  Runs the full pipeline (fetch → classify → route → embed) but skips all
  database writes. Prints a routing decision table to stdout instead. Use
  this to audit GOV.UK routing before any DB writes.

Env:
  DATABASE_URL        — required
  OPENAI_API_KEY      — required for embedding
  ANTHROPIC_API_KEY   — required for classification
  EU_HORIZON_SEARCH_API_KEY or REACT_APP_SOLR_KEY  — required for horizon
"""

from __future__ import annotations

import argparse
import os
import sys
import traceback
from pathlib import Path

# Ensure scripts/ is on the path when run as `python -m atlas_ingest`
_SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from dotenv import load_dotenv

load_dotenv()

from atlas_ingest.adapters import fts, govuk, horizon, iuk
from atlas_ingest.core import classify, embed, ledger, upsert
from atlas_ingest.core.columns import ensure_live_calls_table
from atlas_ingest.core.db import (
    get_connection,
    load_existing_knowledge_doc_urls,
    load_existing_urls,
    load_taxonomies,
)
from atlas_ingest.core.models import NormalizedRow, RunCounters

VALID_SOURCES = ("horizon", "fts", "iuk", "govuk", "all")


# ---------------------------------------------------------------------------
# Shared per-row pipeline
# ---------------------------------------------------------------------------


def _process_row(
    row: NormalizedRow,
    *,
    conn,
    anthropic_client,
    openai_client,
    reducer,
    raw_bounds,
    counters: RunCounters,
    is_skipped_fn,
    taxonomies: list[dict],
    dry_run: bool = False,
) -> bool:
    """Returns True if processing should continue, False if max_rows reached (caller decides)."""
    """Classify, embed, route, and upsert a single NormalizedRow.

    In dry_run mode the full pipeline runs (fetch/classify/route/embed) but
    no database writes happen. Routing decisions are printed to stdout.
    """
    if is_skipped_fn(row):
        counters.skipped_existing += 1
        return True  # continue

    counters.l1_passed += 1

    # Step 1: Relevance classification
    try:
        tag, reason = classify.classify_relevance(
            anthropic_client,
            row.title,
            row.funder,
            row.description,
        )
    except Exception as exc:
        print(f"  [classify] Error: {exc}", flush=True)
        counters.failed += 1
        return

    if tag == "relevant":
        counters.classified_relevant += 1
    elif tag == "borderline":
        counters.classified_borderline += 1
    else:
        counters.classified_irrelevant += 1

    if tag == "irrelevant":
        if dry_run:
            _dry_run_print(row, tag, reason, None)
        return

    # Step 2: Routing classifier for ambiguous GOV.UK types
    route_reason: str | None = None
    was_ambiguous = govuk.is_ambiguous(row)
    if was_ambiguous:
        try:
            resolved = classify.classify_route(
                anthropic_client, row.title, row.description
            )
            route_reason = f"Haiku routed from ambiguous → {resolved}"
            row.doc_type = resolved
        except Exception as exc:
            print(f"  [route] Error: {exc}, defaulting to knowledge_document", flush=True)
            row.doc_type = "knowledge_document"
            route_reason = f"route error, defaulted: {exc}"

    # Step 3: Embedding (only for live_calls; knowledge_docs don't need it here)
    embedding: list[float] | None = None
    vx: float | None = None
    vy: float | None = None

    if row.doc_type == "live_call":
        embed_text = f"{row.title} {row.description or ''}".strip()[:8000]
        if not dry_run:
            try:
                [embedding] = embed.embed_texts(openai_client, [embed_text])
                counters.embedded += 1
                counters.cost_estimate_usd += embed.estimate_cost([embed_text])
            except Exception as exc:
                print(f"  [embed] Error: {exc}", flush=True)
                embedding = None

            if embedding is not None and reducer is not None and raw_bounds is not None:
                try:
                    [(vx, vy)] = embed.compute_viz(reducer, raw_bounds, [embedding])
                except Exception as exc:
                    print(f"  [umap] Error: {exc}", flush=True)
        else:
            # Count the would-be embedding in dry-run for cost estimation
            counters.embedded += 1
            counters.cost_estimate_usd += embed.estimate_cost([embed_text])

    # Step 4: Mode/theme inference for knowledge_documents
    if row.doc_type == "knowledge_document" and not row.modes:
        row.modes, row.themes = classify.infer_modes_themes(row.title, row.description)

    if dry_run:
        _dry_run_print(row, tag, reason, route_reason, taxonomies, anthropic_client)
        # Still count routing for the summary
        if row.doc_type == "live_call":
            counters.routed_live_call += 1
        else:
            counters.routed_knowledge_doc += 1
        counters.inserted += 1  # "would insert"
        return

    # Step 5: Upsert
    entity_id = None
    try:
        if row.doc_type == "live_call":
            outcome, entity_id = upsert.upsert_live_call(
                conn, row, tag, reason, embedding, vx, vy
            )
            conn.commit()
            counters.routed_live_call += 1
        else:
            outcome, entity_id = upsert.upsert_knowledge_document(conn, row)
            conn.commit()
            counters.routed_knowledge_doc += 1

        if outcome == "inserted":
            counters.inserted += 1
        else:
            counters.updated += 1

    except Exception as exc:
        conn.rollback()
        print(f"  [upsert] Error for {row.source_url!r}: {exc}", flush=True)
        counters.failed += 1
        return  # Don't attempt taxonomy classification if upsert failed

    # Step 6: Taxonomy classification → atlas.classifications
    # entity_type for the CHECK constraint: 'live_call' or 'knowledge_doc'
    if entity_id is not None and taxonomies:
        entity_type = "live_call" if row.doc_type == "live_call" else "knowledge_doc"
        for taxonomy in taxonomies:
            try:
                labels, rationale = classify.classify_taxonomy(
                    anthropic_client,
                    row.title,
                    row.description,
                    taxonomy["id"],
                    taxonomy["labels"],
                    taxonomy["classifier_prompt"],
                )
                if labels:
                    upsert.upsert_classifications(
                        conn, entity_type, entity_id, taxonomy["id"], labels, rationale
                    )
                    conn.commit()
            except Exception as exc:
                try:
                    conn.rollback()
                except Exception:
                    pass
                print(
                    f"  [taxonomy] WARNING: could not classify {entity_id} "
                    f"against {taxonomy['id']}: {exc}",
                    flush=True,
                )


def _dry_run_print(
    row: NormalizedRow,
    relevance_tag: str,
    relevance_reason: str,
    route_reason: str | None,
    taxonomies: list[dict],
    anthropic_client,
) -> None:
    """Print a human-readable routing decision for dry-run mode, including taxonomy labels."""
    raw_doc_type = row.raw_metadata.get("content_store_document_type", row.source)
    route_info = f" ({route_reason})" if route_reason else ""
    modes_str = ",".join(row.modes) if row.modes else "-"
    themes_str = ",".join(row.themes) if row.themes else "-"

    # Run taxonomy classifiers so the dry-run shows what would be written
    taxonomy_lines = []
    for taxonomy in taxonomies:
        try:
            labels, rationale = classify.classify_taxonomy(
                anthropic_client,
                row.title,
                row.description,
                taxonomy["id"],
                taxonomy["labels"],
                taxonomy["classifier_prompt"],
            )
            taxonomy_lines.append(
                f"            {taxonomy['id']:12s}: {', '.join(labels) or '(none)'}"
                f"  — {rationale[:80]}"
            )
        except Exception as exc:
            taxonomy_lines.append(f"            {taxonomy['id']:12s}: ERROR {exc}")

    tax_block = "\n".join(taxonomy_lines) if taxonomy_lines else "            (no taxonomies loaded)"

    print(
        f"  [DRY-RUN] {relevance_tag:12s} | {row.doc_type:20s}{route_info}\n"
        f"            title    : {row.title[:80]}\n"
        f"            url      : {row.source_url}\n"
        f"            raw_type : {raw_doc_type}\n"
        f"            reason   : {relevance_reason[:100]}\n"
        f"            modes    : {modes_str}  themes: {themes_str}\n"
        f"{tax_block}",
        flush=True,
    )


# ---------------------------------------------------------------------------
# Per-source runners
# ---------------------------------------------------------------------------


def _run_source_loop(
    rows_iter,
    is_skipped_fn,
    *,
    conn,
    anthropic_client,
    openai_client,
    reducer,
    raw_bounds,
    counters,
    taxonomies,
    dry_run,
    max_rows,
) -> None:
    """Shared row-processing loop with optional max_rows cap."""
    processed = 0
    for row in rows_iter:
        counters.fetched += 1
        _process_row(
            row,
            conn=conn,
            anthropic_client=anthropic_client,
            openai_client=openai_client,
            reducer=reducer,
            raw_bounds=raw_bounds,
            counters=counters,
            is_skipped_fn=is_skipped_fn,
            taxonomies=taxonomies,
            dry_run=dry_run,
        )
        if not is_skipped_fn(row):
            processed += 1
            if max_rows is not None and processed >= max_rows:
                print(f"  [engine] --max-rows {max_rows} reached, stopping early.", flush=True)
                break


def run_horizon(conn, anthropic_client, openai_client, reducer, raw_bounds, taxonomies, dry_run: bool = False, max_rows: int | None = None) -> None:
    source = "horizon_europe"
    run_id = None if dry_run else ledger.start_run(conn, source)
    counters = RunCounters()
    label = "[DRY-RUN] " if dry_run else ""
    print(f"\n[horizon] {label}Starting run...", flush=True)

    try:
        existing = load_existing_urls(conn, source)
        _run_source_loop(
            horizon.fetch(existing),
            horizon.is_skipped,
            conn=conn,
            anthropic_client=anthropic_client,
            openai_client=openai_client,
            reducer=reducer,
            raw_bounds=raw_bounds,
            counters=counters,
            taxonomies=taxonomies,
            dry_run=dry_run,
            max_rows=max_rows,
        )
        if not dry_run:
            horizon.apply_title_fixes(conn)

        ledger.finish_run(conn, run_id, "completed", counters)
    except Exception:
        traceback.print_exc()
        ledger.finish_run(conn, run_id, "failed", counters, notes=traceback.format_exc()[:1000])
        raise

    ledger.print_run_summary(source, counters)


def run_fts(conn, anthropic_client, openai_client, reducer, raw_bounds, taxonomies, dry_run: bool = False, max_rows: int | None = None) -> None:
    source = "find_a_tender"
    run_id = None if dry_run else ledger.start_run(conn, source)
    counters = RunCounters()
    label = "[DRY-RUN] " if dry_run else ""
    print(f"\n[fts] {label}Starting run...", flush=True)

    try:
        existing = load_existing_urls(conn, source)
        _run_source_loop(
            fts.fetch(existing),
            fts.is_skipped,
            conn=conn,
            anthropic_client=anthropic_client,
            openai_client=openai_client,
            reducer=reducer,
            raw_bounds=raw_bounds,
            counters=counters,
            taxonomies=taxonomies,
            dry_run=dry_run,
            max_rows=max_rows,
        )
        ledger.finish_run(conn, run_id, "completed", counters)
    except Exception:
        traceback.print_exc()
        ledger.finish_run(conn, run_id, "failed", counters, notes=traceback.format_exc()[:1000])
        raise

    ledger.print_run_summary(source, counters)


def run_iuk(conn, anthropic_client, openai_client, reducer, raw_bounds, taxonomies, dry_run: bool = False, max_rows: int | None = None) -> None:
    source = "innovate_uk"
    run_id = None if dry_run else ledger.start_run(conn, source)
    counters = RunCounters()
    label = "[DRY-RUN] " if dry_run else ""
    print(f"\n[iuk] {label}Starting run...", flush=True)

    try:
        existing = load_existing_urls(conn, source)
        _run_source_loop(
            iuk.fetch(existing),
            iuk.is_skipped,
            conn=conn,
            anthropic_client=anthropic_client,
            openai_client=openai_client,
            reducer=reducer,
            raw_bounds=raw_bounds,
            counters=counters,
            taxonomies=taxonomies,
            dry_run=dry_run,
            max_rows=max_rows,
        )
        ledger.finish_run(conn, run_id, "completed", counters)
    except Exception:
        traceback.print_exc()
        ledger.finish_run(conn, run_id, "failed", counters, notes=traceback.format_exc()[:1000])
        raise

    ledger.print_run_summary(source, counters)


def run_govuk(conn, anthropic_client, openai_client, reducer, raw_bounds, taxonomies, dry_run: bool = False, max_rows: int | None = None) -> None:
    source = "govuk"
    run_id = None if dry_run else ledger.start_run(conn, source)
    counters = RunCounters()
    label = "[DRY-RUN] " if dry_run else ""
    print(f"\n[govuk] {label}Starting run...", flush=True)

    try:
        existing_lc = load_existing_urls(conn, source)
        existing_kd = load_existing_knowledge_doc_urls(conn)
        _run_source_loop(
            govuk.fetch(existing_lc, existing_kd),
            govuk.is_skipped,
            conn=conn,
            anthropic_client=anthropic_client,
            openai_client=openai_client,
            reducer=reducer,
            raw_bounds=raw_bounds,
            counters=counters,
            taxonomies=taxonomies,
            dry_run=dry_run,
            max_rows=max_rows,
        )
        ledger.finish_run(conn, run_id, "completed", counters)
    except RuntimeError as exc:
        if "403 Forbidden" in str(exc):
            msg = str(exc)
            print(f"\n[govuk] FATAL: {msg}", flush=True)
            ledger.finish_run(conn, run_id, "failed", counters, notes=msg[:1000])
            sys.exit(1)
        traceback.print_exc()
        ledger.finish_run(conn, run_id, "failed", counters, notes=traceback.format_exc()[:1000])
        raise
    except Exception:
        traceback.print_exc()
        ledger.finish_run(conn, run_id, "failed", counters, notes=traceback.format_exc()[:1000])
        raise

    ledger.print_run_summary(source, counters)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Atlas Unified Ingest Engine",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Sources: horizon | fts | iuk | govuk | all\n"
            "Example: python -m atlas_ingest --source all\n"
        ),
    )
    parser.add_argument(
        "--source",
        choices=VALID_SOURCES,
        default="all",
        help="Which source adapter to run (default: all)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help=(
            "Run the full pipeline (fetch/classify/route) but skip all DB writes. "
            "Prints routing decisions to stdout. No atlas.ingest_runs record is created."
        ),
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=None,
        metavar="N",
        help=(
            "Stop after processing N rows (useful with --dry-run to audit a sample). "
            "Applies per-source when --source all is used."
        ),
    )
    args = parser.parse_args()

    dry_run: bool = args.dry_run
    max_rows: int | None = args.max_rows
    if dry_run:
        print("*** DRY-RUN MODE — no database writes will occur ***", flush=True)
    if max_rows is not None:
        print(f"*** MAX-ROWS: stopping after {max_rows} rows per source ***", flush=True)

    # Validate required env vars early
    missing = []
    for var in ("DATABASE_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"):
        if not os.environ.get(var):
            missing.append(var)
    if missing:
        print(f"ERROR: Missing required environment variables: {', '.join(missing)}", flush=True)
        sys.exit(1)

    # Shared clients
    from anthropic import Anthropic
    from openai import OpenAI

    anthropic_client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    # UMAP model (optional — viz coords remain NULL if absent)
    reducer, raw_bounds = embed.load_umap_model()
    if reducer is None:
        print("Warning: umap_model.pkl not found — viz_x/viz_y will be NULL.", flush=True)

    # DB connection and table setup
    conn = get_connection()
    ensure_live_calls_table(conn)

    # Load taxonomy registry once at startup (cached for the whole run)
    taxonomies = load_taxonomies(conn)
    if taxonomies:
        print(f"Loaded {len(taxonomies)} taxonomies: {[t['id'] for t in taxonomies]}", flush=True)
    else:
        print("Warning: atlas.taxonomies empty or unavailable — classifications will be skipped.", flush=True)

    sources_to_run = (
        ("horizon", "fts", "iuk", "govuk") if args.source == "all" else (args.source,)
    )

    source_map = {
        "horizon": run_horizon,
        "fts": run_fts,
        "iuk": run_iuk,
        "govuk": run_govuk,
    }

    failures = []
    for src in sources_to_run:
        fn = source_map[src]
        try:
            fn(conn, anthropic_client, openai_client, reducer, raw_bounds, taxonomies, dry_run=dry_run, max_rows=max_rows)
        except Exception as exc:
            print(f"\n[{src}] Run failed: {exc}", flush=True)
            failures.append(src)

    conn.close()

    if failures:
        print(f"\nFailed sources: {', '.join(failures)}", flush=True)
        sys.exit(1)

    print("\nAll sources complete.", flush=True)


if __name__ == "__main__":
    main()
