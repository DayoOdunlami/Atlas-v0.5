#!/usr/bin/env python3
"""
Day 1 Classification Backfill Script
Classifies atlas.projects, atlas.knowledge_documents, atlas.live_calls,
and derives atlas.organisations classifications.

Usage:
  python3 scripts/classify_entities.py --stage projects
  python3 scripts/classify_entities.py --stage knowledge_docs
  python3 scripts/classify_entities.py --stage live_calls
  python3 scripts/classify_entities.py --stage smoke_check
"""

import os
import sys
import json
import time
import argparse
import re
from typing import Optional
import psycopg2
import psycopg2.extras
import anthropic

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

POSTGRES_URL = os.environ.get("POSTGRES_URL", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# Haiku 4.5 model identifier
HAIKU_MODEL = "claude-haiku-4-5"

# System label → legacy column mapping
SYSTEM_TO_LEGACY_MODE = {
    "Rail": "rail",
    "Aviation": "aviation",
    "Maritime": "maritime",
    "Highways & Integrated Transport": "hit",
    "Data & Digital": "data_digital",
    # No legacy equivalent: "Built Environment", "Local Growth", "Cross-modal"
}

THEME_TO_LEGACY_THEME = {
    "Autonomy": "autonomy",
    "People Experience": "people_experience",
    "Hubs and Clusters": "hubs_clusters",
    "Decarbonisation": "decarbonisation",
    "Planning and Operation": "planning_operation",
    "Sector Shaping": "industry",
    "Evidence & Foresight": "industry",
    # No legacy equivalent: "Climate Adaptation & Resilience"
}

BATCH_SIZE = 20
RETRY_LIMIT = 3
RETRY_DELAY = 2.0


# ---------------------------------------------------------------------------
# Anthropic client
# ---------------------------------------------------------------------------

def get_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_conn():
    return psycopg2.connect(POSTGRES_URL)


def load_taxonomy(conn, taxonomy_id: str) -> dict:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT id, labels, classifier_prompt FROM atlas.taxonomies WHERE id = %s",
            (taxonomy_id,)
        )
        row = cur.fetchone()
        if not row:
            raise ValueError(f"Taxonomy {taxonomy_id!r} not found")
        return dict(row)


# ---------------------------------------------------------------------------
# Classification function
# ---------------------------------------------------------------------------

def parse_json_response(text: str) -> dict:
    """Extract JSON from model response, handling markdown fences."""
    text = text.strip()
    # Strip markdown fences if present
    match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if match:
        text = match.group(1)
    # Find JSON object in text
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError(f"No JSON found in response: {text[:200]}")


def classify_entity(
    client: anthropic.Anthropic,
    source_text: str,
    taxonomy: dict,
) -> tuple[list[str], str]:
    """
    Classify source_text against taxonomy using Haiku.
    Returns (validated_labels, rationale).
    """
    valid_labels = set(taxonomy["labels"])
    prompt = taxonomy["classifier_prompt"]

    full_prompt = f"{prompt}\n\nContent to classify:\n{source_text[:4000]}"

    for attempt in range(RETRY_LIMIT):
        try:
            response = client.messages.create(
                model=HAIKU_MODEL,
                max_tokens=256,
                messages=[{"role": "user", "content": full_prompt}]
            )
            text = response.content[0].text
            parsed = parse_json_response(text)
            raw_labels = parsed.get("labels", [])
            rationale = parsed.get("rationale", "")

            # Validate labels against taxonomy
            valid = [l for l in raw_labels if l in valid_labels]
            invalid = [l for l in raw_labels if l not in valid_labels]
            if invalid:
                print(f"  Warning: invalid labels dropped: {invalid}", file=sys.stderr)

            return valid, rationale

        except Exception as e:
            if attempt < RETRY_LIMIT - 1:
                print(f"  Retry {attempt + 1}/{RETRY_LIMIT} after error: {e}", file=sys.stderr)
                time.sleep(RETRY_DELAY * (attempt + 1))
            else:
                print(f"  Failed after {RETRY_LIMIT} attempts: {e}", file=sys.stderr)
                raise


