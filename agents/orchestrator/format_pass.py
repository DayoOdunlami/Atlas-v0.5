"""
agents.orchestrator.format_pass
================================

Format pass — converts a verified AtlasRenderModel into a layout-ready
artifact with blocks selected and render_mode chosen.

This is the last pure-Python step before the model is sent to the frontend.
It reads from agents.registry.blocks (declarative block specs) and
agents.registry.viz (chart recipe selection) to decide:

  1. Which block_ids are eligible given outcome + citation count
  2. Whether to render as 'blocks' or 'document' (prose)
  3. Which chart spec to attach

Rules
-----
  render_mode = 'blocks'    → structured block layout (default)
  render_mode = 'document'  → prose + citations only
  render_mode = 'chart'     → chart spec is the primary deliverable

  'document' is preferred when:
    - artifact type is 'evidence' or
    - query is explicitly prose-oriented (e.g. "write a summary")
    - confidence_tier is 'Speculative' (not enough evidence for blocks)

  Chart spec is attached when the viz registry returns a non-empty recipe.
"""
from __future__ import annotations

import re
from typing import Any, Literal

from agents.registry.blocks import get_blocks_for_outcome, BlockSpec

RenderMode = Literal["blocks", "document", "chart"]

_PROSE_PATTERNS = [
    re.compile(r"\bwrite\b|\bsummar\b|\bnarrat\b|\breport\b|\bdraft\b", re.I),
    re.compile(r"\bprose\b|\bdocument\b|\bpaper\b|\bbrief\s+me\b", re.I),
]

_CHART_PATTERNS = [
    re.compile(r"\bshow\b.*\bchart\b|\bchart\b|\bvisual\b|\bgraph\b|\bplot\b", re.I),
    re.compile(r"\bvisuali[sz]\b|\bsankey\b|\bbar\b.*\bchart\b|\bradar\b", re.I),
]


def _choose_render_mode(
    model: dict[str, Any],
    query: str,
) -> RenderMode:
    tier = model.get("confidence_tier", "Speculative")

    if model.get("type") == "chart":
        return "chart"

    for pat in _CHART_PATTERNS:
        if pat.search(query):
            return "chart"

    if tier == "Speculative":
        return "document"

    for pat in _PROSE_PATTERNS:
        if pat.search(query):
            return "document"

    if model.get("type") == "evidence":
        return "document"

    return "blocks"


def _select_blocks(
    model: dict[str, Any],
    render_mode: RenderMode,
) -> list[str]:
    """Select eligible block IDs ordered by outcome-preferred sequence."""
    if render_mode == "document":
        return []

    outcome = model.get("outcome", "orient")
    citation_count = len(model.get("corpus_citations") or [])

    from agents.registry.blocks import BLOCK_REGISTRY
    from agents.orchestrator.subagents.outcomes import get_preferred_blocks

    # Use the outcome-specific preferred order, filtered by eligibility
    preferred = get_preferred_blocks(outcome)  # type: ignore[arg-type]
    eligible_set = {
        b.block_id
        for b in BLOCK_REGISTRY.values()
        if outcome in b.outcomes and citation_count >= b.min_citations
    }

    # Start with preferred blocks that are eligible
    ordered = [b for b in preferred if b in eligible_set]

    # Add any remaining eligible blocks not in preferred order
    for b in eligible_set:
        if b not in ordered:
            ordered.append(b)

    # Enforce: context_card first, recommendation_confidence last
    if "context_card" in ordered:
        ordered = ["context_card"] + [b for b in ordered if b != "context_card"]
    if "recommendation_confidence" in ordered:
        ordered = [b for b in ordered if b != "recommendation_confidence"]
        ordered.append("recommendation_confidence")

    return ordered


def _attach_chart_spec(
    model: dict[str, Any],
    render_mode: RenderMode,
) -> list[dict[str, Any]] | None:
    """
    Attach a chart spec when appropriate.

    When ATLAS5_GENERATIVE_VIZ_V1=true, the spec is passed through the
    encoding guardrail before being attached.
    """
    if model.get("chart_spec"):
        raw_specs = model["chart_spec"]
        return _apply_guardrail(raw_specs)

    if render_mode not in ("blocks", "chart"):
        return None

    query = model.get("query", "")
    if not query:
        return None

    try:
        from agents.registry.viz import build_chart_specs
        specs = build_chart_specs(model, query=query)
        if not specs:
            return None
        return _apply_guardrail(specs)
    except Exception:
        return None


def _apply_guardrail(specs: list[dict[str, Any]]) -> list[dict[str, Any]] | None:
    """Apply encoding guardrail when ATLAS5_GENERATIVE_VIZ_V1=true."""
    from agents.feature_flags import flags
    if not flags.generative_viz_v1:
        return specs  # Pass through unmodified when flag is off

    from agents.registry.viz_guardrail import validate_chart_spec, sanitise_chart_spec
    validated: list[dict[str, Any]] = []
    for spec in specs:
        is_valid, issues = validate_chart_spec(spec)
        if is_valid:
            validated.append(spec)
        else:
            # Auto-fix recoverable issues
            fixed = sanitise_chart_spec(spec)
            fixed_valid, _ = validate_chart_spec(fixed)
            if fixed_valid:
                validated.append(fixed)
            # If still invalid, drop the spec (don't surface broken charts)

    return validated if validated else None


def run_format_pass(
    model: dict[str, Any],
    query: str = "",
) -> dict[str, Any]:
    """
    Apply the format pass to a verified AtlasRenderModel.

    Returns a new dict with blocks, render_mode, and chart_spec populated.
    """
    q = query or model.get("query", "")
    render_mode = _choose_render_mode(model, q)
    block_ids = _select_blocks(model, render_mode)
    chart_spec = _attach_chart_spec(model, render_mode)

    updated = dict(model)
    updated["blocks"] = block_ids
    updated["render_mode"] = render_mode
    if chart_spec is not None:
        updated["chart_spec"] = chart_spec

    return updated
