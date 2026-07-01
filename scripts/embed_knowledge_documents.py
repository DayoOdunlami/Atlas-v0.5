"""
embed_knowledge_documents.py — KB-1 ingestion pipeline (Phase 2b).

Embeds chunks for atlas.knowledge_documents rows that need (re-)processing:
  - status IN ('proposed', 'approved') AND
  - (chunks_refreshed_at IS NULL OR chunks_refreshed_at < updated_at)

Steps per document:
  1. Load document row.
  2. If storage_key is set: download PDF from Supabase Storage bucket
     `knowledge-documents` and extract text.
  3. Else if source_url is set: fetch via HTTP and extract body text.
  4. Chunk at ~800 tokens with ~100-token overlap (character approximation
     using 4 chars/token). Minimum chunk body: 100 chars.
  5. Embed each chunk with text-embedding-3-small (1536 dims, same model
     as atlas.projects / atlas.organisations / atlas.live_calls).
  6. DELETE existing chunks for document_id, INSERT new set, stamp
     chunks_refreshed_at = NOW().

Idempotent and resumable. Re-running after a document update only
re-processes documents whose chunks are stale.

Env:
  POSTGRES_URL or DATABASE_URL   — connection string
  OPENAI_API_KEY                 — for embeddings
  SUPABASE_URL (optional)        — for PDF download from Storage
  SUPABASE_SERVICE_KEY (optional) — service role key for Storage

Run:
  python scripts/embed_knowledge_documents.py
  python scripts/embed_knowledge_documents.py --dry-run
  python scripts/embed_knowledge_documents.py --document-id <uuid>

Expected runtime: ~5-15 seconds per document (PDF extraction + embedding).
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
import uuid
from pathlib import Path
from typing import Generator

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

DB_URL = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

if not DB_URL or not OPENAI_API_KEY:
    print(
        "ERROR: POSTGRES_URL/DATABASE_URL and OPENAI_API_KEY are required.",
        file=sys.stderr,
    )
    sys.exit(1)

EMBED_MODEL = "text-embedding-3-small"
CHUNK_TARGET_TOKENS = 800
CHUNK_OVERLAP_TOKENS = 100
CHARS_PER_TOKEN = 4  # approximation
CHUNK_TARGET_CHARS = CHUNK_TARGET_TOKENS * CHARS_PER_TOKEN
CHUNK_OVERLAP_CHARS = CHUNK_OVERLAP_TOKENS * CHARS_PER_TOKEN
MIN_CHUNK_CHARS = 100
EMBED_BATCH_SIZE = 20


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // CHARS_PER_TOKEN)


def chunk_text(text: str) -> list[str]:
    """Split text into overlapping chunks targeting ~800 tokens each."""
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_TARGET_CHARS, len(text))
        # Walk back to a whitespace boundary to avoid cutting mid-word.
        if end < len(text):
            boundary = text.rfind(" ", start, end)
            if boundary > start:
                end = boundary
        chunk = text[start:end].strip()
        if len(chunk) >= MIN_CHUNK_CHARS:
            chunks.append(chunk)
        # If we have consumed to the end of the text, stop. This check must
        # come before updating start to avoid an infinite loop when the
        # remaining tail is shorter than CHUNK_OVERLAP_CHARS.
        if end >= len(text):
            break
        start = end - CHUNK_OVERLAP_CHARS
    return chunks


def _strip_html(html: str) -> str:
    """Strip HTML tags and decode common entities."""
    text = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-zA-Z#\d]+;", " ", text)
    return text


def fetch_govuk_content_api_text(url: str) -> str:
    """
    Use the gov.uk Content API to retrieve clean document text.

    The Content API returns structured JSON with `description` and
    `details.body` (rendered HTML, clean of navigation/cookie banners).
    For publications with short bodies, HTML attachments are followed
    to extract additional text.
    """
    import json
    import urllib.request
    from urllib.parse import urlparse

    parsed = urlparse(url)
    path = parsed.path.rstrip("/")
    api_url = f"https://www.gov.uk/api/content{path}"

    headers = {"User-Agent": "InnovationAtlas/1.0 KB-Embedder (mailto:support@cpcatapult.co.uk)"}
    req = urllib.request.Request(api_url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        raise RuntimeError(f"gov.uk Content API failed for {url}: {exc}") from exc

    parts: list[str] = []

    desc = (data.get("description") or "").strip()
    if desc:
        parts.append(desc)

    details = data.get("details") or {}
    body_html = (details.get("body") or "").strip()
    stripped_body = _strip_html(body_html) if body_html else ""
    if stripped_body:
        parts.append(stripped_body)

    # For publications, the body is often a short intro (HTML tags inflate the
    # character count). Try following HTML attachment summaries when the
    # stripped text is short.
    if len(stripped_body) < 1000:
        for att in (details.get("attachments") or [])[:3]:
            att_url = att.get("url") or ""
            if not att_url.startswith("/government/"):
                continue
            try:
                att_api = f"https://www.gov.uk/api/content{att_url}"
                att_req = urllib.request.Request(att_api, headers=headers)
                with urllib.request.urlopen(att_req, timeout=20) as r:
                    att_data = json.loads(r.read())
                att_body = (att_data.get("details") or {}).get("body") or ""
                if att_body:
                    parts.append(_strip_html(att_body))
                    if sum(len(p) for p in parts) > 4000:
                        break
            except Exception:
                pass  # non-fatal; continue with other attachments

    return " ".join(parts)


def fetch_text_from_url(url: str) -> str:
    """Fetch plain text from a URL. Best-effort boilerplate removal.

    For gov.uk URLs, the Content API is used to retrieve clean document
    text without navigation/cookie banners. Falls back to HTML scraping
    if the Content API request fails.
    """
    import urllib.request

    from urllib.parse import urlparse
    parsed = urlparse(url)

    # Route gov.uk URLs through the Content API for clean text.
    # The Content API is faster and provides boilerplate-free text compared
    # to fetching the HTML page (which hangs in some environments).
    if parsed.netloc in ("www.gov.uk", "gov.uk"):
        return fetch_govuk_content_api_text(url)

    headers = {
        "User-Agent": "InnovationAtlas/1.0 KB-Embedder (mailto:support@cpcatapult.co.uk)"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
    except Exception as exc:
        raise RuntimeError(f"Failed to fetch {url}: {exc}") from exc

    content_type = (
        resp.headers.get("Content-Type", "").lower()
        if hasattr(resp, "headers")
        else ""
    )

    # PDF served via URL — try to extract text.
    if "pdf" in content_type or url.lower().endswith(".pdf"):
        return extract_pdf_bytes(raw)

    # HTML — strip tags.
    text = raw.decode("utf-8", errors="replace")
    return _strip_html(text)


def extract_pdf_bytes(data: bytes) -> str:
    """Extract text from PDF bytes using pypdf (optional dep)."""
    try:
        import io

        import pypdf  # type: ignore

        reader = pypdf.PdfReader(io.BytesIO(data))
        parts: list[str] = []
        for page in reader.pages:
            parts.append(page.extract_text() or "")
        return "\n".join(parts)
    except ImportError:
        raise RuntimeError(
            "pypdf is required to extract text from PDF files. "
            "Install it with: pip install pypdf"
        )


def download_from_storage(storage_key: str) -> str:
    """Download PDF from Supabase Storage bucket `knowledge-documents`."""
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get(
        "NEXT_PUBLIC_SUPABASE_URL"
    )
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not supabase_url or not service_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY are required for PDF storage downloads."
        )

    import urllib.request

    url = f"{supabase_url}/storage/v1/object/knowledge-documents/{storage_key}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
    except Exception as exc:
        raise RuntimeError(
            f"Failed to download storage_key={storage_key}: {exc}"
        ) from exc

    return extract_pdf_bytes(data)


def embed_texts(client: OpenAI, texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts using text-embedding-3-small."""
    resp = client.embeddings.create(input=texts, model=EMBED_MODEL)
    return [item.embedding for item in resp.data]


