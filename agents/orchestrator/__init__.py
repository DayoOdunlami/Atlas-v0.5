"""
agents.orchestrator
===================

The Atlas 5 brain — tool-calling orchestrator (ADR-0001).

Replaces agents.workbench.graph (the hard-router) once the
ATLAS5_ORCHESTRATOR_V1 feature flag is enabled.

Sub-modules
-----------
graph           LangGraph StateGraph: triage -> gate -> loop -> verify -> format -> END
triage          Cheap effort/ambiguity/cost classifier (clarify|refine|analyze|deep)
gate            HITL interrupt for deep/external queries
tools           @tool wrappers exposed to the orchestrator loop
format_pass     AtlasRenderModel -> block layout selection (blocks|document)
subagents/      Parallel-breadth subagents (e.g. CICERONE)
"""
