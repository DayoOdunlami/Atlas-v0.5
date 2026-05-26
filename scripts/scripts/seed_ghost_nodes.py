#!/usr/bin/env python3
"""
Identify Ghost Node candidates for Lens 2 v1.0 with spread constraints and
Haiku-generated strategically meaningful labels.

Spread constraints (per Dayo feedback):
  - Minimum 10 grid cells (~12.5 viz units) between any two candidates
  - Max 2 candidates per dominant-mode-pair
  - Target 18–24 spread candidates

Label generation:
  - Preferred: one-shot Claude Haiku call per candidate, deriving label from
    surrounding cluster topic_labels (e.g. "Aviation × Battery Storage").
  - Fallback: template label if ANTHROPIC_API_KEY absent or API fails.

Usage
-----
    POSTGRES_URL=... ANTHROPIC_API_KEY=... python scripts/seed_ghost_nodes.py
    POSTGRES_URL=... python scripts/seed_ghost_nodes.py --dry-run
    POSTGRES_URL=... python scripts/seed_ghost_nodes.py --approve-all  # dev/demo

Requirements
------------
    pip install psycopg2-binary numpy anthropic
"""

import math
import os
import sys
import uuid
import argparse
from collections import Counter

try:
    import psycopg2
    import psycopg2.extras
    import numpy as np
except ImportError:
    print("ERROR: run: pip install psycopg2-binary numpy", file=sys.stderr)
    sys.exit(1)

try:
    import anthropic as _anthropic
    _ANTHROPIC_AVAILABLE = True
except ImportError:
    _ANTHROPIC_AVAILABLE = False

GRID_SIZE = 40
TOP_POOL = 200        # candidates to evaluate before spread filter
TOP_N = 24            # max ghost nodes to insert
MIN_GRID_DIST = 5.0   # minimum distance between any two candidates (grid cells = ~12.5 viz units)
MAX_PER_PAIR = 2      # max candidates per dominant-mode-pair
MIN_SPREAD = 18       # minimum acceptable spread count (else warn)
CELL_W = 100.0 / GRID_SIZE

HAIKU_MODEL = "claude-haiku-4-5"
HAIKU_SYSTEM = (
    "You label gaps in a UK transport innovation map for policy professionals. "
    "Respond with a 2–4 word label ONLY — no explanation, no quotes, no period."
)


def grid_idx(val: float) -> int:
    return max(0, min(GRID_SIZE - 1, int(val / CELL_W)))


def grid_dist(a: dict, b: dict) -> float:
    return math.sqrt((a["gx"] - b["gx"]) ** 2 + (a["gy"] - b["gy"]) ** 2)


def pair_key(mode_items) -> str:
    """Accept either list[str] or list[tuple[str,int]] (from Counter.most_common)."""
    names = []
    for item in mode_items[:2]:
        name = item[0] if isinstance(item, tuple) else item
        if name:
            names.append(name)
    return " × ".join(sorted(names))


# ---------------------------------------------------------------------------
# Label generation
# ---------------------------------------------------------------------------

def generate_label_haiku(
    cluster_topics: list[str],
    dominant_modes: list[str],
    client,
) -> str:
    """Call Claude Haiku to produce a strategically meaningful 2-4 word label."""
    topics_str = ", ".join(f'"{t}"' for t in cluster_topics[:6]) if cluster_topics else "Unknown"
    modes_str = ", ".join(dominant_modes[:3]) if dominant_modes else "transport"
    prompt = (
        f"Surrounding cluster topics: {topics_str}.\n"
        f"Dominant transport modes nearby: {modes_str}.\n\n"
        "Name the innovation that SHOULD exist in this gap. "
        "Be specific (e.g. 'Aviation × Battery Storage', 'Rail Hydrogen Corridors', "
        "'Maritime × Climate Resilience'). 2–4 words only."
    )
    try:
        response = client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=20,
            system=HAIKU_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        label = response.content[0].text.strip().strip('"').strip("'")
        # Clamp to 4 words
        words = label.split()[:4]
        label = " ".join(words)
        return label if label else _template_label(dominant_modes, cluster_topics)
    except Exception as e:
        print(f"  (Haiku call failed: {e} — falling back to template)", file=sys.stderr)
        return _template_label(dominant_modes, cluster_topics)


