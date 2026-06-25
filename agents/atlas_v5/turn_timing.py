"""Per-stage turn timing — surfaced in answer_dev_meta.stage_ms (dev overlay)."""

from __future__ import annotations

import time
from contextlib import contextmanager
from typing import Any, Iterator


def empty_stage_ms() -> dict[str, float]:
    return {}


def merge_stage_ms(base: dict[str, Any] | None, patch: dict[str, float]) -> dict[str, float]:
    prior = dict((base or {}).get("stage_ms") or {})
    prior.update({k: round(v, 0) for k, v in patch.items()})
    return prior


@contextmanager
def stage_timer(bucket: dict[str, float], key: str) -> Iterator[None]:
    t0 = time.perf_counter()
    try:
        yield
    finally:
        bucket[key] = bucket.get(key, 0.0) + (time.perf_counter() - t0) * 1000
