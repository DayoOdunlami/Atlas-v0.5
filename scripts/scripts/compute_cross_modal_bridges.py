#!/usr/bin/env python3
"""
Compute cross-modal bridge scores for Atlas projects and live calls.

A bridge node is one whose top-K nearest semantic neighbours (cosine similarity)
span >= 2 distinct *normalised* CPC transport modes.

Mode normalisation: projects use abbreviated codes ('hit', 'data_digital');
live calls use full names ('Highways & Integrated Transport', 'Data & Digital').
Both are mapped to a canonical 5-mode set before diversity is computed.
'Built Environment' and other non-transport system categories are excluded.

Bridge score = normalised Shannon entropy of the similarity-weighted mode
distribution across the top-K neighbour set.  Score ∈ (0, 1]; higher = more
cross-modal.

Usage
-----
    POSTGRES_URL=postgres://... python scripts/compute_cross_modal_bridges.py

    # dry run (no DB writes, prints top-50 to stdout):
    POSTGRES_URL=... python scripts/compute_cross_modal_bridges.py --dry-run

    # evaluate a specific set of entity IDs (for test-set QA):
    POSTGRES_URL=... python scripts/compute_cross_modal_bridges.py \\
        --test-ids "id1,id2,..." --dry-run

    # tune parameters (see §2.1 quality gate):
    POSTGRES_URL=... python scripts/compute_cross_modal_bridges.py \\
        --k 20 --min-sim 0.0 --min-modes 2 --score-threshold 0.0

Requirements
------------
    pip install psycopg2-binary numpy

Tuning guidance (§2.1)
----------------------
Vary --k (10–30) and --score-threshold (0.0–0.4) to optimise the confusion
matrix on Dayo's hand-labelled test set.  Target: ≥80% recall at <30% FPR on
test set (15–20 positives, 100 random negative controls).

Quality gate output (--test-ids mode)
--------------------------------------
Prints a confusion matrix when --test-ids is given alongside
--positive-ids (known true bridges):

    python scripts/compute_cross_modal_bridges.py \\
        --test-ids "pos1,pos2,..." \\
        --positive-ids "pos1,pos2,..." \\
        --control-ids "ctrl1,ctrl2,..." \\
        --score-threshold 0.2 \\
        --dry-run
"""

import os
import sys
import json
import argparse
import numpy as np
from datetime import datetime, timezone

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 not found.  Run: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Mode normalisation
# ---------------------------------------------------------------------------

# Canonical 5-mode transport vocabulary.
_CANON_MODES = {
    # Highways & Integrated Transport
    "hit": "Highways",
    "highways": "Highways",
    "highways & integrated transport": "Highways",
    "highways and integrated transport": "Highways",
    "active travel": "Highways",      # grouped for bridge purposes
    "local transport": "Highways",
    # Rail
    "rail": "Rail",
    # Aviation
    "aviation": "Aviation",
    # Maritime
    "maritime": "Maritime",
    # Data & Digital / Freight (treat as cross-cutting)
    "data_digital": "Digital",
    "data & digital": "Digital",
    "data and digital": "Digital",
    "freight & logistics": "Digital", # grouped: cross-cutting
    "freight and logistics": "Digital",
    # Exclude non-transport system categories
    "built environment": None,
    "construction": None,
    "energy": None,
    "space": None,
}


def normalise_mode(raw: str | None) -> str | None:
    """Map raw mode string to canonical 5-mode label. Returns None to exclude."""
    if raw is None:
        return None
    canon = _CANON_MODES.get(raw.strip().lower())
    if canon is not None or raw.strip().lower() in _CANON_MODES:
        return canon
    # Unknown mode: exclude from diversity calculation to avoid noise.
    return None


# ---------------------------------------------------------------------------
# Bridge score computation
# ---------------------------------------------------------------------------