def _template_label(modes: list[str], topics: list[str]) -> str:
    """Fallback template when Haiku is unavailable."""
    def short(m: str) -> str:
        m = m.strip()
        replacements = {
            "highways & integrated transport": "Highways",
            "hit": "Highways",
            "data & digital": "Digital",
            "data_digital": "Digital",
            "active travel": "Active Travel",
            "freight & logistics": "Freight",
        }
        return replacements.get(m.lower(), m.split()[0].title())

    mode_short = short(modes[0]) if modes else "Transport"
    topic_word = ""
    if topics:
        for t in topics:
            words = [w for w in (t or "").split() if len(w) > 4
                     and w.lower() not in {"and", "the", "for", "with"}]
            if words:
                topic_word = words[0].title()
                break
    if topic_word and topic_word.lower() != mode_short.lower():
        return f"{mode_short} × {topic_word}"
    return f"{mode_short} Innovation Gap"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--approve-all", action="store_true",
                        help="Set status='approved' (dev/demo only)")
    parser.add_argument("--no-haiku", action="store_true",
                        help="Force template labels even if ANTHROPIC_API_KEY is set")
    args = parser.parse_args()

    postgres_url = os.environ.get("POSTGRES_URL", "")
    if not postgres_url:
        print("ERROR: POSTGRES_URL not set.", file=sys.stderr)
        sys.exit(1)

    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    use_haiku = (
        _ANTHROPIC_AVAILABLE
        and bool(anthropic_key)
        and not args.no_haiku
    )
    haiku_client = None
    if use_haiku:
        haiku_client = _anthropic.Anthropic(api_key=anthropic_key)
        print(f"Haiku label generation: enabled ({HAIKU_MODEL})")
    else:
        print("Haiku label generation: disabled (template fallback)")

    conn = psycopg2.connect(postgres_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    # -----------------------------------------------------------------------
    # Load node positions + cluster topic labels
    # -----------------------------------------------------------------------
    print("Loading node positions…")
    cur.execute(
        """
        SELECT
            p.id::text,
            p.viz_x::float,
            p.viz_y::float,
            p.cpc_modes[1]       AS primary_cpc_mode,
            sc.topic_label       AS cluster_topic
        FROM atlas.projects p
        LEFT JOIN atlas.semantic_clusters sc ON p.semantic_cluster_id = sc.cluster_id
        WHERE p.viz_x IS NOT NULL AND p.viz_y IS NOT NULL
        """
    )
    project_rows = cur.fetchall()

    cur.execute(
        """
        SELECT
            lc.id::text,
            lc.viz_x::float,
            lc.viz_y::float,
            sc.dominant_cpc_system AS primary_cpc_mode,
            sc.topic_label         AS cluster_topic
        FROM atlas.live_calls lc
        LEFT JOIN atlas.semantic_clusters sc ON lc.semantic_cluster_id = sc.cluster_id
        WHERE lc.viz_x IS NOT NULL AND lc.viz_y IS NOT NULL
        """
    )
    live_rows = cur.fetchall()
    all_rows = list(project_rows) + list(live_rows)
    print(f"  {len(project_rows)} projects + {len(live_rows)} live calls = {len(all_rows)} nodes")

    # -----------------------------------------------------------------------
    # Build occupancy grid
    # -----------------------------------------------------------------------
    occupancy: list[list[list[tuple[str | None, str | None]]]] = [
        [[] for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)
    ]
    for row in all_rows:
        gx = grid_idx(float(row["viz_x"]))
        gy = grid_idx(float(row["viz_y"]))
        occupancy[gy][gx].append((row["primary_cpc_mode"], row["cluster_topic"]))

    # -----------------------------------------------------------------------
    # Compute surrounding density for low-occupancy cells
    # -----------------------------------------------------------------------
    raw_candidates: list[dict] = []
    for gy in range(GRID_SIZE):
        for gx in range(GRID_SIZE):
            if len(occupancy[gy][gx]) > 1:
                continue
            surrounding_modes: list[str] = []
            surrounding_topics: list[str] = []
            surrounding_count = 0
            for dy in range(-1, 2):
                for dx in range(-1, 2):
                    if dx == 0 and dy == 0:
                        continue
                    ny, nx = gy + dy, gx + dx
                    if not (0 <= ny < GRID_SIZE and 0 <= nx < GRID_SIZE):
                        continue
                    for m, t in occupancy[ny][nx]:
                        surrounding_count += 1
                        if m:
                            surrounding_modes.append(m)
                        if t:
                            surrounding_topics.append(t)
            if surrounding_count == 0:
                continue
            raw_candidates.append({
                "gx": gx, "gy": gy,
                "viz_x": (gx + 0.5) * CELL_W,
                "viz_y": (gy + 0.5) * CELL_W,
                "surrounding_count": surrounding_count,
                "surrounding_modes": surrounding_modes,
                "surrounding_topics": surrounding_topics,
            })

    if not raw_candidates:
        print("ERROR: no candidate cells found.", file=sys.stderr)
        sys.exit(1)

    median_density = float(np.median([c["surrounding_count"] for c in raw_candidates]))
    raw_candidates = [c for c in raw_candidates if c["surrounding_count"] > median_density]
    raw_candidates.sort(key=lambda c: -c["surrounding_count"])
    pool = raw_candidates[:TOP_POOL]

    # -----------------------------------------------------------------------
    # Apply spread constraints (greedy selection)
    # -----------------------------------------------------------------------
    selected: list[dict] = []
    pair_counts: dict[str, int] = {}

    for c in pool:
        if len(selected) >= TOP_N:
            break

        # (a) Minimum distance from every already-selected candidate.
        too_close = any(grid_dist(c, s) < MIN_GRID_DIST for s in selected)
        if too_close:
            continue

        # (b) Max 2 per dominant-mode-pair.
        pk = pair_key(Counter(c["surrounding_modes"]).most_common(2)[0:2])
        if pair_counts.get(pk, 0) >= MAX_PER_PAIR:
            continue

        selected.append(c)
        pair_counts[pk] = pair_counts.get(pk, 0) + 1

    if len(selected) < MIN_SPREAD:
        print(
            f"  WARNING: only {len(selected)} candidates satisfy spread constraints "
            f"(target {MIN_SPREAD}–{TOP_N}). Consider loosening MIN_GRID_DIST.",
            file=sys.stderr,
        )

    # -----------------------------------------------------------------------
    # Generate labels
    # -----------------------------------------------------------------------
    print(f"\nGenerating labels for {len(selected)} spread candidates…")
    rows_to_insert = []

    for i, c in enumerate(selected):
        dominant_modes = [
            m for m, _ in Counter(c["surrounding_modes"]).most_common(3)
        ]
        unique_topics = list(dict.fromkeys(
            t for t in c["surrounding_topics"] if t
        ))[:8]

        if use_haiku and haiku_client is not None:
            label = generate_label_haiku(unique_topics, dominant_modes, haiku_client)
        else:
            label = _template_label(dominant_modes, unique_topics)

        pk = pair_key(Counter(c["surrounding_modes"]).most_common(2)[0:2])
        node_id = str(uuid.uuid4())
        status = "approved" if args.approve_all else "pending"

        print(
            f"  {i+1:2d}. viz=({c['viz_x']:.1f},{c['viz_y']:.1f}) "
            f"surr={c['surrounding_count']:3d} pair='{pk}' label='{label}'"
        )
        rows_to_insert.append({
            "id": node_id,
            "viz_x": round(c["viz_x"], 2),
            "viz_y": round(c["viz_y"], 2),
            "viz_z": 50.0,
            "label": label,
            "source_centroid_ids": [],
            "dominant_modes": dominant_modes,
            "status": status,
        })

    print(f"\nTotal: {len(rows_to_insert)} candidates "
          f"({len(set(pair_key(Counter(c['surrounding_modes']).most_common(2)[0:2]) for c in selected))} distinct pairs)")

    if args.dry_run:
        print("(dry-run — nothing written)")
        return

    # -----------------------------------------------------------------------
    # Write to DB
    # -----------------------------------------------------------------------
    print("\nWriting to atlas.ghost_nodes…")
    cur.execute("DELETE FROM atlas.ghost_nodes")
    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO atlas.ghost_nodes
            (id, viz_x, viz_y, viz_z, label, source_centroid_ids, dominant_modes, status)
        VALUES %s
        """,
        [
            (r["id"], r["viz_x"], r["viz_y"], r["viz_z"], r["label"],
             r["source_centroid_ids"], r["dominant_modes"], r["status"])
            for r in rows_to_insert
        ],
        template="(%s, %s, %s, %s, %s, %s::text[], %s::text[], %s)",
    )
    conn.commit()
    print(f"Done. Inserted {len(rows_to_insert)} ghost nodes as status='{rows_to_insert[0]['status']}'.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