def process_document(
    conn: psycopg2.extensions.connection,
    client: OpenAI,
    doc: dict,
    dry_run: bool,
) -> None:
    doc_id = str(doc["id"])
    title = doc["title"]
    source_url = doc.get("source_url")
    storage_key = doc.get("storage_key")
    summary = doc.get("summary") or ""

    print(f"\n  Processing: {title} (id={doc_id})", flush=True)

    # --- 1. Extract text ---
    try:
        if storage_key:
            print(f"    Source: Supabase Storage (key={storage_key})", flush=True)
            raw_text = download_from_storage(storage_key)
        elif source_url:
            print(f"    Source: URL ({source_url})", flush=True)
            resolved = source_url
            try:
                from scripts.kb.govuk_pdf import is_govuk_publication_url, resolve_govuk_pdf_url

                if is_govuk_publication_url(source_url):
                    pdf_url = resolve_govuk_pdf_url(source_url)
                    if pdf_url:
                        print(f"    Resolved GovUK PDF: {pdf_url[:90]}...", flush=True)
                        resolved = pdf_url
            except Exception:
                pass
            raw_text = fetch_text_from_url(resolved)
        else:
            print("    SKIP: no source_url and no storage_key", flush=True)
            return
    except RuntimeError as exc:
        print(f"    ERROR extracting text: {exc}", file=sys.stderr)
        return

    if not raw_text.strip():
        print("    SKIP: extracted text is empty", flush=True)
        return

    # For very short fetched text, prepend title + summary to ensure
    # at least one substantive chunk can be produced.
    if len(raw_text.strip()) < MIN_CHUNK_CHARS * 3 and (title or summary):
        prefix = f"{title}. {summary}".strip()
        raw_text = f"{prefix}\n\n{raw_text}".strip()

    # --- 2. Chunk ---
    chunks = chunk_text(raw_text)
    if not chunks:
        print("    SKIP: no chunks produced", flush=True)
        return
    print(f"    Chunks: {len(chunks)}", flush=True)

    if dry_run:
        for i, c in enumerate(chunks[:3]):
            print(f"    [DRY-RUN] chunk {i}: {len(c)} chars / ~{estimate_tokens(c)} tokens")
        if len(chunks) > 3:
            print(f"    [DRY-RUN] … and {len(chunks) - 3} more")
        return

    # --- 3. Embed in batches ---
    all_embeddings: list[list[float]] = []
    for batch_start in range(0, len(chunks), EMBED_BATCH_SIZE):
        batch = chunks[batch_start : batch_start + EMBED_BATCH_SIZE]
        embeddings = embed_texts(client, batch)
        all_embeddings.extend(embeddings)
        print(
            f"    Embedded {min(batch_start + EMBED_BATCH_SIZE, len(chunks))}/{len(chunks)}",
            flush=True,
        )
        if batch_start + EMBED_BATCH_SIZE < len(chunks):
            time.sleep(0.1)

    # --- 4. Delete old chunks, insert new, stamp ---
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM atlas.knowledge_chunks WHERE document_id = %s", (doc_id,)
        )
        chunk_rows = [
            (
                str(uuid.uuid4()),
                doc_id,
                idx,
                body,
                estimate_tokens(body),
                str(embedding),
            )
            for idx, (body, embedding) in enumerate(zip(chunks, all_embeddings))
        ]
        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO atlas.knowledge_chunks
              (id, document_id, chunk_index, body, token_count, embedding)
            VALUES (%s, %s, %s, %s, %s, %s::vector)
            """,
            chunk_rows,
            page_size=50,
        )
        cur.execute(
            """
            UPDATE atlas.knowledge_documents
            SET chunks_refreshed_at = NOW(), updated_at = NOW()
            WHERE id = %s
            """,
            (doc_id,),
        )
    conn.commit()
    print(f"    Done: {len(chunks)} chunks inserted.", flush=True)


def _status_clause(approved_only: bool) -> str:
    """Return the SQL status filter fragment."""
    return "status = 'approved'" if approved_only else "status IN ('proposed', 'approved')"


def _url_clause(source_url_pattern: str | None) -> str:
    """Return an additional SQL clause for source_url filtering, or empty string."""
    return "AND source_url LIKE %(url_pattern)s" if source_url_pattern else ""


def load_pending_documents(
    conn: psycopg2.extensions.connection,
    document_id: str | None,
    since_hours: int | None = None,
    since_last_run: bool = False,
    approved_only: bool = False,
    source_url_pattern: str | None = None,
) -> list[dict]:
    status_clause = _status_clause(approved_only)
    url_clause = _url_clause(source_url_pattern)
    url_params: dict = {"url_pattern": source_url_pattern} if source_url_pattern else {}

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if document_id:
            cur.execute(
                """
                SELECT id, title, source_url, storage_key, status, summary
                FROM atlas.knowledge_documents
                WHERE id = %s
                """,
                (document_id,),
            )
        elif since_last_run:
            # Daily-cron mode: restrict to docs added since the most recently
            # completed engine run. This prevents processing the full backlog
            # and ensures only today's newly-ingested documents are chunked.
            # Falls back to the last hour if no completed ingest_runs entry exists.
            cur.execute(
                """
                SELECT started_at FROM atlas.ingest_runs
                WHERE status = 'completed'
                ORDER BY started_at DESC
                LIMIT 1
                """
            )
            row = cur.fetchone()
            cutoff = row["started_at"] if row else None
            if cutoff is None:
                # No completed runs — nothing safe to process; return empty.
                print(
                    "WARNING: --since-last-run used but no completed ingest_runs found. "
                    "Processing nothing.",
                    flush=True,
                )
                return []
            print(f"  Scoping to docs added since last engine run: {cutoff}", flush=True)
            cur.execute(
                f"""
                SELECT id, title, source_url, storage_key, status, summary
                FROM atlas.knowledge_documents
                WHERE {status_clause}
                  AND (
                    chunks_refreshed_at IS NULL
                    OR chunks_refreshed_at < updated_at
                  )
                  AND added_at >= %(cutoff)s
                  {url_clause}
                ORDER BY added_at
                """,
                {"cutoff": cutoff, **url_params},
            )
        elif since_hours is not None:
            # Explicit-window mode: restrict to docs added within the last N hours.
            # Use --since-last-run for daily cron (preferred); use --since <hours>
            # for ad-hoc runs when you know the approximate age of new docs.
            cur.execute(
                f"""
                SELECT id, title, source_url, storage_key, status, summary
                FROM atlas.knowledge_documents
                WHERE {status_clause}
                  AND (
                    chunks_refreshed_at IS NULL
                    OR chunks_refreshed_at < updated_at
                  )
                  AND added_at > NOW() - (%(since_hours)s * INTERVAL '1 hour')
                  {url_clause}
                ORDER BY added_at
                """,
                {"since_hours": since_hours, **url_params},
            )
        else:
            cur.execute(
                f"""
                SELECT id, title, source_url, storage_key, status, summary
                FROM atlas.knowledge_documents
                WHERE {status_clause}
                  AND (
                    chunks_refreshed_at IS NULL
                    OR chunks_refreshed_at < updated_at
                  )
                  {url_clause}
                ORDER BY added_at
                """,
                url_params or None,
            )
        return cur.fetchall()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Embed atlas.knowledge_documents chunks."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Extract and chunk text but do not embed or write to DB.",
    )
    parser.add_argument(
        "--document-id",
        metavar="UUID",
        help="Process a single document by id (regardless of refresh state).",
    )
    parser.add_argument(
        "--since",
        metavar="HOURS",
        type=int,
        default=None,
        help=(
            "Only process documents added within the last HOURS hours. "
            "Example: --since 24. Prefer --since-last-run for daily cron."
        ),
    )
    parser.add_argument(
        "--since-last-run",
        action="store_true",
        help=(
            "Only process documents added since the most recently completed "
            "atlas.ingest_runs entry. Use this in daily cron runs to ensure "
            "only today's newly-ingested docs are chunked (not the backlog)."
        ),
    )
    parser.add_argument(
        "--approved-only",
        action="store_true",
        help=(
            "Restrict to documents with status='approved' only. "
            "By default both 'proposed' and 'approved' docs are processed. "
            "Use for targeted backlog runs that should respect the approval gate."
        ),
    )
    parser.add_argument(
        "--source-url-pattern",
        metavar="PATTERN",
        default=None,
        help=(
            "SQL LIKE pattern to filter documents by source_url. "
            "Example: --source-url-pattern '%%gov.uk%%' processes only gov.uk docs. "
            "Shell-escape percent signs as needed."
        ),
    )
    args = parser.parse_args()

    conn_str = DB_URL.replace("?sslmode=require", "").replace("&sslmode=require", "")
    conn = psycopg2.connect(conn_str, sslmode="require")
    client = OpenAI(api_key=OPENAI_API_KEY)

    docs = load_pending_documents(
        conn,
        args.document_id,
        since_hours=args.since,
        since_last_run=args.since_last_run,
        approved_only=args.approved_only,
        source_url_pattern=args.source_url_pattern,
    )
    total = len(docs)
    scope_desc = ""
    if args.approved_only:
        scope_desc += " [approved-only]"
    if args.source_url_pattern:
        scope_desc += f" [url-pattern={args.source_url_pattern}]"
    if args.since_last_run:
        print(f"Documents to process (--since-last-run){scope_desc}: {total}", flush=True)
    elif args.since is not None:
        print(f"Documents to process (--since {args.since}h){scope_desc}: {total}", flush=True)
    else:
        print(f"Documents to process{scope_desc}: {total}", flush=True)
    if total == 0:
        print("Nothing to do.")
        conn.close()
        return

    for idx, doc in enumerate(docs, start=1):
        process_document(conn, client, dict(doc), dry_run=args.dry_run)
        if idx % 100 == 0 or idx == total:
            print(f"\n  -- Progress: {idx}/{total} docs processed --\n", flush=True)

    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*), COUNT(*) FILTER (WHERE chunks_refreshed_at IS NOT NULL) "
            "FROM atlas.knowledge_documents"
        )
        row = cur.fetchone()
        tot, embedded = row if row else (0, 0)

    conn.close()
    print(
        f"\nDone. knowledge_documents total={tot}, with_chunks={embedded}",
        flush=True,
    )


if __name__ == "__main__":
    main()