def compute_bridge_score(
    neighbours: list[tuple[str, float, str | None]],
) -> tuple[float, list[str], int]:
    """
    Given a list of (entity_id, similarity, normalised_mode) tuples,
    return (bridge_score, dominant_pair, n_distinct_modes).

    Modes must already be normalised (via normalise_mode) before calling.
    None-mode neighbours are excluded from diversity calculation.
    """
    mode_weights: dict[str, float] = {}
    total_w = 0.0

    for _, sim, mode in neighbours:
        if mode is None:
            continue  # excluded (non-transport or unknown)
        mode_weights[mode] = mode_weights.get(mode, 0.0) + sim
        total_w += sim

    n_modes = len(mode_weights)
    if n_modes < 2 or total_w < 1e-10:
        sorted_modes = sorted(mode_weights, key=lambda m: -mode_weights[m])
        return 0.0, sorted_modes[:2], n_modes

    proportions = [w / total_w for w in mode_weights.values()]
    entropy = -sum(p * np.log(p + 1e-12) for p in proportions)
    max_entropy = np.log(n_modes)
    score = float(entropy / (max_entropy + 1e-12))

    sorted_modes = sorted(mode_weights, key=lambda m: -mode_weights[m])
    return score, sorted_modes[:2], n_modes


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def load_entities(cur) -> list[dict]:
    """Load all embeddable projects + live calls with their normalised CPC modes."""
    cur.execute(
        """
        SELECT
            p.id::text               AS entity_id,
            'project'                AS entity_type,
            p.embedding              AS embedding,
            p.cpc_modes[1]           AS raw_mode
        FROM atlas.projects p
        WHERE p.embedding IS NOT NULL
          AND p.viz_x IS NOT NULL
          AND p.viz_y IS NOT NULL
        """
    )
    rows = cur.fetchall()

    # Live calls: use the dominant mode of their semantic cluster as proxy.
    cur.execute(
        """
        SELECT
            lc.id::text                    AS entity_id,
            'live_call'                    AS entity_type,
            lc.embedding                   AS embedding,
            sc.dominant_cpc_system         AS raw_mode
        FROM atlas.live_calls lc
        LEFT JOIN atlas.semantic_clusters sc
               ON lc.semantic_cluster_id = sc.cluster_id
        WHERE lc.embedding IS NOT NULL
          AND lc.viz_x IS NOT NULL
          AND lc.viz_y IS NOT NULL
        """
    )
    rows += cur.fetchall()
    # Apply canonical mode normalisation at load time.
    result = []
    for row in rows:
        result.append({
            "entity_id": row["entity_id"],
            "entity_type": row["entity_type"],
            "embedding": row["embedding"],
            "raw_mode": row["raw_mode"],
            "mode": normalise_mode(row["raw_mode"]),   # canonical or None
        })
    return result


