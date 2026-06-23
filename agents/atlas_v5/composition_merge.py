"""Fill {{key}} and {{scale(...)}} holes from KeyedFigureIndex."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from agents.atlas_v5.keyed_figures import KeyedFigureIndex
from agents.atlas_v5.scale_policies import apply_scale_policy

_KEY_HOLE = re.compile(r"\{\{([a-z0-9_.]+)\}\}")
_SCALE_HOLE = re.compile(
    r"\{\{scale\(\s*([a-z0-9_.]+)\s*,\s*policy=([a-z0-9_]+)(?:\s*,\s*peer=([a-z0-9_.]+))?\s*\)\}\}",
)


@dataclass
class MergeResult:
    merged_markup: str
    merge_log: dict[str, str] = field(default_factory=dict)
    scale_bindings: dict[str, dict[str, str]] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)


def merge_composition_markup(markup: str, index: KeyedFigureIndex) -> MergeResult:
    if not markup.strip():
        return MergeResult("", errors=["empty markup"])

    errors: list[str] = []
    merge_log: dict[str, str] = {}
    scale_bindings: dict[str, dict[str, str]] = {}
    out = markup

    for m in _SCALE_HOLE.finditer(markup):
        key, policy, peer = m.group(1), m.group(2), m.group(3)
        if index.get(key) is None:
            errors.append(f"unknown scale key: {key}")
            continue
        result = apply_scale_policy(policy, key, index, peer_key=peer)
        if result.refused or result.pixels is None:
            replacement = "0"
            merge_log[f"scale:{key}:{policy}"] = "refused"
        else:
            replacement = str(result.pixels)
            merge_log[f"scale:{key}:{policy}"] = f"{result.pixels}px"
        scale_bindings[m.group(0)] = {"key": key, "policy": policy}
        out = out.replace(m.group(0), replacement, 1)

    for m in _KEY_HOLE.finditer(out):
        key = m.group(1)
        if key.startswith("scale:"):
            continue
        fig = index.get(key)
        if fig is None:
            errors.append(f"unknown key: {key}")
            continue
        display = index.as_merge_dict().get(key, str(fig.value))
        merge_log[key] = display
        out = out.replace(m.group(0), display, 1)

    return MergeResult(
        merged_markup=out,
        merge_log=merge_log,
        scale_bindings=scale_bindings,
        errors=errors,
    )


def merge_keyed_figures_in_text(text: str, index: KeyedFigureIndex) -> str:
    """Replace {{key}} holes in prose; unknown keys are left unchanged."""
    if not text or "{{" not in text:
        return text
    merge_dict = index.as_merge_dict()
    out = text
    for m in _KEY_HOLE.finditer(text):
        key = m.group(1)
        if key.startswith("scale:"):
            continue
        display = merge_dict.get(key)
        if display is not None:
            out = out.replace(m.group(0), display, 1)
    return out


def text_has_unresolved_key_holes(text: str | None) -> bool:
    if not text:
        return False
    return bool(_KEY_HOLE.search(text))


def strip_unresolved_key_holes(text: str) -> str:
    """Remove leftover {{key}} tokens after merge (chat rail has no skeleton fallback)."""
    if not text or "{{" not in text:
        return text
    cleaned = _KEY_HOLE.sub("", text)
    cleaned = re.sub(r"  +", " ", cleaned)
    cleaned = re.sub(r" ([,.;:!?])", r"\1", cleaned)
    return cleaned.strip()