def insert_classifications(
    conn,
    entity_type: str,
    entity_id: str,
    taxonomy_id: str,
    labels: list[str],
    rationale: str,
    classified_by: str = None,
) -> int:
    """Insert classification rows. Returns count inserted."""
    if classified_by is None:
        classified_by = HAIKU_MODEL
    inserted = 0
    with conn.cursor() as cur:
        for label in labels:
            try:
                cur.execute(
                    """
                    INSERT INTO atlas.classifications
                      (entity_type, entity_id, taxonomy_id, label, confidence,
                       classified_by, rationale)
                    VALUES (%s, %s, %s, %s, 1.0, %s, %s)
                    ON CONFLICT (entity_type, entity_id, taxonomy_id, label) DO NOTHING
                    """,
                    (entity_type, entity_id, taxonomy_id, label, classified_by, rationale)
                )
                inserted += cur.rowcount
            except Exception as e:
                print(f"  Insert error for {entity_id} {label}: {e}", file=sys.stderr)
                conn.rollback()
                raise
    conn.commit()
    return inserted


# ---------------------------------------------------------------------------
# Legacy column mapping
# ---------------------------------------------------------------------------

def map_system_labels_to_legacy_modes(labels: list[str]) -> list[str]:
    result = []
    for l in labels:
        m = SYSTEM_TO_LEGACY_MODE.get(l)
        if m:
            result.append(m)
    return list(dict.fromkeys(result))  # dedupe preserving order


def map_theme_labels_to_legacy_themes(labels: list[str]) -> list[str]:
    result = []
    for l in labels:
        t = THEME_TO_LEGACY_THEME.get(l)
        if t:
            result.append(t)
    return list(dict.fromkeys(result))  # dedupe preserving order


# ---------------------------------------------------------------------------
# Stage 2: Projects
# ---------------------------------------------------------------------------

def classify_projects(conn, client, system_taxonomy, theme_taxonomy):
    print("=== Stage 2: Classifying projects ===")
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, title, abstract
            FROM atlas.projects
            ORDER BY id
            """
        )
        projects = cur.fetchall()

    print(f"  Total projects: {len(projects)}")
    errors = 0
    total_system = 0
    total_theme = 0

    for i, p in enumerate(projects):
        source_text = f"{p['title']}\n\n{p['abstract'] or ''}"
        pid = str(p["id"])

        # Skip if already classified (idempotent)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM atlas.classifications WHERE entity_type='project' AND entity_id=%s AND taxonomy_id='cpc_system'",
                (pid,)
            )
            if cur.fetchone()[0] > 0:
                continue

        try:
            # Classify system
            sys_labels, sys_rationale = classify_entity(client, source_text, system_taxonomy)
            insert_classifications(conn, "project", pid, "cpc_system", sys_labels, sys_rationale)
            total_system += len(sys_labels)

            # Classify theme
            thm_labels, thm_rationale = classify_entity(client, source_text, theme_taxonomy)
            insert_classifications(conn, "project", pid, "cpc_theme", thm_labels, thm_rationale)
            total_theme += len(thm_labels)

            # Dual-write to legacy columns
            legacy_modes = map_system_labels_to_legacy_modes(sys_labels)
            legacy_themes = map_theme_labels_to_legacy_themes(thm_labels)

            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE atlas.projects
                    SET cpc_modes = %s,
                        cpc_themes = %s,
                        last_synced_at = now()
                    WHERE id = %s
                    """,
                    (legacy_modes if legacy_modes else [], legacy_themes if legacy_themes else [], pid)
                )
            conn.commit()

            if (i + 1) % 50 == 0:
                print(f"  Progress: {i+1}/{len(projects)} projects classified")

        except Exception as e:
            errors += 1
            print(f"  ERROR project {pid}: {e}", file=sys.stderr)
            if errors > len(projects) * 0.05:
                print(f"  HALT: error rate > 5% ({errors}/{i+1})", file=sys.stderr)
                sys.exit(1)

    print(f"  Done. Classified {len(projects)} projects. Total system labels: {total_system}, theme labels: {total_theme}, errors: {errors}")
    return errors