def parse_embedding(raw) -> np.ndarray | None:
    """Parse embedding from pgvector string '[0.1,0.2,...]' or list."""
    if raw is None:
        return None
    if isinstance(raw, (list, np.ndarray)):
        return np.array(raw, dtype=np.float32)
    if isinstance(raw, str):
        try:
            return np.array(json.loads(raw), dtype=np.float32)
        except (json.JSONDecodeError, ValueError):
            return None
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compute cross-modal bridge scores for Atlas entities."
    )
    parser.add_argument("--k", type=int, default=20,
                        help="Top-K neighbours to sample (default 20)")
    parser.add_argument("--min-sim", type=float, default=0.0,
                        help="Minimum cosine similarity to count a neighbour")
    parser.add_argument("--min-modes", type=int, default=2,
                        help="Minimum distinct CPC modes required for bridge status")
    parser.add_argument("--score-threshold", type=float, default=0.0,
                        help="Minimum bridge_score to persist (0 = persist all bridges)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print results, do not write to DB")
    parser.add_argument("--test-ids", type=str, default="",
                        help="Comma-separated entity IDs to evaluate (subset mode)")
    parser.add_argument("--positive-ids", type=str, default="",
                        help="Known true-positive IDs for confusion matrix")
    parser.add_argument("--control-ids", type=str, default="",
                        help="Known negative-control IDs for confusion matrix")
    args = parser.parse_args()

    postgres_url = os.environ.get("POSTGRES_URL", "")
    if not postgres_url:
        print("ERROR: POSTGRES_URL environment variable not set.", file=sys.stderr)
        sys.exit(1)

    print("Connecting to database…")
    conn = psycopg2.connect(postgres_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    # -----------------------------------------------------------------------
    # Load entities
    # -----------------------------------------------------------------------
    print("Loading entity embeddings…")
    raw_rows = load_entities(cur)

    entities: list[dict] = []
    for row in raw_rows:
        emb = parse_embedding(row["embedding"])
        if emb is None or emb.size == 0:
            continue
        entities.append({
            "id": row["entity_id"],
            "type": row["entity_type"],
            "embedding": emb,
            "mode": row["mode"],       # already normalised by load_entities
        })

    print(f"  Loaded {len(entities)} entities with embeddings.")

    # Normalise for cosine similarity.
    emb_matrix = np.stack([e["embedding"] for e in entities]).astype(np.float32)
    norms = np.linalg.norm(emb_matrix, axis=1, keepdims=True)
    emb_norm = emb_matrix / (norms + 1e-10)

    id_to_idx = {e["id"]: i for i, e in enumerate(entities)}

    # -----------------------------------------------------------------------
    # Determine which entities to evaluate
    # -----------------------------------------------------------------------
    target_set = set(args.test_ids.split(",")) - {""} if args.test_ids else None
    if target_set is not None:
        target_indices = [id_to_idx[eid] for eid in target_set if eid in id_to_idx]
        missing = target_set - set(id_to_idx)
        if missing:
            print(f"  WARNING: {len(missing)} test IDs not found in entity set.", file=sys.stderr)
    else:
        target_indices = list(range(len(entities)))

    print(f"  Evaluating {len(target_indices)} entities (K={args.k})…")

    # -----------------------------------------------------------------------
    # Compute bridge scores
    # -----------------------------------------------------------------------
    K = args.k
    bridges: list[tuple[str, str, float, list[str], int]] = []

    for idx in target_indices:
        # Only transport-mode entities can be classified as bridges.
        # Entities with mode=None (biology noise, non-transport) are excluded
        # as bridge candidates but remain available as neighbours.
        if entities[idx]["mode"] is None:
            continue

        sims = emb_norm @ emb_norm[idx]
        sims[idx] = -2.0  # exclude self

        # Gather top-K neighbours that have a non-null CPC mode.
        order = np.argsort(sims)[::-1]
        neighbours: list[tuple[str, float, str | None]] = []
        for ni in order:
            if len(neighbours) >= K:
                break
            mode = entities[ni]["mode"]
            sim = float(sims[ni])
            if sim < args.min_sim:
                break
            if mode is None:
                continue
            neighbours.append((entities[ni]["id"], sim, mode))

        if len(neighbours) < 2:
            continue

        score, dominant_pair, n_modes = compute_bridge_score(neighbours)

        if n_modes < args.min_modes:
            continue
        if score < args.score_threshold:
            continue

        bridges.append((
            entities[idx]["id"],
            entities[idx]["type"],
            score,
            dominant_pair,
            n_modes,
        ))

    bridges.sort(key=lambda x: -x[2])
    print(f"  Found {len(bridges)} bridge entities.")

    # -----------------------------------------------------------------------
    # Confusion matrix (when test-ids given)
    # -----------------------------------------------------------------------
    if args.test_ids:
        positives = set(args.positive_ids.split(",")) - {""}
        controls = set(args.control_ids.split(",")) - {""}

        if positives or controls:
            bridge_ids = {b[0] for b in bridges}

            tp = len(positives & bridge_ids)
            fn = len(positives - bridge_ids)
            fp = len(controls & bridge_ids)
            tn = len(controls - bridge_ids)

            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0

            print("\n=== CONFUSION MATRIX ===")
            print(f"  TP={tp}  FP={fp}  FN={fn}  TN={tn}")
            print(f"  Recall    = {recall:.1%}")
            print(f"  Precision = {precision:.1%}")
            print(f"  FPR       = {fpr:.1%}")
            gate = "✅ PASS" if recall >= 0.80 and fpr < 0.30 else "❌ FAIL"
            print(f"  Gate      = {gate}  (target: recall≥80%, FPR<30%)")

        print("\nTop-30 bridges in target set:")
        for i, (eid, etype, score, dpair, n_modes) in enumerate(bridges[:30]):
            print(f"  {i+1:3d}. {eid[:30]:30s} | {etype:12s} | score={score:.3f}"
                  f" | modes={n_modes} | pair={dpair}")
        return

    # -----------------------------------------------------------------------
    # Dry-run: print only
    # -----------------------------------------------------------------------
    if args.dry_run:
        print("\nTop-50 bridges:")
        for i, (eid, etype, score, dpair, n_modes) in enumerate(bridges[:50]):
            print(f"  {i+1:3d}. {eid[:30]:30s} | {etype:12s} | score={score:.3f}"
                  f" | modes={n_modes} | pair={dpair}")
        return

    # -----------------------------------------------------------------------
    # Write to atlas.cross_modal_bridges
    # -----------------------------------------------------------------------
    print("\nWriting to atlas.cross_modal_bridges…")
    cur.execute("DELETE FROM atlas.cross_modal_bridges")

    computed_at = datetime.now(timezone.utc)
    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO atlas.cross_modal_bridges
            (entity_id, entity_type, bridge_score, dominant_pair, top_k_distinct_modes, computed_at)
        VALUES %s
        ON CONFLICT (entity_id, entity_type) DO UPDATE
            SET bridge_score          = EXCLUDED.bridge_score,
                dominant_pair         = EXCLUDED.dominant_pair,
                top_k_distinct_modes  = EXCLUDED.top_k_distinct_modes,
                computed_at           = EXCLUDED.computed_at
        """,
        [
            (eid, etype, float(score), dominant_pair, n_modes, computed_at)
            for eid, etype, score, dominant_pair, n_modes in bridges
        ],
        template="(%s, %s, %s, %s::text[], %s, %s)",
    )

    conn.commit()
    print(f"Done. Wrote {len(bridges)} bridge records.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
