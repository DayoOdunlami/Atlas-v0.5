"""Embedding and UMAP viz utilities.

Consolidates scale_axis (previously copy-pasted in 4 scripts) and the
UMAP transform logic. Embedding is optional — if OpenAI key is absent,
functions return None gracefully.
"""

from __future__ import annotations

import pickle
from pathlib import Path
from typing import Optional

import numpy as np

EMBED_MODEL = "text-embedding-3-small"
# Approximate cost per 1M tokens for text-embedding-3-small (May 2026)
_COST_PER_TOKEN = 0.02 / 1_000_000


def load_umap_model(
    model_path: Optional[Path] = None,
) -> tuple[object, dict] | tuple[None, None]:
    """Load UMAP reducer and raw_bounds from pickle.

    Returns (reducer, raw_bounds) or (None, None) if file is missing.
    raw_bounds is a dict with x_min, x_max, y_min, y_max.
    """
    if model_path is None:
        # Default: scripts/umap_model.pkl relative to this file's grandparent
        model_path = Path(__file__).resolve().parents[2] / "umap_model.pkl"
    if not model_path.is_file():
        return None, None
    with open(model_path, "rb") as f:
        bundle = pickle.load(f)
    if isinstance(bundle, dict):
        reducer = bundle.get("reducer")
        raw_bounds = bundle.get("raw_bounds")
    else:
        reducer = bundle
        raw_bounds = None
    if reducer is None or raw_bounds is None:
        return None, None
    return reducer, raw_bounds


def scale_axis(val: float, mn: float, mx: float) -> float:
    """Map a raw UMAP coordinate to 0–100 using training-time bounds."""
    if mx == mn:
        return 50.0
    v = (val - mn) / (mx - mn) * 100.0
    return float(max(0.0, min(100.0, v)))


def embed_texts(
    client,
    texts: list[str],
) -> list[list[float]]:
    """Embed a batch of texts using OpenAI text-embedding-3-small.

    Trims each text to 8000 chars before sending (API limit is ~8191 tokens).
    Returns a list of embedding vectors in the same order as input.
    """
    trimmed = [t[:8000] for t in texts]
    resp = client.embeddings.create(input=trimmed, model=EMBED_MODEL)
    return [item.embedding for item in resp.data]


_UMAP_MIN_BATCH = 3  # UMAP's NN tree needs at least a few points to transform


def compute_viz(
    reducer,
    raw_bounds: dict,
    embeddings: list[list[float]],
) -> list[tuple[Optional[float], Optional[float]]]:
    """Project embeddings to 0–100 viz coordinates using the UMAP reducer.

    Returns list of (vx, vy) tuples in the same order as input embeddings.
    Returns (None, None) for each item when the batch is too small for UMAP.

    UMAP's internal NN tree raises 'pop from empty list' for batches smaller
    than ~3 items. Coordinates for skipped rows can be backfilled later in a
    dedicated batch job that accumulates enough points.

    TODO: schedule a periodic batch job to fill viz_x/viz_y=NULL rows by
          running compute_viz on all NULL-coordinate rows in bulk.
    """
    if len(embeddings) < _UMAP_MIN_BATCH:
        print(
            f"  [umap] Skipping viz projection for batch of {len(embeddings)} "
            f"(minimum {_UMAP_MIN_BATCH} required). viz_x/viz_y will be NULL "
            "and can be backfilled in a future batch job.",
            flush=True,
        )
        return [(None, None)] * len(embeddings)

    arr = np.array(embeddings, dtype=np.float64)
    coords = reducer.transform(arr)
    x_min, x_max = raw_bounds["x_min"], raw_bounds["x_max"]
    y_min, y_max = raw_bounds["y_min"], raw_bounds["y_max"]
    return [
        (scale_axis(float(coords[i, 0]), x_min, x_max),
         scale_axis(float(coords[i, 1]), y_min, y_max))
        for i in range(len(embeddings))
    ]


def estimate_cost(texts: list[str]) -> float:
    """Rough cost estimate for embedding a list of texts (USD)."""
    total_chars = sum(len(t) for t in texts)
    approx_tokens = total_chars / 4
    return approx_tokens * _COST_PER_TOKEN
