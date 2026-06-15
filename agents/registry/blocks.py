"""
agents.registry.blocks
======================

Declarative block registry — 13 canonical Atlas 5 block types.

Each entry declares the block's purpose, required data shape, and when
the format pass should select it.  The format pass reads this registry;
block components in src/components/workbench/blocks/ are the React render
targets that receive the data keyed by block_id.

ADR-0001 §6: "blocks become render targets chosen by the format pass,
not schemas the LLM must fill".

Usage
-----
    from agents.registry.blocks import BLOCK_REGISTRY, get_blocks_for_outcome

    blocks = get_blocks_for_outcome("diagnose")   # → [BlockSpec, ...]
    block  = BLOCK_REGISTRY["context_card"]       # → BlockSpec
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

Outcome = Literal["orient", "connect", "diagnose", "act", "defend"]


@dataclass(frozen=True)
class BlockSpec:
    """Declarative descriptor for one Atlas block type."""

    block_id: str
    """Stable identifier — must match the React component's expected prop key."""

    display_name: str
    """Human label shown in the render pane."""

    react_component: str
    """PascalCase component name in src/components/workbench/blocks/."""

    purpose: str
    """One sentence: what question does this block answer for the user?"""

    data_shape: list[str]
    """Required top-level keys that must be present in the block's data dict."""

    when_to_use: str
    """Condition under which the format pass should select this block."""

    outcomes: list[Outcome]
    """Which of the five canonical outcomes this block supports."""

    min_citations: int = 0
    """Minimum corpus citations required before this block is rendered."""

    requires_corpus_data: bool = True
    """False only for blocks that are purely LLM-synthesised (e.g. action plan)."""


