"""Deterministic composition gate — diff is the gate, not model self-check."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from agents.atlas_v5.composition_merge import MergeResult
from agents.atlas_v5.keyed_figures import KeyedFigureIndex

_CURRENCY = re.compile(r"£[\d,.]+[kmb]?|~£[\d,.]+[kmb]?", re.I)
_INTEGER_RUN = re.compile(r"\b\d{2,}\b")
_SCALE_ATTR = re.compile(
    r'(width|height|r|stroke-width)\s*=\s*["\'](\d+)px["\']',
    re.I,
)
_DECLARED_SECTION = re.compile(
    r'<section[^>]*data-material="declared"[^>]*>.*?</section>',
    re.I | re.S,
)


def _markup_without_declared_sections(markup: str) -> str:
    return _DECLARED_SECTION.sub("", markup)


@dataclass
class GateResult:
    passed: bool
    errors: list[str] = field(default_factory=list)


def validate_composition_gate(
    source_markup: str,
    merged_markup: str,
    merge: MergeResult,
    index: KeyedFigureIndex,
) -> GateResult:
    errors: list[str] = []

    if merge.errors:
        errors.extend(merge.errors)

    allowed_values = set(merge.merge_log.values())
    gate_markup = _markup_without_declared_sections(merged_markup)
    for m in _CURRENCY.findall(gate_markup):
        if m not in allowed_values and not any(m in v for v in allowed_values):
            errors.append(f"orphan figure: {m}")

    if "£8.17m" in gate_markup and "£8.17m" not in allowed_values:
        if "stats.funding_floor_gbp" not in merge.merge_log:
            errors.append("orphan figure: £8.17m")

    scale_filled_values = {
        v.split("px")[0]
        for k, v in merge.merge_log.items()
        if k.startswith("scale:") and "px" in v and v != "refused"
    }

    for m in _SCALE_ATTR.finditer(merged_markup):
        attr, val = m.group(1), m.group(2)
        snippet = merged_markup[max(0, m.start() - 120) : m.end() + 40]
        if 'data-to-scale="true"' not in snippet and "data-to-scale='true'" not in snippet:
            continue
        if val in scale_filled_values:
            continue
        if "{{scale(" in source_markup and any(
            b in source_markup for b in merge.scale_bindings
        ):
            continue
        errors.append(
            f"hand-typed scale: {attr}={val}px with data-to-scale=true "
            "without scale(...) binding in source"
        )

    for key in re.findall(r'data-key="([a-z0-9_.]+)"', merged_markup):
        fig = index.get(key)
        if fig is None:
            errors.append(f"data-key references unknown key: {key}")
            continue
        material = re.search(
            rf'data-key="{re.escape(key)}"[^>]*data-material="(\w+)"',
            merged_markup,
        )
        if material and material.group(1) == "owned" and fig.material == "borrowed":
            errors.append(f"material mismatch: {key} marked owned but is borrowed")
        if material and material.group(1) == "declared":
            errors.append(f"declared material must not use data-key: {key}")

    for section in _DECLARED_SECTION.finditer(merged_markup):
        body = section.group(0)
        if re.search(r'data-material=["\']owned["\']', body, re.I):
            errors.append("declared section must not contain data-material=owned")
        if re.search(r'data-key=["\']', body, re.I):
            errors.append("declared section must not contain data-key bindings")

    return GateResult(passed=len(errors) == 0, errors=errors)