def smoke_check_projects(conn, client, system_taxonomy, theme_taxonomy, n=5):
    """Print 5 random projects with their classifications to verify sanity."""
    print("\n=== Smoke check: 5 random projects ===")
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT p.id, p.title, p.abstract, p.cpc_modes, p.cpc_themes,
              (SELECT array_agg(label) FROM atlas.classifications
               WHERE entity_type='project' AND entity_id=p.id AND taxonomy_id='cpc_system') AS sys_labels,
              (SELECT array_agg(label) FROM atlas.classifications
               WHERE entity_type='project' AND entity_id=p.id AND taxonomy_id='cpc_theme') AS thm_labels,
              (SELECT rationale FROM atlas.classifications
               WHERE entity_type='project' AND entity_id=p.id AND taxonomy_id='cpc_system' LIMIT 1) AS sys_rationale
            FROM atlas.projects p
            WHERE cardinality(p.cpc_modes) > 0
            ORDER BY random()
            LIMIT %s
            """,
            (n,)
        )
        rows = cur.fetchall()

    for r in rows:
        print(f"\n  Title: {r['title'][:80]}")
        print(f"  Abstract: {(r['abstract'] or '')[:120]}...")
        print(f"  cpc_system labels: {r['sys_labels']}")
        print(f"  cpc_theme  labels: {r['thm_labels']}")
        print(f"  Legacy modes:      {r['cpc_modes']}")
        print(f"  Legacy themes:     {r['cpc_themes']}")
        print(f"  Rationale:         {r['sys_rationale']}")


def acceptance_check_projects(conn):
    """Run acceptance checks for Stage 2."""
    print("\n=== Acceptance checks: Stage 2 ===")
    ok = True

    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(DISTINCT entity_id) FROM atlas.classifications WHERE entity_type='project' AND taxonomy_id='cpc_system'"
        )
        sys_classified = cur.fetchone()[0]
        print(f"  Projects classified (cpc_system): {sys_classified} (need >=600)")
        if sys_classified < 600:
            print(f"  FAIL: only {sys_classified} classified (need >= 600)")
            ok = False

        cur.execute(
            "SELECT COUNT(DISTINCT entity_id) FROM atlas.classifications WHERE entity_type='project' AND taxonomy_id='cpc_theme'"
        )
        thm_classified = cur.fetchone()[0]
        print(f"  Projects classified (cpc_theme):  {thm_classified} (need >=600)")
        if thm_classified < 600:
            print(f"  FAIL: only {thm_classified} classified (need >= 600)")
            ok = False

        cur.execute(
            "SELECT COUNT(*) FROM atlas.projects WHERE cardinality(cpc_modes) > 0"
        )
        legacy_modes = cur.fetchone()[0]
        print(f"  Projects with legacy cpc_modes:   {legacy_modes} (need >=500)")
        if legacy_modes < 500:
            print(f"  FAIL: only {legacy_modes} have legacy modes (need >= 500)")
            ok = False

        cur.execute(
            "SELECT COUNT(DISTINCT label) FROM atlas.classifications WHERE entity_type='project' AND taxonomy_id='cpc_system'"
        )
        sys_label_count = cur.fetchone()[0]
        print(f"  Distinct system labels used:      {sys_label_count} (need >=6)")
        if sys_label_count < 6:
            print(f"  FAIL: only {sys_label_count} labels used")
            ok = False

        cur.execute(
            "SELECT COUNT(DISTINCT label) FROM atlas.classifications WHERE entity_type='project' AND taxonomy_id='cpc_theme'"
        )
        thm_label_count = cur.fetchone()[0]
        print(f"  Distinct theme labels used:       {thm_label_count} (need >=6)")
        if thm_label_count < 6:
            print(f"  FAIL: only {thm_label_count} labels used")
            ok = False

        # Check dominance (no single label > 70%)
        cur.execute(
            """
            SELECT label, COUNT(*) AS c,
              COUNT(*) * 100.0 / NULLIF((SELECT COUNT(DISTINCT entity_id) FROM atlas.classifications WHERE entity_type='project' AND taxonomy_id='cpc_system'), 0) AS pct
            FROM atlas.classifications
            WHERE entity_type='project' AND taxonomy_id='cpc_system'
            GROUP BY label ORDER BY c DESC LIMIT 3
            """
        )
        top_sys = cur.fetchall()
        print(f"  Top system labels: {top_sys}")
        if top_sys and float(top_sys[0][2]) > 70:
            print(f"  WARN: top system label '{top_sys[0][0]}' appears in {top_sys[0][2]:.1f}% of projects (>70%)")

        cur.execute(
            """
            SELECT label, COUNT(*) AS c,
              COUNT(*) * 100.0 / NULLIF((SELECT COUNT(DISTINCT entity_id) FROM atlas.classifications WHERE entity_type='project' AND taxonomy_id='cpc_theme'), 0) AS pct
            FROM atlas.classifications
            WHERE entity_type='project' AND taxonomy_id='cpc_theme'
            GROUP BY label ORDER BY c DESC LIMIT 3
            """
        )
        top_thm = cur.fetchall()
        print(f"  Top theme labels: {top_thm}")
        if top_thm and float(top_thm[0][2]) > 70:
            print(f"  WARN: top theme label '{top_thm[0][0]}' appears in {top_thm[0][2]:.1f}% of projects (>70%)")

    return ok


# ---------------------------------------------------------------------------
# Stage 6: Knowledge documents
# ---------------------------------------------------------------------------

def classify_knowledge_docs(conn, client, system_taxonomy, theme_taxonomy):
    print("=== Stage 6: Classifying knowledge documents ===")
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, title, summary, modes, themes
            FROM atlas.knowledge_documents
            WHERE status = 'approved'
            ORDER BY id
            """
        )
        docs = cur.fetchall()

    print(f"  Total approved docs: {len(docs)}")
    errors = 0

    for d in docs:
        source_text = f"{d['title']}\n\n{d['summary'] or ''}"
        did = str(d["id"])

        # Skip if already classified
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM atlas.classifications WHERE entity_type='knowledge_doc' AND entity_id=%s AND taxonomy_id='cpc_system'",
                (did,)
            )
            if cur.fetchone()[0] > 0:
                continue

        try:
            sys_labels, sys_rationale = classify_entity(client, source_text, system_taxonomy)
            insert_classifications(conn, "knowledge_doc", did, "cpc_system", sys_labels, sys_rationale)

            thm_labels, thm_rationale = classify_entity(client, source_text, theme_taxonomy)
            insert_classifications(conn, "knowledge_doc", did, "cpc_theme", thm_labels, thm_rationale)

            # Dual-write: MERGE with existing legacy columns
            legacy_modes_new = map_system_labels_to_legacy_modes(sys_labels)
            legacy_themes_new = map_theme_labels_to_legacy_themes(thm_labels)

            existing_modes = list(d["modes"] or [])
            existing_themes = list(d["themes"] or [])

            merged_modes = list(dict.fromkeys(existing_modes + legacy_modes_new))
            merged_themes = list(dict.fromkeys(existing_themes + legacy_themes_new))

            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE atlas.knowledge_documents
                    SET modes = %s,
                        themes = %s,
                        updated_at = now()
                    WHERE id = %s
                    """,
                    (merged_modes, merged_themes, did)
                )
            conn.commit()

            print(f"  Doc: {d['title'][:60]} -> sys={sys_labels} thm={thm_labels}")

        except Exception as e:
            errors += 1
            print(f"  ERROR doc {did}: {e}", file=sys.stderr)
            if errors > max(1, len(docs) * 0.05):
                print(f"  HALT: error rate > 5%", file=sys.stderr)
                sys.exit(1)

    print(f"  Done. Classified {len(docs)} documents. Errors: {errors}")
    return errors


# ---------------------------------------------------------------------------
# Stage 8: Live calls
# ---------------------------------------------------------------------------

def classify_live_calls(conn, client, system_taxonomy, theme_taxonomy):
    print("=== Stage 8: Classifying live calls ===")
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, title, description
            FROM atlas.live_calls
            WHERE relevance_tag IN ('relevant', 'borderline')
            ORDER BY id
            """
        )
        calls = cur.fetchall()

    print(f"  Total live calls to classify: {len(calls)}")
    errors = 0
    processed = 0

    for c in calls:
        source_text = f"{c['title']}\n\n{c['description'] or ''}"
        cid = str(c["id"])

        # Skip if already classified
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM atlas.classifications WHERE entity_type='live_call' AND entity_id=%s AND taxonomy_id='cpc_system'",
                (cid,)
            )
            if cur.fetchone()[0] > 0:
                processed += 1
                continue

        try:
            sys_labels, sys_rationale = classify_entity(client, source_text, system_taxonomy)
            insert_classifications(conn, "live_call", cid, "cpc_system", sys_labels, sys_rationale)

            thm_labels, thm_rationale = classify_entity(client, source_text, theme_taxonomy)
            insert_classifications(conn, "live_call", cid, "cpc_theme", thm_labels, thm_rationale)

            processed += 1
            if processed % 100 == 0:
                print(f"  Progress: {processed}/{len(calls)} live calls classified")

        except Exception as e:
            errors += 1
            print(f"  ERROR live_call {cid}: {e}", file=sys.stderr)
            if errors > len(calls) * 0.05:
                print(f"  HALT: error rate > 5% ({errors}/{processed})", file=sys.stderr)
                sys.exit(1)

    print(f"  Done. Classified {processed} live calls. Errors: {errors}")
    return errors


