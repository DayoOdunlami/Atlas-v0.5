"""
agents.spine
============

Shared trust spine — every query passes through this after synthesis.

Promoted from agents.atlas.* (previously ATLAS-only) per ADR-0001.

Modules
-------
verify          Orchestrates citation_guard + falsification + artifact_qa
citation_guard  Caps confidence tier by evidence count (no LLM calls)
falsification   Disconfirming red-team search (Exa/Tavily)
artifact_qa     Deterministic content/evidence scoring
confidence      Canonical computed-tier function (lifted from citation_guard)
"""
