#!/usr/bin/env python3
"""
CPC Capability Corpus v0.1 — Ingestion script

Ingests CPC project spine, impact claims, evaluation method claims, and
PMO validated claims into atlas.evidence_containers / atlas.claims /
atlas.profile_claims / atlas.claim_evidence_links.

Usage:
    python scripts/ingest_cpc_corpus.py [--pack-dir PATH] [--dry-run] [--skip-embeddings]

Options:
    --pack-dir PATH       Root of the ingestion pack (default: auto-discovered)
    --dry-run             Validate files and schema; do not write to DB
    --skip-embeddings     Skip OpenAI embedding generation step

Env vars (from .env):
    DATABASE_URL          psycopg2 connection string (Supabase transaction pooler)
    OPENAI_API_KEY        For text-embedding-3-small embeddings

Evidence governance rules enforced:
    - verified_internal -> self_reported (never -> verified)
    - No Level 3 claims generated
    - No claims generated from project metadata fields
    - All claims come from approved claim candidate files only
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────

CORPUS_TAG = "cpc_v0_1"
CAPABILITY_PROFILE_HOLDER_ID = "connected-places-catapult"
EMBED_MODEL = "text-embedding-3-small"
EMBED_BATCH_SIZE = 100
PROJECT_BATCH_SIZE = 50

# Null sentinels in the CSV
_NULL_VALUES = {"not found", "none", "nan", "", "n/a", "null", "not applicable"}

# Candidate pack directories (searched in order if --pack-dir not supplied)
_PACK_SEARCH_PATHS = [
    Path(__file__).parent.parent / "atlas_cpc_corpus_ingestion_pack_v0_1",
    Path.home() / "Downloads" / "atlas_cpc_corpus_ingestion_pack_v0_1" / "atlas_cpc_corpus_ingestion_pack_v0_1",
    Path.home() / "Downloads" / "atlas_cpc_corpus_ingestion_pack_v0_1",
]

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def clean_null(value: str) -> Optional[str]:
    """Return None for sentinel null values; strip whitespace otherwise."""
    if value is None:
        return None
    v = value.strip()
    return None if v.lower() in _NULL_VALUES else (v or None)


def clean_date(value: str) -> Optional[date]:
    """Parse date string safely; return None on failure."""
    v = clean_null(value)
    if v is None:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d"):
        try:
            return datetime.strptime(v.split(" ")[0], fmt.split(" ")[0]).date()
        except ValueError:
            continue
    return None


def clean_money(value: str) -> Optional[float]:
    """Parse budget string; strip £, commas, GBP. Return None on failure."""
    v = clean_null(value)
    if v is None:
        return None
    v = re.sub(r"[£,\s]", "", v).replace("GBP", "").strip()
    try:
        return float(v)
    except ValueError:
        return None


def map_confidence(raw: str) -> tuple[str, str]:
    """Return (mapped_tier, original_tier) — never promotes verified_internal."""
    original = (raw or "").strip().lower()
    mapping = {
        "verified_internal": "self_reported",
        "self_reported": "self_reported",
        "verified": "verified",
        "ai_inferred": "ai_inferred",
        "pending_review": "ai_inferred",
    }
    return mapping.get(original, "ai_inferred"), original


def map_level(raw: str) -> int:
    """Map claim level string to integer 1/2/3."""
    v = (raw or "").strip().lower().replace(" ", "_")
    if v in ("level_1_factual", "1", "level_1"):
        return 1
    if v in ("level_2_capability", "level_2_outcome", "2", "level_2"):
        return 2
    if v in ("level_3_strategic", "3", "level_3"):
        return 3
    try:
        n = int(v)
        return n if 1 <= n <= 3 else 1
    except ValueError:
        return 1


def build_tags(business_unit: Optional[str]) -> list[str]:
    """Build tags array for a project container."""
    base = ["cpc", "project", CORPUS_TAG]
    if business_unit:
        bu = re.sub(r"[^a-z0-9_]", "_", business_unit.lower().strip())
        base.append(bu)
    return base


def find_pack_dir(cli_path: Optional[str]) -> Path:
    """Locate the ingestion pack directory."""
    if cli_path:
        p = Path(cli_path)
        if not p.exists():
            sys.exit(f"ERROR: --pack-dir does not exist: {p}")
        return p

    for candidate in _PACK_SEARCH_PATHS:
        if (candidate / "data").exists():
            print(f"  [pack] Found at: {candidate}", flush=True)
            return candidate

    sys.exit(
        "ERROR: Cannot locate ingestion pack. Supply --pack-dir PATH.\n"
        "Expected: atlas_cpc_corpus_ingestion_pack_v0_1/data/ directory."
    )


def read_csv(path: Path) -> list[dict]:
    """Read a CSV file and return list of row dicts."""
    with open(path, newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


# ─────────────────────────────────────────────────────────────────────────────
# Database connection
# ─────────────────────────────────────────────────────────────────────────────

def get_connection() -> psycopg2.extensions.connection:
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("ERROR: DATABASE_URL environment variable not set.")
    return psycopg2.connect(url, sslmode="require")


# ─────────────────────────────────────────────────────────────────────────────
# Schema setup
# ─────────────────────────────────────────────────────────────────────────────

_MIGRATION_SQL = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS atlas.evidence_containers (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                       TEXT NOT NULL,
  container_type             TEXT NOT NULL,
  holder_type                TEXT,
  holder_id                  TEXT,
  description                TEXT,
  tags                       TEXT[] DEFAULT '{}',
  is_active                  BOOLEAN DEFAULT true,
  external_id                TEXT,
  corpus_tag                 TEXT DEFAULT 'cpc_v0_1',
  source_confidence          TEXT,
  dynamics_url               TEXT,
  business_unit              TEXT,
  customer_or_funder         TEXT,
  delivery_status            TEXT,
  delivery_status_normalised TEXT,
  mode_or_focus_area         TEXT,
  cpc_role                   TEXT,
  start_date                 DATE,
  end_date                   DATE,
  budget_gbp                 NUMERIC,
  source_files               TEXT,
  code_type                  TEXT,
  parent_profile_id          UUID REFERENCES atlas.evidence_containers(id),
  metadata                   JSONB DEFAULT '{}'::jsonb,
  embedding                  vector(1536),
  created_at                 TIMESTAMPTZ DEFAULT now(),
  updated_at                 TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS corpus_tag TEXT DEFAULT 'cpc_v0_1';
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS source_confidence TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS dynamics_url TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS business_unit TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS customer_or_funder TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS delivery_status TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS delivery_status_normalised TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS mode_or_focus_area TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS cpc_role TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS budget_gbp NUMERIC;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS source_files TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS code_type TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS parent_profile_id UUID REFERENCES atlas.evidence_containers(id);
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS holder_type TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS holder_id TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE atlas.evidence_containers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS atlas.claims (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_role        TEXT NOT NULL DEFAULT 'asserts',
  claim_domain      TEXT,
  claim_level       INTEGER DEFAULT 1,
  claim_text        TEXT NOT NULL,
  conditions        TEXT,
  confidence_tier   TEXT,
  confidence_reason TEXT,
  source_label      TEXT,
  source_excerpt    TEXT,
  entity_type       TEXT,
  entity_id         TEXT,
  source            TEXT DEFAULT 'corpus_ingest',
  review_status     TEXT DEFAULT 'pending',
  freshness_status  TEXT DEFAULT 'current',
  corpus_tag        TEXT DEFAULT 'cpc_v0_1',
  claim_subtype     TEXT,
  metadata          JSONB DEFAULT '{}'::jsonb,
  embedding         vector(1536),
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS claim_role TEXT DEFAULT 'asserts';
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS claim_domain TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS claim_level INTEGER DEFAULT 1;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS conditions TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS confidence_tier TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS confidence_reason TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS source_label TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS source_excerpt TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'corpus_ingest';
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending';
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS freshness_status TEXT DEFAULT 'current';
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS corpus_tag TEXT DEFAULT 'cpc_v0_1';
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS claim_subtype TEXT;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE atlas.claims ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE TABLE IF NOT EXISTS atlas.profile_claims (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES atlas.evidence_containers(id) ON DELETE CASCADE,
  claim_id     UUID NOT NULL REFERENCES atlas.claims(id) ON DELETE CASCADE,
  added_by     TEXT DEFAULT 'corpus_ingest',
  added_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(container_id, claim_id)
);

ALTER TABLE atlas.profile_claims ADD COLUMN IF NOT EXISTS added_by TEXT DEFAULT 'corpus_ingest';
ALTER TABLE atlas.profile_claims ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS atlas.claim_evidence_links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id          UUID NOT NULL REFERENCES atlas.claims(id) ON DELETE CASCADE,
  external_claim_id TEXT,
  document_id       UUID,
  document_table    TEXT DEFAULT 'external',
  source_file       TEXT NOT NULL,
  source_excerpt    TEXT,
  evidence_type     TEXT,
  evidence_quality  TEXT,
  source_confidence TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS external_claim_id TEXT;
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS document_id UUID;
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS document_table TEXT DEFAULT 'external';
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS source_excerpt TEXT;
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS evidence_type TEXT;
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS evidence_quality TEXT;
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS source_confidence TEXT;
ALTER TABLE atlas.claim_evidence_links ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS ec_corpus_tag_idx         ON atlas.evidence_containers (corpus_tag);
CREATE UNIQUE INDEX IF NOT EXISTS ec_corpus_tag_external_id_uq ON atlas.evidence_containers (corpus_tag, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ec_external_id_idx        ON atlas.evidence_containers (external_id);
CREATE INDEX IF NOT EXISTS ec_parent_profile_idx     ON atlas.evidence_containers (parent_profile_id);
CREATE INDEX IF NOT EXISTS claims_corpus_tag_idx     ON atlas.claims (corpus_tag);
CREATE INDEX IF NOT EXISTS claims_entity_idx         ON atlas.claims (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS cel_claim_id_idx          ON atlas.claim_evidence_links (claim_id);
CREATE INDEX IF NOT EXISTS cel_ext_claim_id_idx      ON atlas.claim_evidence_links (external_claim_id);
CREATE INDEX IF NOT EXISTS pc_container_id_idx       ON atlas.profile_claims (container_id);
CREATE INDEX IF NOT EXISTS pc_claim_id_idx           ON atlas.profile_claims (claim_id);
"""


