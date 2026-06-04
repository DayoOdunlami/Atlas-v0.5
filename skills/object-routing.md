# Object Routing — Draft Skill (Sprint 5)

> **Status:** Draft — loaded into context packet; not invoked as a tool. Runtime wiring is `ATLAS_OBJECT_ROUTING_V1` in `agents/atlas/graph.py` (S5c).

## When to route object-first

Prefer object surfaces when the user names an **entity** or asks for an **entity-shaped deliverable**:

| Signal | Route |
|--------|--------|
| "Show me X as an organisation" / "organisation profile for X" | `organisation_profile` recipe |
| "Stakeholder map for …" / "who are the stakeholders" | `stakeholder_map` visual block |
| "Passport for …" / "open passport" | passport link + evidence panel (future) |
| Strategic analyse-mode question (horsemen, Five Case, landscape) | existing `select_recipe` — **do not override** |

## Resolver order (S5c)

1. Turn intent (`clarify` / `refine` / `analyze`) — unchanged.
2. If `ATLAS_OBJECT_ROUTING_V1` and query matches object patterns → set `object_route` + target recipe/block.
3. Else → `select_recipe` / horsemen routing as today.

## Block pairing

- `organisation_profile` → may include `evidence_aware_swot` + corpus citations.
- Stakeholder requests → primary visual `stakeholder_map` (min 3 nodes).
- Every path keeps `confidence_tier` on the artifact.

## Out of scope

- Do not add Orient sections for object routing.
- Do not fabricate organisation UUIDs — fixture/lab only until corpus entity index exists.
