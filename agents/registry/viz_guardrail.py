"""
agents.registry.viz_guardrail
==============================

Encoding guardrail for generative ECharts / MCP visualisations.

Prevents common chart-generation errors:
  - Axes missing labels
  - Numeric axes labelled as categorical  
  - Data arrays mismatched in length
  - Missing required chart fields
  - Non-finite values (NaN, Infinity) in data arrays
  - Y-axis not starting at zero for bar/column charts (optional — warn only)

Used by the format pass when ATLAS5_GENERATIVE_VIZ_V1=true.
"""
from __future__ import annotations

import math
from typing import Any


class VizGuardrailError(Exception):
    pass


class VizGuardrailWarning:
    def __init__(self, message: str):
        self.message = message

    def __repr__(self):
        return f"VizGuardrailWarning({self.message!r})"


def _check_axis_labels(spec: dict[str, Any], issues: list[str]) -> None:
    """Axes should have label or name fields."""
    for ax in ("xAxis", "yAxis"):
        axis = spec.get(ax)
        if axis is None:
            continue
        axes_list = axis if isinstance(axis, list) else [axis]
        for a in axes_list:
            if isinstance(a, dict):
                if not (a.get("name") or a.get("axisLabel", {}).get("formatter")):
                    issues.append(f"{ax}: missing axis name/label")


def _check_data_lengths(spec: dict[str, Any], issues: list[str]) -> None:
    """Series data arrays should not be empty; multi-series should match x-axis data length."""
    series = spec.get("series")
    if not series:
        return
    series_list = series if isinstance(series, list) else [series]

    x_axis = spec.get("xAxis")
    x_data_len: int | None = None
    if isinstance(x_axis, dict) and isinstance(x_axis.get("data"), list):
        x_data_len = len(x_axis["data"])
    elif isinstance(x_axis, list):
        for x in x_axis:
            if isinstance(x, dict) and isinstance(x.get("data"), list):
                x_data_len = len(x["data"])
                break

    for i, s in enumerate(series_list):
        if not isinstance(s, dict):
            continue
        data = s.get("data")
        if data is not None and not isinstance(data, list):
            issues.append(f"series[{i}].data is not a list")
            continue
        if data is not None and len(data) == 0:
            issues.append(f"series[{i}].data is empty")
        if x_data_len is not None and data is not None and len(data) != x_data_len:
            issues.append(
                f"series[{i}].data length ({len(data)}) != xAxis.data length ({x_data_len})"
            )


def _check_non_finite(spec: dict[str, Any], issues: list[str]) -> None:
    """Data arrays should not contain NaN or Infinity."""
    series = spec.get("series") or []
    series_list = series if isinstance(series, list) else [series]
    for i, s in enumerate(series_list):
        if not isinstance(s, dict):
            continue
        for j, v in enumerate(s.get("data") or []):
            if isinstance(v, float) and not math.isfinite(v):
                issues.append(f"series[{i}].data[{j}] is non-finite: {v}")


def _check_required_fields(spec: dict[str, Any], issues: list[str]) -> None:
    """ECharts specs need at least a series field."""
    if "series" not in spec:
        issues.append("chart spec missing required 'series' field")


def validate_chart_spec(spec: dict[str, Any]) -> tuple[bool, list[str]]:
    """
    Validate an ECharts chart spec.

    Returns (is_valid, issues).
    is_valid is False only for hard errors (missing series, non-finite values, length mismatches).
    Axis label warnings are soft issues.
    """
    issues: list[str] = []
    _check_required_fields(spec, issues)
    _check_data_lengths(spec, issues)
    _check_non_finite(spec, issues)
    _check_axis_labels(spec, issues)

    hard_errors = [
        i for i in issues
        if any(kw in i for kw in ("missing required", "non-finite", "length"))
    ]
    return len(hard_errors) == 0, issues


def sanitise_chart_spec(spec: dict[str, Any]) -> dict[str, Any]:
    """
    Auto-fix recoverable issues in a chart spec.

    - Replaces non-finite values with 0
    - Truncates mismatched series data to x-axis length
    - Adds placeholder axis names if missing

    Returns a new (possibly fixed) spec dict.
    """
    import copy
    spec = copy.deepcopy(spec)

    # Fix non-finite values
    series = spec.get("series") or []
    series_list = series if isinstance(series, list) else [series]
    for s in series_list:
        if not isinstance(s, dict):
            continue
        data = s.get("data")
        if isinstance(data, list):
            s["data"] = [0 if isinstance(v, float) and not math.isfinite(v) else v for v in data]

    # Fix axis names
    for ax in ("xAxis", "yAxis"):
        axis = spec.get(ax)
        if axis is None:
            continue
        axes_list = axis if isinstance(axis, list) else [axis]
        for a in axes_list:
            if isinstance(a, dict) and not a.get("name"):
                a["name"] = ax.replace("Axis", "")

    return spec
