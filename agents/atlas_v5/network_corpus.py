"""
Corpus queries for Connect / NetworkMap (GATE 3).

READ ONLY — atlas.cross_modal_bridges + J1T1 org/funder slice.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

from mcps.cpc_corpus.queries import _pg_query

from agents.atlas_v5.j1t1_corpus import J1T1_WHERE


@dataclass
class NetworkGraphData:
    nodes: list[dict[str, Any]] = field(default_factory=list)
    edges: list[dict[str, Any]] = field(default_factory=list)
    ladder_rung: str = "typed-inventory"
    edge_density: float = 0.0
    corpus_count: int = 0


def _normalise_mode_label(raw: str) -> str:
    return raw.strip().title() if raw else "Unknown"


def fetch_rail_mode_bridge_graph() -> NetworkGraphData:
    """Mode↔mode edges where Rail appears in dominant_pair (casing-safe)."""
    rows = _pg_query(
        """
        SELECT
          dominant_pair[1] AS mode_a,
          dominant_pair[2] AS mode_b,
          COUNT(*)::int AS bridge_count,
          AVG(bridge_score)::float AS avg_score
        FROM atlas.cross_modal_bridges
        WHERE dominant_pair IS NOT NULL
          AND array_length(dominant_pair, 1) >= 2
          AND EXISTS (
            SELECT 1 FROM unnest(dominant_pair) m
            WHERE lower(trim(m)) = 'rail'
          )
        GROUP BY dominant_pair[1], dominant_pair[2]
        ORDER BY bridge_count DESC
        LIMIT 24
        """
    )

    nodes: dict[str, dict[str, Any]] = {}
    edges: list[dict[str, Any]] = []

    for row in rows:
        a = _normalise_mode_label(str(row["mode_a"]))
        b = _normalise_mode_label(str(row["mode_b"]))
        weight = float(row["avg_score"] or 0)
        count = int(row["bridge_count"] or 0)
        for mode in (a, b):
            if mode not in nodes:
                nodes[mode] = {
                    "id": mode.lower().replace(" ", "_"),
                    "label": mode,
                    "group": "mode",
                    "source": "corpus",
                }
        edges.append(
            {
                "source": nodes[a]["id"],
                "target": nodes[b]["id"],
                "weight": round(weight, 3),
                "count": count,
                "trust": "corpus",
            }
        )

    return _finalize_graph(list(nodes.values()), edges)


def fetch_j1t1_org_funder_graph() -> NetworkGraphData:
    """Org ↔ funder bipartite for rail decarb slice."""
    rows = _pg_query(
        f"""
        SELECT
          COALESCE(NULLIF(trim(lead_org_name), ''), 'Unknown org') AS org,
          COALESCE(NULLIF(trim(lead_funder), ''), 'Unknown funder') AS funder,
          COUNT(*)::int AS project_count
        FROM atlas.projects
        WHERE {J1T1_WHERE}
        GROUP BY lead_org_name, lead_funder
        ORDER BY project_count DESC
        LIMIT 40
        """
    )

    nodes: dict[str, dict[str, Any]] = {}
    edges: list[dict[str, Any]] = []

    for row in rows:
        org = str(row["org"])
        funder = str(row["funder"])
        count = int(row["project_count"] or 1)
        org_id = f"org:{org[:48]}"
        funder_id = f"funder:{funder[:48]}"
        if org_id not in nodes:
            nodes[org_id] = {
                "id": org_id,
                "label": org[:40],
                "group": "org",
                "source": "corpus",
            }
        if funder_id not in nodes:
            nodes[funder_id] = {
                "id": funder_id,
                "label": funder[:40],
                "group": "funder",
                "source": "corpus",
            }
        edges.append(
            {
                "source": org_id,
                "target": funder_id,
                "weight": count,
                "trust": "corpus",
            }
        )

    return _finalize_graph(list(nodes.values()), edges)


def fetch_connect_network_graph() -> NetworkGraphData:
    """Prefer mode bridge graph; fall back to org/funder if sparse."""
    mode_graph = fetch_rail_mode_bridge_graph()
    if len(mode_graph.edges) >= 2:
        return mode_graph
    org_graph = fetch_j1t1_org_funder_graph()
    if len(org_graph.edges) > len(mode_graph.edges):
        return org_graph
    return mode_graph if mode_graph.nodes else org_graph


def _finalize_graph(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> NetworkGraphData:
    n = max(len(nodes), 1)
    e = len(edges)
    density = e / (n * max(n - 1, 1))
    if e >= 6 and n >= 4:
        rung = "force-graph"
    elif e >= 2:
        rung = "ego-network"
    elif n >= 1:
        rung = "typed-inventory"
    else:
        rung = "typed-inventory"

    # Fixed layout coords (layout:'none') — circle for modes, columns for org/funder
    for i, node in enumerate(nodes):
        group = node.get("group", "mode")
        if group == "mode":
            angle = (2 * math.pi * i) / max(len(nodes), 1)
            node["x"] = round(200 + 120 * math.cos(angle), 1)
            node["y"] = round(160 + 120 * math.sin(angle), 1)
        elif group == "funder":
            node["x"] = 320
            node["y"] = 40 + i * 28
        else:
            node["x"] = 80
            node["y"] = 40 + i * 22

    return NetworkGraphData(
        nodes=nodes,
        edges=edges,
        ladder_rung=rung,
        edge_density=round(density, 4),
        corpus_count=len(nodes),
    )
