"""
agents.instrumentation
======================

Self-revealing gap detection — emits structured signals from every node,
aggregates them into a capability-gap report per ADR-0001 §9.

Modules
-------
signals     Gap-signal emitters (tier_low, citations_dropped, prose_fallback, …)
gap_report  Aggregates signals into a per-CQ capability-gap report
"""
