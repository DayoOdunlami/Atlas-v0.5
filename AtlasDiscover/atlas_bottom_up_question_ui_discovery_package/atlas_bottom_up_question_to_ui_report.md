# Atlas Bottom-Up Question → Answer → UI Discovery Report

Generated: 2026-06-11T17:05:04.144393Z

## Executive verdict

The bottom-up pass **supports the current controlled-render-model direction**, but it adds three important requirements before the UI grammar hardens:

1. Add **EconomicCaseBlock / FiveCaseModelBlock** for value, NPV, BCR, payback and Green Book-style questions.
2. Add **ReasoningTrace** as a shell/workflow component for streamed progress and explainability.
3. Make the **visual registry explicit** so the backend can emit valid visuals without letting an Art Director agent invent arbitrary UI.

The best operating model is:

**Use GenUI for discovery. Use controlled blocks for committed Atlas artifacts.**

## Data context used

Supabase currently contains 3,229 live calls, 711 projects, 319 organisations, 393 evidence containers, 85 matches, 7 passports, 48 claims and 52 passport claims.

The CPC passport exists as a structured capability profile and describes CPC as a UK government-backed innovation accelerator with capabilities in innovation programme management, SME acceleration, testbed operation, stakeholder convening and evidence-based policy support across rail, highways/integrated transport and maritime. The same profile states that its claims are self-reported with independent verification pending.

The stored matches are rich enough for bottom-up UI discovery. Sample rows include match score, match summary, evidence map, gaps, gap value estimate and linked source/target objects. The RAPPID/GPS-denied UAS example is especially useful because it contains a stored match summary, evidence map and four gaps.

## Method

I generated 100 high-value seed questions across 20 domains and produced 36 sampled answer-shape records. This is a UI-discovery report, not a final evidence report for every individual question.

The goal was to identify answer shapes:
- what blocks recur
- where charts reduce text
- where tables are better
- where GenUI is valuable
- where controlled blocks are safer

## Main finding: the existing pantry is broadly right

The answer shapes repeatedly reuse the same spine:
- RecommendationConfidence
- EvidenceStateSummary
- ClaimLedger
- DimensionGap
- ProvenanceTrace
- ActionPlan or ObjectionResponse

This validates the core Workbench model.

## What is missing

### 1. EconomicCaseBlock / FiveCaseModelBlock

Value questions are too common and too distinct to force into generic Recommendation + ActionPlan cards.

When quantitative data exists, show:
- NPV
- BCR
- payback
- NPV waterfall
- sensitivity/tornado
- assumptions ledger with provenance

When quantitative data is weak, show:
- value driver cards
- qualitative assumptions
- evidence state per assumption
- what evidence is needed before monetisation

### 2. ReasoningTrace

This should not be an analytical block. It should be a shell component that streams user-facing progress:
- Loaded match
- Checked claims
- Found evidence map
- Found gaps
- Applied confidence cap
- Built artifact
- Committed AtlasRenderModel

### 3. Priority and spatial visuals

Add visual options, not necessarily new blocks:
- `priority_quadrant`
- `scatter`
- `geo_map`
- `source_manifest`
- `evidence_upgrade_queue`

## Recommended block-library changes

Keep the current library, but add:
- EconomicCaseBlock
- ReasoningTrace shell
- explicit SnapshotBrief
- variants for ClaimLedger, ProvenanceTrace, ComparisonMatrix and OpportunityList

## Visual registry recommendation

The registry should include:
- RecommendationConfidence → decision_card, role_decision_card
- EvidenceStateSummary → evidence_state_bar, confidence_cap_card
- DimensionGap → gap_rows, gap_matrix, gap_to_action_rows
- MatchBench → evidence_map_table, requirement_coverage_matrix
- ClaimLedger → audit_table, evidence_upgrade_queue, source_manifest
- EconomicCaseBlock → value_driver_cards, assumptions_ledger, npv_waterfall, sensitivity_tornado
- ReasoningTrace → stepper, chain_of_thought_trace, status_timeline

## GenUI vs controlled blocks

Use GenUI for:
- discovering answer shapes
- unusual one-off layouts
- stress-testing component coverage
- narrative board-pack drafts

Use controlled blocks for:
- committed workbench artifacts
- citations/provenance
- confidence caps
- patching
- inspector
- snapshots
- persistence

## Implication for the build

Do not stop `buildAtlasRenderModel()`.

But update the contract before hardening the backend too far:
1. Add EconomicCaseBlock to the type system.
2. Add ReasoningTrace to the shell/state model.
3. Add visual registry entries for economic, priority, source manifest and evidence upgrade use cases.
4. Keep Art Director as a later helper: `selectVisualRecipe(blockType, dataShape, intent)`.
5. Do not let the old visual_recipe_director become the main Workbench layout brain.

## Final recommendation

Proceed on two tracks:

**Engineering path:** continue Milestone 0.5 — `buildAtlasRenderModel()` + `/api/workbench/render-model` + async WorkbenchContext.

**Design validation path:** use the attached CSVs to review whether the block pantry covers real question/answer shapes before making the UI library rigid.

The product principle remains:

**Use real questions to discover the pantry. Use the render model to run the kitchen.**