BLOCK_REGISTRY: dict[str, BlockSpec] = {
    b.block_id: b
    for b in [
        BlockSpec(
            block_id="context_card",
            display_name="Context Card",
            react_component="ContextCardBlock",
            purpose="Sets the scene: who is the entity, what sector, what they do.",
            data_shape=["entity_name", "sector", "description"],
            when_to_use="Always included as the first block in any artifact.",
            outcomes=["orient", "connect", "diagnose", "act", "defend"],
            min_citations=0,
            requires_corpus_data=False,
        ),
        BlockSpec(
            block_id="claim_ledger",
            display_name="Claim Ledger",
            react_component="ClaimLedgerBlock",
            purpose="Lists verified claims with their evidence state and citation IDs.",
            data_shape=["claims"],
            when_to_use="When the synthesis produces 2+ distinct evidence-backed claims.",
            outcomes=["diagnose", "defend", "act"],
            min_citations=1,
        ),
        BlockSpec(
            block_id="evidence_state_summary",
            display_name="Evidence State Summary",
            react_component="EvidenceStateSummaryBlock",
            purpose="Aggregates evidence quality across a set of claims or themes.",
            data_shape=["evidence_items"],
            when_to_use="When the query asks about evidence quality or coverage across a topic.",
            outcomes=["diagnose", "defend"],
            min_citations=2,
        ),
        BlockSpec(
            block_id="dimension_gap",
            display_name="Dimension Gap",
            react_component="DimensionGapBlock",
            purpose="Shows structured gaps between current capability and a requirement.",
            data_shape=["dimensions"],
            when_to_use="When outcome is 'diagnose' and a Requirement Spec has been extracted.",
            outcomes=["diagnose"],
            min_citations=1,
        ),
        BlockSpec(
            block_id="match_bench",
            display_name="Match Bench",
            react_component="MatchBenchBlock",
            purpose="Scores Fit / Gap / Risk for each Requirement Spec criterion.",
            data_shape=["matches"],
            when_to_use="When matcher has produced a scored Fit/Gap/Risk/Move result.",
            outcomes=["diagnose", "connect"],
            min_citations=1,
        ),
        BlockSpec(
            block_id="transfer_lanes",
            display_name="Transfer Lanes",
            react_component="TransferLanesBlock",
            purpose="Visualises which capabilities travel as-is vs. need reframing vs. are missing.",
            data_shape=["lanes"],
            when_to_use="When value_translation has produced labelled claims (travels-as-is etc).",
            outcomes=["connect", "diagnose"],
            min_citations=2,
        ),
        BlockSpec(
            block_id="opportunity_list",
            display_name="Opportunity List",
            react_component="OpportunityListBlock",
            purpose="Ranked list of sector analogues or funding opportunities with fit scores.",
            data_shape=["opportunities"],
            when_to_use="When outcome is 'connect' and 2+ analogues or live calls are identified.",
            outcomes=["connect", "orient"],
            min_citations=1,
        ),
        BlockSpec(
            block_id="comparison_matrix",
            display_name="Comparison Matrix",
            react_component="ComparisonMatrixBlock",
            purpose="Side-by-side comparison of entities, calls, or evidence themes.",
            data_shape=["rows", "columns"],
            when_to_use="When the query asks to compare 3+ entities or calls explicitly.",
            outcomes=["orient", "diagnose", "connect"],
            min_citations=0,
            requires_corpus_data=False,
        ),
        BlockSpec(
            block_id="network_map",
            display_name="Network Map",
            react_component="NetworkMapBlock",
            purpose="Relationship graph between entities, projects, or themes.",
            data_shape=["nodes", "edges"],
            when_to_use="When 4+ linked entities are present and relationship structure is the insight.",
            outcomes=["orient", "connect"],
            min_citations=2,
        ),
        BlockSpec(
            block_id="economic_case",
            display_name="Economic Case",
            react_component="EconomicCaseBlock",
            purpose="Five Case Model economics section: NPV, BCR, STPR, investment rationale.",
            data_shape=["npv_value", "discount_rate", "benefit_items"],
            when_to_use="When outcome is 'act' and an economic appraisal has been computed.",
            outcomes=["act", "defend"],
            min_citations=2,
        ),
        BlockSpec(
            block_id="recommendation_confidence",
            display_name="Recommendation & Confidence",
            react_component="RecommendationConfidenceBlock",
            purpose="Lead recommendation with confidence tier badge and supporting rationale.",
            data_shape=["recommendation", "confidence_tier", "rationale"],
            when_to_use="Always included as the final block summarising the artifact.",
            outcomes=["orient", "connect", "diagnose", "act", "defend"],
            min_citations=0,
            requires_corpus_data=False,
        ),
        BlockSpec(
            block_id="objection_response",
            display_name="Objection Response",
            react_component="ObjectionResponseBlock",
            purpose="Pre-empts scrutiny questions with evidence-grounded responses.",
            data_shape=["objections"],
            when_to_use="When outcome is 'defend' or query explicitly asks about challenges/scrutiny.",
            outcomes=["defend"],
            min_citations=1,
        ),
        BlockSpec(
            block_id="provenance_trace",
            display_name="Provenance Trace",
            react_component="ProvenanceTraceBlock",
            purpose="Audit trail from claim to corpus source with similarity scores.",
            data_shape=["traces"],
            when_to_use="When confidence tier is Supported/Robust and defend mode is active.",
            outcomes=["defend"],
            min_citations=3,
        ),
        BlockSpec(
            block_id="action_plan",
            display_name="Action Plan",
            react_component="ActionPlanBlock",
            purpose="Ordered next-step actions with owners, timing, and dependencies.",
            data_shape=["actions"],
            when_to_use="When outcome is 'act' and concrete next steps are synthesised.",
            outcomes=["act"],
            min_citations=0,
            requires_corpus_data=False,
        ),
    ]
}


def get_blocks_for_outcome(outcome: Outcome) -> list[BlockSpec]:
    """Return all block specs that support the given outcome, ordered by primacy."""
    return [b for b in BLOCK_REGISTRY.values() if outcome in b.outcomes]


def get_required_data_keys(block_id: str) -> list[str]:
    """Return the data_shape keys required by a block."""
    spec = BLOCK_REGISTRY.get(block_id)
    if spec is None:
        raise KeyError(f"Unknown block_id: {block_id!r}. "
                       f"Valid IDs: {list(BLOCK_REGISTRY.keys())}")
    return list(spec.data_shape)


ALL_BLOCK_IDS: list[str] = list(BLOCK_REGISTRY.keys())
