"""Orchestrate KB maintenance: tiers, promote, dedupe, backfill, manifest sync."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")

from scripts.kb.assign_tiers import assign_all_tiers  # noqa: E402
from scripts.kb.backfill_thin_pdfs import backfill_thin_pdfs  # noqa: E402
from scripts.kb.dedupe_siblings import dedupe_siblings  # noqa: E402
from scripts.kb.promote_candidates import promote_policy_candidates  # noqa: E402

DB_URL = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
MANIFEST = ROOT / "scripts" / "kb" / "tier1_manifest.json"


def sync_manifest(conn, *, dry_run: bool = False) -> int:
    rows = json.loads(MANIFEST.read_text(encoding="utf-8"))
    n = 0
    with conn.cursor() as cur:
        for row in rows:
            pdf_url = row["pdf_url"]
            pub_url = row.get("publication_url") or pdf_url
            title = row["title"]
            publisher = row.get("publisher") or ""
            published_on = row.get("published_on")
            themes = row.get("themes") or []
            modes = row.get("modes") or []
            doc_id = row.get("id")

            if dry_run:
                n += 1
                continue

            if doc_id:
                cur.execute(
                    """
                    UPDATE atlas.knowledge_documents
                    SET title = %s,
                        source_url = %s,
                        summary = %s,
                        publisher = %s,
                        published_on = %s::date,
                        themes = %s::text[],
                        modes = %s::text[],
                        status = 'approved',
                        tier = 'primary',
                        validation_tier = 'T1_anchor',
                        validation_note = 'tier-1 manifest anchor',
                        updated_at = NOW()
                    WHERE id = %s::uuid
                    """,
                    (
                        title,
                        pdf_url,
                        f"Publication page: {pub_url}",
                        publisher,
                        published_on,
                        themes,
                        modes,
                        doc_id,
                    ),
                )
            else:
                cur.execute(
                    "SELECT id FROM atlas.knowledge_documents WHERE source_url = %s OR title = %s LIMIT 1",
                    (pub_url, title),
                )
                existing = cur.fetchone()
                if existing:
                    cur.execute(
                        """
                        UPDATE atlas.knowledge_documents
                        SET title = %s, source_url = %s, summary = %s, publisher = %s,
                            published_on = %s::date, themes = %s::text[], modes = %s::text[],
                            status = 'approved', tier = 'primary',
                            validation_tier = 'T1_anchor',
                            validation_note = 'tier-1 manifest anchor',
                            updated_at = NOW()
                        WHERE id = %s::uuid
                        """,
                        (
                            title,
                            pdf_url,
                            f"Publication page: {pub_url}",
                            publisher,
                            published_on,
                            themes,
                            modes,
                            str(existing[0]),
                        ),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO atlas.knowledge_documents (
                            title, source_type, source_url, publisher, published_on,
                            modes, themes, summary, status, tier, authority_tier,
                            validation_tier, validation_note,
                            status_confidence, added_at, updated_at
                        ) VALUES (
                            %s, 'policy_doc', %s, %s, %s::date,
                            %s::text[], %s::text[], %s, 'approved', 'primary', 'primary',
                            'T1_anchor', 'tier-1 manifest anchor',
                            'confirmed', NOW(), NOW()
                        )
                        RETURNING id
                        """,
                        (
                            title,
                            pdf_url,
                            publisher,
                            published_on,
                            modes,
                            themes,
                            f"Publication page: {pub_url}",
                        ),
                    )
            n += 1
    if not dry_run:
        conn.commit()
        # Re-embed manifest rows
        env = os.environ.copy()
        env.setdefault("PYTHONIOENCODING", "utf-8")
        for row in rows:
            doc_id = row.get("id")
            if not doc_id:
                continue
            subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts" / "embed_knowledge_documents.py"),
                    "--document-id",
                    doc_id,
                ],
                cwd=str(ROOT),
                env=env,
                check=False,
            )
    return n


def embed_zero_chunk_approved(conn, *, dry_run: bool = False) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id::text FROM atlas.knowledge_documents d
            WHERE d.status = 'approved'
              AND d.validation_tier IN ('T1_anchor', 'T2_embedded', 'T3_thin')
              AND NOT EXISTS (
                SELECT 1 FROM atlas.knowledge_chunks c WHERE c.document_id = d.id
              )
            """
        )
        ids = [r[0] for r in cur.fetchall()]
    if dry_run:
        return len(ids)
    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")
    for doc_id in ids:
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "embed_knowledge_documents.py"), "--document-id", doc_id],
            cwd=str(ROOT),
            env=env,
            check=False,
        )
    return len(ids)


def main() -> None:
    parser = argparse.ArgumentParser(description="KB maintenance orchestrator")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-backfill", action="store_true", help="Skip PDF backfill (slow)")
    parser.add_argument("--backfill-limit", type=int, default=15)
    parser.add_argument("--promote-limit", type=int, default=200)
    args = parser.parse_args()

    if not DB_URL:
        print("ERROR: POSTGRES_URL/DATABASE_URL required", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(DB_URL)
    try:
        print("1) Sync tier-1 manifest...")
        print(f"   rows: {sync_manifest(conn, dry_run=args.dry_run)}")

        print("2) Promote GovUK policy candidates (T4 -> T3 approved)...")
        print(f"   promoted: {promote_policy_candidates(conn, limit=args.promote_limit, dry_run=args.dry_run)}")

        print("3) Dedupe sibling documents...")
        print(f"   retired: {dedupe_siblings(conn, dry_run=args.dry_run)}")

        if not args.skip_backfill:
            print(f"4) Backfill thin PDFs (limit={args.backfill_limit})...")
            updated, embedded = backfill_thin_pdfs(
                conn,
                limit=args.backfill_limit,
                dry_run=args.dry_run,
                embed=not args.dry_run,
            )
            print(f"   updated: {updated}, embed runs: {embedded}")
        else:
            print("4) Backfill skipped")

        print("5) Embed approved docs with zero chunks...")
        print(f"   embed runs: {embed_zero_chunk_approved(conn, dry_run=args.dry_run)}")

        print("6) Re-assign validation tiers...")
        counts = assign_all_tiers(conn, dry_run=args.dry_run)
        for tier, n in sorted(counts.items()):
            print(f"   {tier}: {n}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