def acceptance_check_live_calls(conn):
    """Run acceptance checks for Stage 8."""
    print("\n=== Acceptance checks: Stage 8 ===")
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(DISTINCT entity_id) FROM atlas.classifications WHERE entity_type='live_call' AND taxonomy_id='cpc_system'"
        )
        sys_cnt = cur.fetchone()[0]
        print(f"  Live calls classified (cpc_system): {sys_cnt} (expect ~1202)")

        cur.execute(
            "SELECT COUNT(DISTINCT entity_id) FROM atlas.classifications WHERE entity_type='live_call' AND taxonomy_id='cpc_theme'"
        )
        thm_cnt = cur.fetchone()[0]
        print(f"  Live calls classified (cpc_theme):  {thm_cnt}")

        cur.execute(
            """
            SELECT label, COUNT(*) AS c,
              COUNT(*) * 100.0 / NULLIF((SELECT COUNT(DISTINCT entity_id) FROM atlas.classifications WHERE entity_type='live_call' AND taxonomy_id='cpc_system'), 0) AS pct
            FROM atlas.classifications
            WHERE entity_type='live_call' AND taxonomy_id='cpc_system'
            GROUP BY label ORDER BY c DESC
            """
        )
        rows = cur.fetchall()
        print("  Label distribution (cpc_system):")
        for r in rows:
            print(f"    {r[0]}: {r[1]} ({float(r[2]):.1f}%)")
            if float(r[2]) > 70:
                print(f"    WARN: {r[0]} dominates at {float(r[2]):.1f}%")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Day 1 Classification Backfill")
    parser.add_argument("--stage", required=True,
                        choices=["projects", "knowledge_docs", "live_calls", "smoke_check",
                                 "acceptance_projects", "acceptance_live_calls"])
    args = parser.parse_args()

    conn = get_conn()
    client = get_client()

    system_taxonomy = load_taxonomy(conn, "cpc_system")
    theme_taxonomy = load_taxonomy(conn, "cpc_theme")

    print(f"Loaded taxonomies: cpc_system ({len(system_taxonomy['labels'])} labels), cpc_theme ({len(theme_taxonomy['labels'])} labels)")

    if args.stage == "projects":
        errors = classify_projects(conn, client, system_taxonomy, theme_taxonomy)
        smoke_check_projects(conn, client, system_taxonomy, theme_taxonomy)
        ok = acceptance_check_projects(conn)
        if not ok:
            print("STAGE 2 ACCEPTANCE FAILED", file=sys.stderr)
            sys.exit(1)

    elif args.stage == "smoke_check":
        smoke_check_projects(conn, client, system_taxonomy, theme_taxonomy)
        acceptance_check_projects(conn)

    elif args.stage == "acceptance_projects":
        acceptance_check_projects(conn)

    elif args.stage == "knowledge_docs":
        errors = classify_knowledge_docs(conn, client, system_taxonomy, theme_taxonomy)

    elif args.stage == "live_calls":
        errors = classify_live_calls(conn, client, system_taxonomy, theme_taxonomy)
        acceptance_check_live_calls(conn)

    elif args.stage == "acceptance_live_calls":
        acceptance_check_live_calls(conn)

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