def apply_schema(conn: psycopg2.extensions.connection, dry_run: bool) -> None:
    """Apply idempotent schema migration inline."""
    if dry_run:
        print("  [schema] --dry-run: skipping schema migration", flush=True)
        return
    print("  [schema] Applying migration...", flush=True)
    with conn.cursor() as cur:
        # Run each statement individually so ADD COLUMN IF NOT EXISTS
        # failures (on pre-existing columns) don't abort the whole batch.
        statements = [s.strip() for s in _MIGRATION_SQL.split(";") if s.strip()]
        for stmt in statements:
            try:
                cur.execute(stmt)
            except psycopg2.Error as e:
                # Column already exists or similar non-fatal DDL conflict
                if "already exists" in str(e) or "duplicate" in str(e).lower():
                    conn.rollback()
                    continue
                conn.rollback()
                raise
    conn.commit()
    print("  [schema] Migration applied.", flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# Container type compatibility check
# ─────────────────────────────────────────────────────────────────────────────

def check_container_types(conn: psycopg2.extensions.connection) -> tuple[str, str]:
    """
    Determine which container_type values to use for project containers
    and the master capability profile.

    Returns (project_type, profile_type).
    Exits with a clear error if capability_profile is not usable.
    """
    with conn.cursor() as cur:
        # Check if there's a CHECK constraint on container_type
        cur.execute(
            """
            SELECT pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'atlas'
              AND t.relname = 'evidence_containers'
              AND c.contype = 'c'
              AND c.conname ILIKE '%container_type%'
            """,
        )
        row = cur.fetchone()

    if row is None:
        # No constraint — both types are usable
        print(
            "  [container_type] No CHECK constraint found — using "
            "'project_evidence_profile' and 'capability_profile'.",
            flush=True,
        )
        return "project_evidence_profile", "capability_profile"

    constraint_def = row[0]
    print(f"  [container_type] Constraint: {constraint_def}", flush=True)

    profile_type: str
    project_type: str

    if "capability_profile" in constraint_def:
        profile_type = "capability_profile"
    else:
        sys.exit(
            "ERROR: container_type CHECK constraint does not allow 'capability_profile'.\n"
            f"Constraint: {constraint_def}\n"
            "Update the migration to add 'capability_profile' before re-running."
        )

    if "project_evidence_profile" in constraint_def:
        project_type = "project_evidence_profile"
    elif "project_evidence" in constraint_def:
        project_type = "project_evidence"
    else:
        sys.exit(
            "ERROR: container_type CHECK constraint does not allow project types.\n"
            f"Constraint: {constraint_def}"
        )

    return project_type, profile_type


# ─────────────────────────────────────────────────────────────────────────────
# Master CPC Capability Profile
# ─────────────────────────────────────────────────────────────────────────────

def upsert_capability_profile(
    conn: psycopg2.extensions.connection,
    profile_type: str,
    dry_run: bool,
) -> str:
    """Upsert the CPC Capability Profile container. Returns its UUID."""
    with conn.cursor() as cur:
        # Check if it already exists
        cur.execute(
            """
            SELECT id FROM atlas.evidence_containers
            WHERE holder_id = %s
              AND container_type = %s
              AND corpus_tag = %s
            LIMIT 1
            """,
            (CAPABILITY_PROFILE_HOLDER_ID, profile_type, CORPUS_TAG),
        )
        row = cur.fetchone()

    if row:
        profile_id = str(row[0])
        print(f"  [profile] Existing CPC Capability Profile: {profile_id}", flush=True)
        return profile_id

    profile_id = str(uuid.uuid4())
    if dry_run:
        print(f"  [profile] --dry-run: would create CPC Capability Profile {profile_id}", flush=True)
        return profile_id

    meta = json.dumps({
        "source_pack": "atlas_cpc_corpus_ingestion_pack_v0_1",
        "review_note": "Capability profile parent container. Project records are child evidence containers.",
    })
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO atlas.evidence_containers (
              id, name, container_type, holder_type, holder_id,
              description, tags, corpus_tag, is_active, metadata
            ) VALUES (
              %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT DO NOTHING
            RETURNING id
            """,
            (
                profile_id,
                "CPC Capability Profile",
                profile_type,
                "organisation",
                CAPABILITY_PROFILE_HOLDER_ID,
                (
                    "Connected Places Catapult internal capability profile. "
                    "Derived from project registry, Annual Impact Report 2024-25, "
                    "PMO closure evidence, and CPC Evaluation Framework. "
                    "Corpus version: cpc_v0_1."
                ),
                ["cpc", "internal", "capability_profile", "transport", "built_environment"],
                CORPUS_TAG,
                True,
                meta,
            ),
        )
        returned = cur.fetchone()
    conn.commit()

    if returned:
        print(f"  [profile] Created CPC Capability Profile: {profile_id}", flush=True)
    else:
        # Race or duplicate — fetch the actual row
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM atlas.evidence_containers WHERE holder_id=%s AND container_type=%s AND corpus_tag=%s LIMIT 1",
                (CAPABILITY_PROFILE_HOLDER_ID, profile_type, CORPUS_TAG),
            )
            row2 = cur.fetchone()
        profile_id = str(row2[0]) if row2 else profile_id
        print(f"  [profile] Resolved CPC Capability Profile: {profile_id}", flush=True)

    return profile_id


# ─────────────────────────────────────────────────────────────────────────────
# Project spine ingestion
# ─────────────────────────────────────────────────────────────────────────────

def ingest_project_spine(
    conn: psycopg2.extensions.connection,
    rows: list[dict],
    project_type: str,
    capability_profile_id: str,
    dry_run: bool,
) -> dict[str, str]:
    """
    Ingest 392 project rows into atlas.evidence_containers.
    Returns mapping of project_code -> container UUID.
    """
    print(f"\n  [projects] Ingesting {len(rows)} project rows...", flush=True)

    project_map: dict[str, str] = {}
    upserted = 0
    skipped = 0

    # Process in batches
    for batch_start in range(0, len(rows), PROJECT_BATCH_SIZE):
        batch = rows[batch_start : batch_start + PROJECT_BATCH_SIZE]

        with conn.cursor() as cur:
            for row in batch:
                code = clean_null(row.get("project_code", ""))
                if not code:
                    skipped += 1
                    continue

                name = clean_null(row.get("project_name", "")) or code
                business_unit = clean_null(row.get("business_unit", ""))
                customer = clean_null(row.get("customer_or_funder", ""))
                delivery_status = clean_null(row.get("delivery_status", ""))
                delivery_status_norm = clean_null(row.get("delivery_status_normalised", ""))
                budget = clean_money(row.get("project_budget_gbp", ""))
                start = clean_date(row.get("start_date", ""))
                end = clean_date(row.get("end_date", ""))
                mode = clean_null(row.get("mode_or_focus_area", ""))
                cpc_role = clean_null(row.get("cpc_role", ""))
                description = clean_null(row.get("brief_description", ""))
                dyn_url = clean_null(row.get("dynamics_365_url", ""))
                source_files = clean_null(row.get("source_files", ""))
                source_conf = clean_null(row.get("source_confidence", ""))
                code_type = clean_null(row.get("code_type", ""))

                meta = json.dumps({
                    "ingest_source": "projects_master_v0_4_targeted_enriched.csv",
                    "project_metadata_only": True,
                    "do_not_treat_description_as_claim": True,
                })

                tags = build_tags(business_unit)

                if dry_run:
                    project_map[code] = str(uuid.uuid4())
                    upserted += 1
                    continue

                cur.execute(
                    """
                    INSERT INTO atlas.evidence_containers (
                      name, container_type, holder_type, holder_id,
                      external_id, corpus_tag, is_active, tags,
                      business_unit, customer_or_funder, delivery_status,
                      delivery_status_normalised, budget_gbp, start_date, end_date,
                      mode_or_focus_area, cpc_role, description, dynamics_url,
                      source_files, source_confidence, code_type,
                      parent_profile_id, metadata
                    ) VALUES (
                      %s, %s, %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s, %s, %s,
                      %s, %s
                    )
                    ON CONFLICT (corpus_tag, external_id)
                    WHERE external_id IS NOT NULL
                    DO UPDATE SET
                      name                       = EXCLUDED.name,
                      business_unit              = EXCLUDED.business_unit,
                      customer_or_funder         = EXCLUDED.customer_or_funder,
                      delivery_status            = EXCLUDED.delivery_status,
                      delivery_status_normalised = EXCLUDED.delivery_status_normalised,
                      budget_gbp                 = EXCLUDED.budget_gbp,
                      start_date                 = EXCLUDED.start_date,
                      end_date                   = EXCLUDED.end_date,
                      mode_or_focus_area         = EXCLUDED.mode_or_focus_area,
                      cpc_role                   = EXCLUDED.cpc_role,
                      description                = EXCLUDED.description,
                      dynamics_url               = EXCLUDED.dynamics_url,
                      source_files               = EXCLUDED.source_files,
                      source_confidence          = EXCLUDED.source_confidence,
                      code_type                  = EXCLUDED.code_type,
                      parent_profile_id          = EXCLUDED.parent_profile_id,
                      metadata                   = EXCLUDED.metadata,
                      updated_at                 = now()
                    RETURNING id, external_id
                    """,
                    (
                        name, project_type, "organisation", CAPABILITY_PROFILE_HOLDER_ID,
                        code, CORPUS_TAG, True, tags,
                        business_unit, customer, delivery_status,
                        delivery_status_norm, budget, start, end,
                        mode, cpc_role, description, dyn_url,
                        source_files, source_conf, code_type,
                        capability_profile_id, meta,
                    ),
                )
                result = cur.fetchone()
                if result:
                    container_id, ext_id = result
                    project_map[code] = str(container_id)
                    upserted += 1
                else:
                    # Row existed but ON CONFLICT WHERE clause didn't match
                    # (different corpus_tag) — fetch the existing id
                    cur.execute(
                        "SELECT id FROM atlas.evidence_containers WHERE corpus_tag=%s AND external_id = %s LIMIT 1",
                        (CORPUS_TAG, code),
                    )
                    existing = cur.fetchone()
                    if existing:
                        project_map[code] = str(existing[0])

        if not dry_run:
            conn.commit()

        pct = min(batch_start + PROJECT_BATCH_SIZE, len(rows))
        print(f"  [projects] {pct}/{len(rows)} processed...", end="\r", flush=True)

    print(f"\n  [projects] Done — upserted={upserted}, skipped={skipped}", flush=True)

    # Refresh map from DB for any rows that came from ON CONFLICT DO UPDATE
    if not dry_run:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT external_id, id FROM atlas.evidence_containers WHERE corpus_tag=%s AND container_type != %s",
                (CORPUS_TAG, "capability_profile"),
            )
            for ext_id, row_id in cur.fetchall():
                if ext_id:
                    project_map[ext_id] = str(row_id)

    return project_map


# ─────────────────────────────────────────────────────────────────────────────
# Claim idempotency helper
# ─────────────────────────────────────────────────────────────────────────────

def load_existing_claim_external_ids(
    conn: psycopg2.extensions.connection,
) -> set[str]:
    """Load all external_claim_ids already in atlas.claims for this corpus."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT metadata->>'external_claim_id'
            FROM atlas.claims
            WHERE corpus_tag = %s
              AND metadata->>'external_claim_id' IS NOT NULL
            """,
            (CORPUS_TAG,),
        )
        return {row[0] for row in cur.fetchall()}


def insert_claim(
    cur: psycopg2.extensions.cursor,
    claim_id: str,
    claim_role: str,
    claim_domain: Optional[str],
    claim_level: int,
    claim_text: str,
    conditions: Optional[str],
    confidence_tier: str,
    confidence_reason: Optional[str],
    source_label: Optional[str],
    source_excerpt: Optional[str],
    entity_type: Optional[str],
    entity_id: Optional[str],
    claim_subtype: Optional[str],
    metadata: dict,
) -> None:
    cur.execute(
        """
        INSERT INTO atlas.claims (
          id, claim_role, claim_domain, claim_level, claim_text,
          conditions, confidence_tier, confidence_reason,
          source_label, source_excerpt, entity_type, entity_id,
          source, review_status, freshness_status, corpus_tag,
          claim_subtype, metadata
        ) VALUES (
          %s, %s, %s, %s, %s, %s, %s, %s,
          %s, %s, %s, %s,
          'corpus_ingest', 'pending', 'current', %s,
          %s, %s
        )
        """,
        (
            claim_id,
            claim_role, claim_domain, claim_level, claim_text,
            conditions, confidence_tier, confidence_reason,
            source_label, source_excerpt, entity_type, entity_id,
            CORPUS_TAG,
            claim_subtype, json.dumps(metadata),
        ),
    )


def link_claim_to_container(
    cur: psycopg2.extensions.cursor,
    container_id: str,
    claim_id: str,
) -> None:
    cur.execute(
        """
        INSERT INTO atlas.profile_claims (container_id, claim_id)
        VALUES (%s, %s)
        ON CONFLICT (container_id, claim_id) DO NOTHING
        """,
        (container_id, claim_id),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Impact claims
# ─────────────────────────────────────────────────────────────────────────────

def ingest_impact_claims(
    conn: psycopg2.extensions.connection,
    rows: list[dict],
    capability_profile_id: str,
    existing_ext_ids: set[str],
    dry_run: bool,
) -> dict[str, str]:
    """
    Ingest impact claims (32 rows) from impact_claim_candidates_v0.csv.
    Returns external_claim_id -> atlas.claims.id mapping.
    """
    print(f"\n  [impact_claims] Ingesting {len(rows)} rows...", flush=True)
    ext_to_id: dict[str, str] = {}
    inserted = 0
    skipped = 0

    with conn.cursor() as cur:
        for row in rows:
            ext_id = clean_null(row.get("claim_id", ""))
            if not ext_id:
                skipped += 1
                continue
            if ext_id in existing_ext_ids:
                # Already ingested — fetch the id
                if not dry_run:
                    cur.execute(
                        "SELECT id FROM atlas.claims WHERE corpus_tag=%s AND metadata->>'external_claim_id'=%s LIMIT 1",
                        (CORPUS_TAG, ext_id),
                    )
                    existing = cur.fetchone()
                    if existing:
                        ext_to_id[ext_id] = str(existing[0])
                skipped += 1
                continue

            claim_text = clean_null(row.get("claim_text", ""))
            if not claim_text:
                skipped += 1
                continue

            raw_confidence = row.get("confidence_tier", "")
            mapped_confidence, original_confidence = map_confidence(raw_confidence)
            claim_level = map_level(row.get("claim_level", "1"))

            # Governance check: no level 3
            if claim_level == 3:
                print(f"  [WARN] Skipping Level 3 claim {ext_id}", flush=True)
                skipped += 1
                continue

            entity_type = clean_null(row.get("entity_type", "")) or "organisation"
            entity_id_val = clean_null(row.get("entity_id_or_project_code", "")) or CAPABILITY_PROFILE_HOLDER_ID
            claim_subtype = clean_null(row.get("claim_subtype", ""))
            claim_domain = clean_null(row.get("claim_domain", "")) or "impact"
            confidence_reason = clean_null(row.get("confidence_reason", ""))
            source_label = clean_null(row.get("source_file", ""))
            source_excerpt = clean_null(row.get("source_excerpt", ""))

            meta = {
                "source_file": "impact_claim_candidates_v0.csv",
                "external_claim_id": ext_id,
                "original_confidence_tier": original_confidence,
            }

            new_id = str(uuid.uuid4())
            if not dry_run:
                insert_claim(
                    cur,
                    new_id, "asserts", claim_domain, claim_level, claim_text,
                    None, mapped_confidence, confidence_reason,
                    source_label, source_excerpt,
                    entity_type, entity_id_val,
                    claim_subtype, meta,
                )
                link_claim_to_container(cur, capability_profile_id, new_id)

            ext_to_id[ext_id] = new_id
            existing_ext_ids.add(ext_id)
            inserted += 1

    if not dry_run:
        conn.commit()

    print(f"  [impact_claims] Done — inserted={inserted}, skipped={skipped}", flush=True)
    return ext_to_id


# ─────────────────────────────────────────────────────────────────────────────
# Evaluation method claims
# ─────────────────────────────────────────────────────────────────────────────

def ingest_evaluation_claims(
    conn: psycopg2.extensions.connection,
    rows: list[dict],
    capability_profile_id: str,
    existing_ext_ids: set[str],
    dry_run: bool,
) -> dict[str, str]:
    """
    Ingest evaluation method claims (12 rows).
    Returns external_claim_id -> atlas.claims.id mapping.
    """
    print(f"\n  [eval_claims] Ingesting {len(rows)} rows...", flush=True)
    ext_to_id: dict[str, str] = {}
    inserted = 0
    skipped = 0

    with conn.cursor() as cur:
        for row in rows:
            ext_id = clean_null(row.get("method_claim_id", ""))
            if not ext_id:
                skipped += 1
                continue
            if ext_id in existing_ext_ids:
                if not dry_run:
                    cur.execute(
                        "SELECT id FROM atlas.claims WHERE corpus_tag=%s AND metadata->>'external_claim_id'=%s LIMIT 1",
                        (CORPUS_TAG, ext_id),
                    )
                    existing = cur.fetchone()
                    if existing:
                        ext_to_id[ext_id] = str(existing[0])
                skipped += 1
                continue

            claim_text = clean_null(row.get("claim_text", ""))
            if not claim_text:
                skipped += 1
                continue

            raw_confidence = row.get("confidence_tier", "")
            mapped_confidence, original_confidence = map_confidence(raw_confidence)
            source_label = clean_null(row.get("source_file", ""))
            source_excerpt = clean_null(row.get("source_excerpt", ""))
            conditions = clean_null(row.get("applies_to", ""))
            confidence_reason = clean_null(row.get("notes", ""))

            meta = {
                "source_file": "evaluation_method_claims_v0.csv",
                "external_claim_id": ext_id,
                "original_confidence_tier": original_confidence,
            }

            new_id = str(uuid.uuid4())
            if not dry_run:
                insert_claim(
                    cur,
                    new_id, "asserts", "evidence", 2, claim_text,
                    conditions, mapped_confidence, confidence_reason,
                    source_label, source_excerpt,
                    "organisation", CAPABILITY_PROFILE_HOLDER_ID,
                    "evaluation_method", meta,
                )
                link_claim_to_container(cur, capability_profile_id, new_id)

            ext_to_id[ext_id] = new_id
            existing_ext_ids.add(ext_id)
            inserted += 1

    if not dry_run:
        conn.commit()

    print(f"  [eval_claims] Done — inserted={inserted}, skipped={skipped}", flush=True)
    return ext_to_id


# ─────────────────────────────────────────────────────────────────────────────
# PMO validated claims
# ─────────────────────────────────────────────────────────────────────────────

def ingest_pmo_claims(
    conn: psycopg2.extensions.connection,
    rows: list[dict],
    capability_profile_id: str,
    project_map: dict[str, str],
    existing_ext_ids: set[str],
    dry_run: bool,
) -> dict[str, str]:
    """
    Ingest PMO validated claims (5 rows).
    Links each claim to capability profile AND its project container.
    Returns external_claim_id -> atlas.claims.id mapping.
    """
    print(f"\n  [pmo_claims] Ingesting {len(rows)} rows...", flush=True)
    ext_to_id: dict[str, str] = {}
    inserted = 0
    skipped = 0

    with conn.cursor() as cur:
        for row in rows:
            ext_id = clean_null(row.get("claim_id", ""))
            if not ext_id:
                skipped += 1
                continue
            if ext_id in existing_ext_ids:
                if not dry_run:
                    cur.execute(
                        "SELECT id FROM atlas.claims WHERE corpus_tag=%s AND metadata->>'external_claim_id'=%s LIMIT 1",
                        (CORPUS_TAG, ext_id),
                    )
                    existing = cur.fetchone()
                    if existing:
                        ext_to_id[ext_id] = str(existing[0])
                skipped += 1
                continue

            claim_text = clean_null(row.get("claim_text", ""))
            if not claim_text:
                skipped += 1
                continue

            project_code = clean_null(row.get("project_code", ""))
            raw_confidence = row.get("confidence_tier", "")
            mapped_confidence, original_confidence = map_confidence(raw_confidence)
            claim_level = map_level(row.get("claim_level", "1"))

            if claim_level == 3:
                print(f"  [WARN] Skipping Level 3 PMO claim {ext_id}", flush=True)
                skipped += 1
                continue

            entity_type = clean_null(row.get("entity_type", "")) or "project"
            entity_id_val = project_code or CAPABILITY_PROFILE_HOLDER_ID
            claim_subtype = clean_null(row.get("claim_subtype", ""))
            claim_domain = clean_null(row.get("claim_domain", "")) or "project_evidence"
            confidence_reason = (
                clean_null(row.get("confidence_reason", ""))
                or clean_null(row.get("claim_generation_note", ""))
            )
            source_label = clean_null(row.get("source_file", ""))
            source_excerpt = clean_null(row.get("source_excerpt", ""))

            meta = {
                "source_file": "claim_candidates_v0_7_validated_pmo_subset.csv",
                "external_claim_id": ext_id,
                "project_code": project_code,
                "original_confidence_tier": original_confidence,
            }

            new_id = str(uuid.uuid4())
            if not dry_run:
                insert_claim(
                    cur,
                    new_id, "asserts", claim_domain, claim_level, claim_text,
                    None, mapped_confidence, confidence_reason,
                    source_label, source_excerpt,
                    entity_type, entity_id_val,
                    claim_subtype, meta,
                )
                # Link to capability profile
                link_claim_to_container(cur, capability_profile_id, new_id)

                # Link to project container
                if project_code and project_code in project_map:
                    link_claim_to_container(cur, project_map[project_code], new_id)
                else:
                    print(
                        f"  [WARN] PMO claim {ext_id}: no project container found for code '{project_code}'",
                        flush=True,
                    )

            ext_to_id[ext_id] = new_id
            existing_ext_ids.add(ext_id)
            inserted += 1

    if not dry_run:
        conn.commit()

    print(f"  [pmo_claims] Done — inserted={inserted}, skipped={skipped}", flush=True)
    return ext_to_id


# ─────────────────────────────────────────────────────────────────────────────
# PMO evidence links
# ─────────────────────────────────────────────────────────────────────────────

def ingest_evidence_links_for_claims(
    conn: psycopg2.extensions.connection,
    claim_ext_to_id: dict[str, str],
    source_file_label: str,
    rows: list[dict],
    ext_id_key: str,
    dry_run: bool,
) -> None:
    """
    Generic helper to create claim_evidence_links for a set of claims.
    For impact/eval claims, rows are the claim rows themselves.
    For PMO claims, rows are the dedicated evidence link rows.
    """
    inserted = 0
    skipped = 0

    with conn.cursor() as cur:
        for row in rows:
            ext_id = clean_null(row.get(ext_id_key, ""))
            if not ext_id or ext_id not in claim_ext_to_id:
                if ext_id:
                    print(
                        f"  [WARN] evidence link: cannot match external claim id '{ext_id}'",
                        flush=True,
                    )
                skipped += 1
                continue

            claim_id = claim_ext_to_id[ext_id]
            source_file = clean_null(row.get("source_file", "")) or source_file_label
            source_excerpt = clean_null(row.get("source_excerpt", ""))
            evidence_type = clean_null(row.get("evidence_type", ""))
            evidence_quality = clean_null(row.get("evidence_quality", ""))
            source_conf = clean_null(row.get("source_confidence", ""))
            notes = clean_null(row.get("notes", ""))

            if not source_file:
                skipped += 1
                continue

            if dry_run:
                inserted += 1
                continue

            # Idempotency: skip if this (claim_id, source_file) link already exists
            cur.execute(
                "SELECT id FROM atlas.claim_evidence_links WHERE claim_id=%s AND source_file=%s LIMIT 1",
                (claim_id, source_file),
            )
            if cur.fetchone():
                skipped += 1
                continue

            cur.execute(
                """
                INSERT INTO atlas.claim_evidence_links (
                  claim_id, external_claim_id, source_file, source_excerpt,
                  evidence_type, evidence_quality, source_confidence, notes
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    claim_id, ext_id, source_file, source_excerpt,
                    evidence_type, evidence_quality, source_conf, notes,
                ),
            )
            inserted += 1

    if not dry_run:
        conn.commit()

    print(
        f"  [evidence_links] {source_file_label}: inserted={inserted}, skipped={skipped}",
        flush=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Embeddings
# ─────────────────────────────────────────────────────────────────────────────

def generate_embeddings(
    conn: psycopg2.extensions.connection,
    dry_run: bool,
) -> None:
    """Generate text-embedding-3-small embeddings for CPC claims and containers."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("  [embeddings] OPENAI_API_KEY not set — skipping embeddings.", flush=True)
        return

    if dry_run:
        print("  [embeddings] --dry-run: skipping", flush=True)
        return

    try:
        from openai import OpenAI  # noqa: PLC0415
    except ImportError:
        print("  [embeddings] openai package not installed — skipping.", flush=True)
        return

    client = OpenAI(api_key=api_key)
    total_embedded = 0
    total_failed = 0

    # ── Claims ────────────────────────────────────────────────────────────────
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, claim_text, claim_domain, entity_id
            FROM atlas.claims
            WHERE corpus_tag = %s AND embedding IS NULL
            ORDER BY id
            """,
            (CORPUS_TAG,),
        )
        claim_rows = cur.fetchall()

    print(f"  [embeddings] {len(claim_rows)} claims need embedding...", flush=True)
    for i in range(0, len(claim_rows), EMBED_BATCH_SIZE):
        batch = claim_rows[i : i + EMBED_BATCH_SIZE]
        texts = [
            f"{r['claim_text']} {r['claim_domain'] or ''} {r['entity_id'] or ''}".strip()
            for r in batch
        ]
        try:
            resp = client.embeddings.create(input=[t[:8000] for t in texts], model=EMBED_MODEL)
            vectors = [item.embedding for item in resp.data]
            with conn.cursor() as cur:
                for row, vec in zip(batch, vectors):
                    cur.execute(
                        "UPDATE atlas.claims SET embedding = %s::vector WHERE id = %s",
                        (f"[{','.join(str(v) for v in vec)}]", row["id"]),
                    )
            conn.commit()
            total_embedded += len(batch)
            print(f"  [embeddings] claims {i + len(batch)}/{len(claim_rows)}", end="\r", flush=True)
        except Exception as exc:
            total_failed += len(batch)
            print(f"\n  [WARN] embedding batch failed: {exc}", flush=True)
        time.sleep(0.3)

    print(f"\n  [embeddings] Claims done — {total_embedded} embedded, {total_failed} failed")

    # ── Evidence containers ───────────────────────────────────────────────────
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, name, description, business_unit, customer_or_funder, mode_or_focus_area
            FROM atlas.evidence_containers
            WHERE corpus_tag = %s AND embedding IS NULL
            ORDER BY id
            """,
            (CORPUS_TAG,),
        )
        container_rows = cur.fetchall()

    print(f"  [embeddings] {len(container_rows)} containers need embedding...", flush=True)
    for i in range(0, len(container_rows), EMBED_BATCH_SIZE):
        batch = container_rows[i : i + EMBED_BATCH_SIZE]
        texts = [
            " ".join(
                filter(
                    None,
                    [
                        r["name"],
                        r["description"],
                        r["business_unit"],
                        r["customer_or_funder"],
                        r["mode_or_focus_area"],
                    ],
                )
            ).strip()
            for r in batch
        ]
        try:
            resp = client.embeddings.create(input=[t[:8000] for t in texts], model=EMBED_MODEL)
            vectors = [item.embedding for item in resp.data]
            with conn.cursor() as cur:
                for row, vec in zip(batch, vectors):
                    cur.execute(
                        "UPDATE atlas.evidence_containers SET embedding = %s::vector WHERE id = %s",
                        (f"[{','.join(str(v) for v in vec)}]", row["id"]),
                    )
            conn.commit()
            total_embedded += len(batch)
            print(f"  [embeddings] containers {i + len(batch)}/{len(container_rows)}", end="\r", flush=True)
        except Exception as exc:
            total_failed += len(batch)
            print(f"\n  [WARN] embedding batch failed: {exc}", flush=True)
        time.sleep(0.3)

    print(
        f"\n  [embeddings] Containers done — total embedded={total_embedded}, failed={total_failed}",
        flush=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# File validation
# ─────────────────────────────────────────────────────────────────────────────

REQUIRED_FILES: dict[str, tuple[int, list[str]]] = {
    "data/projects_master_v0_4_targeted_enriched.csv": (
        392,
        [
            "project_code", "project_name", "business_unit", "customer_or_funder",
            "delivery_status", "delivery_status_normalised", "project_budget_gbp",
            "start_date", "end_date", "mode_or_focus_area", "cpc_role",
            "brief_description", "dynamics_365_url", "source_files", "source_confidence",
        ],
    ),
    "data/impact_claim_candidates_v0.csv": (
        32,
        [
            "claim_id", "entity_type", "entity_id_or_project_code", "claim_level",
            "claim_domain", "claim_text", "confidence_tier", "confidence_reason",
            "source_file", "source_excerpt",
        ],
    ),
    "data/evaluation_method_claims_v0.csv": (
        12,
        [
            "method_claim_id", "claim_text", "source_file", "source_excerpt",
            "applies_to", "confidence_tier", "notes",
        ],
    ),
    "data/claim_candidates_v0_7_validated_pmo_subset.csv": (
        5,
        [
            "claim_id", "project_code", "entity_type", "claim_level",
            "claim_subtype", "claim_domain", "claim_text", "confidence_tier",
            "confidence_reason", "source_file", "source_excerpt", "review_status",
        ],
    ),
    "data/claim_evidence_links_v0_7_validated_pmo_subset.csv": (
        5,
        [
            "link_id", "claim_id", "source_file", "source_excerpt",
            "evidence_type", "evidence_quality", "source_confidence", "notes",
        ],
    ),
}


def validate_files(pack_dir: Path) -> dict[str, list[dict]]:
    """Validate all required files. Returns dict of file_key -> rows."""
    loaded: dict[str, list[dict]] = {}
    errors: list[str] = []

    for rel_path, (min_rows, required_cols) in REQUIRED_FILES.items():
        full_path = pack_dir / rel_path
        if not full_path.exists():
            errors.append(f"MISSING FILE: {full_path}")
            continue

        rows = read_csv(full_path)
        actual_rows = len(rows)

        if actual_rows < min_rows:
            errors.append(
                f"ROW COUNT: {rel_path} has {actual_rows} rows, expected >= {min_rows}"
            )

        if rows:
            actual_cols = set(rows[0].keys())
            missing_cols = [c for c in required_cols if c not in actual_cols]
            if missing_cols:
                errors.append(
                    f"MISSING COLUMNS in {rel_path}: {', '.join(missing_cols)}"
                )

        loaded[rel_path] = rows

    if errors:
        print("\n  [validate] FILE VALIDATION FAILED:", flush=True)
        for e in errors:
            print(f"    {e}", flush=True)
        sys.exit(1)

    print(
        "  [validate] All required files present with expected columns and row counts.",
        flush=True,
    )
    return loaded


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="CPC Capability Corpus v0.1 ingestion")
    parser.add_argument("--pack-dir", help="Root of the ingestion pack directory")
    parser.add_argument("--dry-run", action="store_true", help="Validate only; do not write to DB")
    parser.add_argument("--skip-embeddings", action="store_true", help="Skip embedding generation")
    args = parser.parse_args()

    # Load .env from project root
    load_dotenv(Path(__file__).parent.parent / ".env")

    print("=" * 60, flush=True)
    print("CPC Capability Corpus v0.1 — Ingestion", flush=True)
    print(f"  dry_run={args.dry_run}  skip_embeddings={args.skip_embeddings}", flush=True)
    print("=" * 60, flush=True)

    # ── Locate pack ──────────────────────────────────────────────────────────
    pack_dir = find_pack_dir(args.pack_dir)

    # ── Validate files ───────────────────────────────────────────────────────
    loaded = validate_files(pack_dir)

    project_rows = loaded["data/projects_master_v0_4_targeted_enriched.csv"]
    impact_rows = loaded["data/impact_claim_candidates_v0.csv"]
    eval_rows = loaded["data/evaluation_method_claims_v0.csv"]
    pmo_rows = loaded["data/claim_candidates_v0_7_validated_pmo_subset.csv"]
    pmo_link_rows = loaded["data/claim_evidence_links_v0_7_validated_pmo_subset.csv"]

    print(
        f"\n  Files OK — projects={len(project_rows)}, impact={len(impact_rows)}, "
        f"eval={len(eval_rows)}, pmo={len(pmo_rows)}, pmo_links={len(pmo_link_rows)}",
        flush=True,
    )

    # ── Connect ──────────────────────────────────────────────────────────────
    conn = get_connection()
    print("  [db] Connected.", flush=True)

    try:
        # ── Schema ───────────────────────────────────────────────────────────
        apply_schema(conn, args.dry_run)

        # ── Container type check ─────────────────────────────────────────────
        project_type, profile_type = check_container_types(conn)
        print(f"  [container_type] project={project_type}  profile={profile_type}", flush=True)

        # ── Capability Profile ───────────────────────────────────────────────
        capability_profile_id = upsert_capability_profile(conn, profile_type, args.dry_run)

        # ── Project spine ────────────────────────────────────────────────────
        project_map = ingest_project_spine(
            conn, project_rows, project_type, capability_profile_id, args.dry_run
        )

        # ── Load existing claim ext IDs (idempotency) ────────────────────────
        existing_ext_ids: set[str] = set() if args.dry_run else load_existing_claim_external_ids(conn)

        # ── Impact claims ─────────────────────────────────────────────────────
        impact_map = ingest_impact_claims(
            conn, impact_rows, capability_profile_id, existing_ext_ids, args.dry_run
        )
        # Evidence links for impact claims
        ingest_evidence_links_for_claims(
            conn, impact_map,
            "impact_claim_candidates_v0.csv",
            impact_rows, "claim_id", args.dry_run,
        )

        # ── Evaluation method claims ──────────────────────────────────────────
        eval_map = ingest_evaluation_claims(
            conn, eval_rows, capability_profile_id, existing_ext_ids, args.dry_run
        )
        ingest_evidence_links_for_claims(
            conn, eval_map,
            "evaluation_method_claims_v0.csv",
            eval_rows, "method_claim_id", args.dry_run,
        )

        # ── PMO validated claims ──────────────────────────────────────────────
        pmo_map = ingest_pmo_claims(
            conn, pmo_rows, capability_profile_id, project_map, existing_ext_ids, args.dry_run
        )

        # ── PMO evidence links ────────────────────────────────────────────────
        all_claim_map = {**impact_map, **eval_map, **pmo_map}
        ingest_evidence_links_for_claims(
            conn, all_claim_map,
            "claim_evidence_links_v0_7_validated_pmo_subset.csv",
            pmo_link_rows, "claim_id", args.dry_run,
        )

        # ── Embeddings ────────────────────────────────────────────────────────
        if not args.skip_embeddings:
            generate_embeddings(conn, args.dry_run)
        else:
            print("\n  [embeddings] Skipped (--skip-embeddings)", flush=True)

        # ── Summary ───────────────────────────────────────────────────────────
        print("\n" + "=" * 60, flush=True)
        print("INGESTION SUMMARY", flush=True)
        print(f"  Capability Profile : {capability_profile_id}", flush=True)
        print(f"  Projects mapped    : {len(project_map)}", flush=True)
        print(f"  Impact claims      : {len(impact_map)}", flush=True)
        print(f"  Eval claims        : {len(eval_map)}", flush=True)
        print(f"  PMO claims         : {len(pmo_map)}", flush=True)
        if args.dry_run:
            print("  [DRY RUN — no changes written to database]", flush=True)
        print("=" * 60, flush=True)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
