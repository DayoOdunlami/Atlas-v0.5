"""Resolve corpus SQL scope from user query (rail / aviation / maritime / default)."""

from __future__ import annotations

import re

from agents.atlas_v5.j1t1_corpus import J1T1_WHERE

Scope = tuple[str, str, str]  # where_sql, object_label, mode_tag


def _maritime_scope(ql: str) -> bool:
    """Maritime slice — avoid matching ``port`` inside *transport* / *opportunity*."""
    if "airport" in ql:
        return False
    if re.search(r"\bmaritime\b|\bshipping\b", ql):
        return True
    # Standalone port/ports only (not the suffix of "transport").
    if re.search(r"(?<!trans)ports?\b", ql):
        return True
    return False


def corpus_scope_for_query(query: str) -> Scope:
    ql = query.lower()
    if re.search(r"\btransport mode(s)?\b", ql) and re.search(
        r"\b(prioriti[sz]e|prioritise|prioritize|compare|which mode|across modes)\b", ql
    ):
        return (
            "TRUE",
            "Transport decarbonisation (all modes)",
            "multi_mode",
        )
    if re.search(r"\b(swot|pest|pestle)\b", ql) and re.search(
        r"\bcpc|connected places catapult\b", ql
    ):
        return ("TRUE", "Connected Places Catapult", "cpc")
    if re.search(r"\b(dft|department for transport)\b", ql) and re.search(
        r"\b(cpc|connected places)\b", ql
    ) and re.search(r"\b(strateg|align|misalign|overlap)\b", ql):
        return ("TRUE", "UK transport strategy alignment", "strategy")
    if re.search(r"\bcpc|connected places catapult\b", ql) and not re.search(
        r"\brail\b", ql
    ):
        return ("TRUE", "Connected Places Catapult", "cpc")
    if re.search(
        r"\bjustify your existence|your value proposition|what makes you different|"
        r"developing you\b|weak offering",
        ql,
    ):
        return ("TRUE", "CPC innovation corpus", "atlas_meta")
    if re.search(r"\brural\b", ql) and re.search(r"\btransport\b", ql):
        return ("TRUE", "Rural transport", "rural")
    if re.search(r"\baviation|aircraft|airport|sustainable aviation fuel|saf\b", ql):
        return (
            "'aviation' = ANY(cpc_modes) AND 'decarbonisation' = ANY(cpc_themes)",
            "Aviation decarbonisation",
            "aviation",
        )
    if _maritime_scope(ql):
        return (
            "'maritime' = ANY(cpc_modes) AND 'decarbonisation' = ANY(cpc_themes)",
            "Maritime decarbonisation",
            "maritime",
        )
    if re.search(r"\bhydrogen\b", ql) and "rail" not in ql:
        return (
            "'hydrogen' = ANY(cpc_themes) OR 'hydrogen' = ANY(cpc_modes)",
            "Hydrogen innovation",
            "hydrogen",
        )
    return (J1T1_WHERE, "Rail decarbonisation", "rail")
