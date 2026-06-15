"""
agents.registry
===============

Render and visualisation registry — described capabilities the format pass
selects from.  Promoted from agents.visual_recipe_director per ADR-0001.

Modules
-------
blocks          13-block declarative specs (purpose / data_shape / when_to_use)
viz             Curated chart selectors (from visual_recipe_director)
viz_guardrail   Encoding guardrail for generative ECharts / MCP viz
render_model    buildAtlasRenderModel(match_id, canonical_question_id) keystone
"""
